/* ============================================================================
   Script 006: Device activation (one activated device per user).

   IT generates a single-use activation code for a user
   (app.usp_Device_GenerateActivationCode). The user enters it in the app on
   first sign-in; the API exchanges it for a random device key that the app
   keeps in the phone's secure storage and sends on every request. Only
   SHA-256 hashes of codes and keys are stored here.

   Activating a new device revokes the user's previous one, so each user has
   at most one active device (enforced by UX_UserDevice_OneActivePerUser).

   Replaces the earlier dbo.Devices allowlist, which can be dropped once this
   is live.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

IF SCHEMA_ID(N'app') IS NULL EXEC('CREATE SCHEMA app AUTHORIZATION dbo;');
GO

IF OBJECT_ID(N'app.UserDevice', N'U') IS NULL
CREATE TABLE app.UserDevice (
    UserDeviceId   INT IDENTITY(1,1)  NOT NULL PRIMARY KEY,
    UserObjectId   UNIQUEIDENTIFIER   NOT NULL,              -- Entra ID object ID (oid)
    KeyHash        VARBINARY(32)      NOT NULL,              -- SHA-256 of the device key
    Platform       NVARCHAR(20)       NULL,                  -- ios / android
    DeviceName     NVARCHAR(200)      NULL,                  -- e.g. "Apple iPhone 15 Pro"
    ActivatedUtc   DATETIME2(0)       NOT NULL DEFAULT SYSUTCDATETIME(),
    LastSeenUtc    DATETIME2(0)       NOT NULL DEFAULT SYSUTCDATETIME(),
    RevokedUtc     DATETIME2(0)       NULL,
    RevokedReason  NVARCHAR(200)      NULL,

    CONSTRAINT UX_UserDevice_KeyHash UNIQUE (KeyHash),
    INDEX IX_UserDevice_User (UserObjectId, ActivatedUtc DESC)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_UserDevice_OneActivePerUser')
CREATE UNIQUE INDEX UX_UserDevice_OneActivePerUser
    ON app.UserDevice (UserObjectId) WHERE RevokedUtc IS NULL;
GO

IF OBJECT_ID(N'app.DeviceActivationCode', N'U') IS NULL
CREATE TABLE app.DeviceActivationCode (
    CodeId                INT IDENTITY(1,1)  NOT NULL PRIMARY KEY,
    UserObjectId          UNIQUEIDENTIFIER   NOT NULL,
    UserEmail             NVARCHAR(255)      NULL,           -- for IT's reference only
    CodeHash              VARBINARY(32)      NOT NULL,       -- SHA-256 of the 8 code characters (no dash)
    CreatedBy             NVARCHAR(128)      NOT NULL DEFAULT SUSER_SNAME(),
    CreatedUtc            DATETIME2(0)       NOT NULL DEFAULT SYSUTCDATETIME(),
    ExpiresUtc            DATETIME2(0)       NOT NULL,
    FailedAttempts        INT                NOT NULL DEFAULT 0,
    RedeemedUtc           DATETIME2(0)       NULL,
    RedeemedUserDeviceId  INT                NULL REFERENCES app.UserDevice(UserDeviceId),
    CancelledUtc          DATETIME2(0)       NULL,

    INDEX IX_DeviceActivationCode_User (UserObjectId, CreatedUtc DESC)
);
GO

-- The API service account needs (uncomment in prod):
-- GRANT SELECT, INSERT, UPDATE ON app.UserDevice           TO [HajeryPulseApiServiceAccount];
-- GRANT SELECT, UPDATE         ON app.DeviceActivationCode TO [HajeryPulseApiServiceAccount];

PRINT 'Device activation tables created.';
