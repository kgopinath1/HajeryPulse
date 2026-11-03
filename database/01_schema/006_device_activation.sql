/* ============================================================================
   Script 006: Device tokens (up to 2 active devices per user).

   After Microsoft sign-in, a user whose email is active in dim.[User] taps
   "Get token" on a new device. The API records a request here with the
   phone's device ID and emails IT. IT issues a token for that request
   (app.usp_Device_IssueToken) and gives it to the user, who enters it in
   the app within 2 hours. From then on the app sends the device ID and
   token on every request, and the API checks both against this table.

   The device ID is the phone's own (iOS identifierForVendor, kept in the
   Keychain; Android ANDROID_ID), so it stays the same after a reinstall and
   the same row and token keep working: iOS keeps the token in its Keychain,
   and on Android the user enters the same token again. A factory reset or
   new phone gives a new device ID and needs a new token.

   One row per user and device. Status:
     Requested  user tapped "Get token", waiting for IT
     Issued     IT generated a token, waiting for the user to enter it
     Active     token entered, this device can use the app
     Inactive   turned off by IT (or replaced); kept for history

   Only SHA-256 hashes of tokens are stored.

   Replaces app.UserDevice / app.DeviceActivationCode from the previous
   activation-code design; those are dropped below, so every device needs a
   new token.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

IF SCHEMA_ID(N'app') IS NULL EXEC('CREATE SCHEMA app AUTHORIZATION dbo;');
GO

IF OBJECT_ID(N'app.DeviceToken', N'U') IS NULL
CREATE TABLE app.DeviceToken (
    DeviceTokenId    INT IDENTITY(1,1)  NOT NULL PRIMARY KEY,   -- the request ID IT issues tokens for
    UserEmail        NVARCHAR(255)      NOT NULL,
    DeviceId         VARCHAR(64)        NOT NULL,              -- the phone's ID (IDFV / ANDROID_ID), upper-cased
    Platform         NVARCHAR(20)       NULL,                  -- ios / android
    DeviceName       NVARCHAR(200)      NULL,                  -- e.g. "Apple iPhone 15 Pro"
    Status           VARCHAR(10)        NOT NULL DEFAULT 'Requested',
    TokenHash        VARBINARY(32)      NULL,                  -- SHA-256 of the 8 token characters (no dash)
    FailedAttempts   INT                NOT NULL DEFAULT 0,
    RequestedUtc     DATETIME2(0)       NOT NULL DEFAULT SYSUTCDATETIME(),
    NotifiedUtc      DATETIME2(0)       NULL,                  -- last email to IT about this request
    IssuedUtc        DATETIME2(0)       NULL,
    IssuedBy         NVARCHAR(128)      NULL,
    TokenExpiresUtc  DATETIME2(0)       NULL,                  -- must be entered before this
    ActivatedUtc     DATETIME2(0)       NULL,
    LastSeenUtc      DATETIME2(0)       NULL,
    InactiveUtc      DATETIME2(0)       NULL,
    InactiveReason   NVARCHAR(200)      NULL,

    CONSTRAINT CK_DeviceToken_Status CHECK (Status IN ('Requested', 'Issued', 'Active', 'Inactive')),
    INDEX IX_DeviceToken_User (UserEmail, Status)
);
GO

-- Earlier draft of this table: an API-assigned InstallId per install.
IF COL_LENGTH(N'app.DeviceToken', N'InstallId') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_DeviceToken_LiveInstall')
        DROP INDEX UX_DeviceToken_LiveInstall ON app.DeviceToken;
    EXEC sp_rename N'app.DeviceToken.InstallId', N'DeviceId', N'COLUMN';
END;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'app.DeviceToken') AND name = N'DeviceId'
                                       AND system_type_id = TYPE_ID(N'uniqueidentifier'))
    ALTER TABLE app.DeviceToken ALTER COLUMN DeviceId VARCHAR(64) NOT NULL;
GO

-- One current row per user and device. Two people signing in on a shared
-- phone send the same device ID, so it's unique per user.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_DeviceToken_LiveDevice')
CREATE UNIQUE INDEX UX_DeviceToken_LiveDevice
    ON app.DeviceToken (UserEmail, DeviceId) WHERE Status <> 'Inactive';
GO

-- Who is emailed when someone taps "Get token". Read by the API on every
-- request, so changes need no redeploy (app.usp_Device_SetRecipient).
IF OBJECT_ID(N'app.DeviceTokenRecipient', N'U') IS NULL
BEGIN
    CREATE TABLE app.DeviceTokenRecipient (
        Email       NVARCHAR(255) NOT NULL PRIMARY KEY,
        IsActive    BIT           NOT NULL DEFAULT 1,
        ChangedBy   NVARCHAR(128) NOT NULL DEFAULT SUSER_SNAME(),
        ChangedUtc  DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
    );

    INSERT INTO app.DeviceTokenRecipient (Email)
    VALUES (N'keerthana.gopinath@hajery.com'), (N'sherin.mathew@hajery.com');
END;
GO

-- Previous design (activation codes, one device per user).
IF OBJECT_ID(N'app.DeviceActivationCode', N'U') IS NOT NULL DROP TABLE app.DeviceActivationCode;
IF OBJECT_ID(N'app.UserDevice', N'U') IS NOT NULL DROP TABLE app.UserDevice;
GO

-- The API service account needs (uncomment in prod):
-- GRANT SELECT, INSERT, UPDATE ON app.DeviceToken          TO [HajeryPulseApiServiceAccount];
-- GRANT SELECT                 ON app.DeviceTokenRecipient TO [HajeryPulseApiServiceAccount];
-- GRANT SELECT, UPDATE         ON dim.[User]      TO [HajeryPulseApiServiceAccount];

PRINT 'Device token tables created.';
