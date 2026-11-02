/* ============================================================================
   Device activation — procedures for IT (run from SSMS).

     -- New activation code (valid 48 hours, single use). Cancels any unused
     -- code the user already had. Give the code to the user.
     EXEC app.usp_Device_GenerateActivationCode @Email = N'someone@hajery.com';

     -- First code for someone not in dim.[User] yet: also pass their Entra
     -- Object ID (and name). They're added to dim.[User], so from then on
     -- the email alone works everywhere.
     EXEC app.usp_Device_GenerateActivationCode @Email = N'someone@hajery.com',
          @UserObjectId = '...', @DisplayName = N'Some One';

     -- A user's devices and codes (no arguments = every active device):
     EXEC app.usp_Device_List @Email = N'someone@hajery.com';

     -- Lost/stolen phone, or leaver: turn off their active device.
     EXEC app.usp_Device_Revoke @Email = N'someone@hajery.com', @Reason = N'Phone lost';

     -- Withdraw a code that hasn't been used yet.
     EXEC app.usp_Device_CancelCodes @Email = N'someone@hajery.com';

   Codes use 8 characters from an alphabet without look-alikes (no 0/O, 1/I),
   shown as XXXX-XXXX. Only the SHA-256 hash is stored; the API hashes what
   the user types the same way. A code locks after 5 wrong attempts.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

/* Looks up a user's Entra Object ID by email in dim.[User]. */
CREATE OR ALTER FUNCTION app.fn_Device_ResolveUser (@Email NVARCHAR(255))
RETURNS UNIQUEIDENTIFIER
AS
BEGIN
    RETURN (SELECT TOP 1 EntraObjectId FROM dim.[User] WHERE Email = @Email AND IsActive = 1);
END;
GO

/* One-off: users who got a code before GenerateActivationCode added them to dim.[User]. */
INSERT INTO dim.[User] (EntraObjectId, Email, DisplayName)
SELECT c.UserObjectId, MAX(c.UserEmail), MAX(c.UserEmail)
  FROM app.DeviceActivationCode c
 WHERE c.UserEmail IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dim.[User] u WHERE u.EntraObjectId = c.UserObjectId)
 GROUP BY c.UserObjectId;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_GenerateActivationCode
    @Email        NVARCHAR(255)    = NULL,
    @UserObjectId UNIQUEIDENTIFIER = NULL,
    @DisplayName  NVARCHAR(200)    = NULL,   -- only used when adding the user to dim.[User]
    @ValidHours   INT              = 48
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Email IS NULL AND @UserObjectId IS NULL
        THROW 50001, 'Pass @Email, or @UserObjectId (the user''s Object ID from Entra ID).', 1;
    IF @ValidHours NOT BETWEEN 1 AND 168
        THROW 50002, '@ValidHours must be between 1 and 168.', 1;

    DECLARE @ExistingOid UNIQUEIDENTIFIER = app.fn_Device_ResolveUser(@Email);
    IF @UserObjectId IS NOT NULL AND @ExistingOid IS NOT NULL AND @ExistingOid <> @UserObjectId
        THROW 50004, 'That email already belongs to a different Object ID in dim.[User]. Check the Object ID in Entra ID.', 1;

    SET @UserObjectId = COALESCE(@UserObjectId, @ExistingOid);
    IF @UserObjectId IS NULL
        THROW 50003, 'No user with that email in dim.[User]. Pass @UserObjectId (the user''s Object ID from Entra ID) as well, and they''ll be added.', 1;

    SET @Email = COALESCE(@Email, (SELECT TOP 1 Email FROM dim.[User] WHERE EntraObjectId = @UserObjectId));
    IF @Email IS NULL
        THROW 50005, 'This user isn''t in dim.[User] yet. Pass @Email as well so they can be added.', 1;

    -- 8 random characters from a 32-letter alphabet. 256 is a multiple of 32,
    -- so byte % 32 picks every letter with equal probability.
    DECLARE @Alphabet CHAR(32)       = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    DECLARE @Random   VARBINARY(8)   = CRYPT_GEN_RANDOM(8);
    DECLARE @Code     VARCHAR(8)     = '';
    DECLARE @i        INT            = 1;
    WHILE @i <= 8
    BEGIN
        SET @Code += SUBSTRING(@Alphabet, CAST(SUBSTRING(@Random, @i, 1) AS INT) % 32 + 1, 1);
        SET @i += 1;
    END;

    DECLARE @Now     DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @Expires DATETIME2(0) = DATEADD(HOUR, @ValidHours, @Now);

    BEGIN TRANSACTION;
        -- Add new users to dim.[User] so email lookups (and audit.Event) work for them.
        IF NOT EXISTS (SELECT 1 FROM dim.[User] WHERE EntraObjectId = @UserObjectId)
            INSERT INTO dim.[User] (EntraObjectId, Email, DisplayName)
            VALUES (@UserObjectId, @Email, COALESCE(NULLIF(LTRIM(RTRIM(@DisplayName)), N''), @Email));

        UPDATE app.DeviceActivationCode
           SET CancelledUtc = @Now
         WHERE UserObjectId = @UserObjectId AND RedeemedUtc IS NULL AND CancelledUtc IS NULL;

        INSERT INTO app.DeviceActivationCode (UserObjectId, UserEmail, CodeHash, CreatedUtc, ExpiresUtc)
        VALUES (@UserObjectId, @Email, HASHBYTES('SHA2_256', @Code), @Now, @Expires);
    COMMIT;

    SELECT ActivationCode  = LEFT(@Code, 4) + '-' + RIGHT(@Code, 4),
           UserEmail       = @Email,
           UserObjectId    = @UserObjectId,
           ExpiresKuwait   = DATEADD(HOUR, 3, @Expires),
           ExpiresUtc      = @Expires;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_List
    @Email        NVARCHAR(255)    = NULL,
    @UserObjectId UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Email IS NULL AND @UserObjectId IS NULL
    BEGIN
        -- Every active device.
        SELECT d.UserObjectId, UserEmail = u.Email, u.DisplayName, d.Platform, d.DeviceName,
               ActivatedKuwait = DATEADD(HOUR, 3, d.ActivatedUtc),
               LastSeenKuwait  = DATEADD(HOUR, 3, d.LastSeenUtc)
          FROM app.UserDevice d
          LEFT JOIN dim.[User] u ON u.EntraObjectId = d.UserObjectId
         WHERE d.RevokedUtc IS NULL
         ORDER BY d.LastSeenUtc DESC;
        RETURN;
    END;

    SET @UserObjectId = COALESCE(@UserObjectId, app.fn_Device_ResolveUser(@Email));
    IF @UserObjectId IS NULL
        THROW 50003, 'No user with that email in dim.[User]. Pass @UserObjectId (the user''s Object ID from Entra ID) instead.', 1;

    SELECT UserDeviceId, Platform, DeviceName,
           Status          = CASE WHEN RevokedUtc IS NULL THEN 'Active' ELSE 'Revoked' END,
           ActivatedKuwait = DATEADD(HOUR, 3, ActivatedUtc),
           LastSeenKuwait  = DATEADD(HOUR, 3, LastSeenUtc),
           RevokedKuwait   = DATEADD(HOUR, 3, RevokedUtc),
           RevokedReason
      FROM app.UserDevice
     WHERE UserObjectId = @UserObjectId
     ORDER BY ActivatedUtc DESC;

    SELECT CodeId, UserEmail, CreatedBy,
           Status = CASE
                        WHEN RedeemedUtc  IS NOT NULL THEN 'Used'
                        WHEN CancelledUtc IS NOT NULL THEN 'Cancelled'
                        WHEN FailedAttempts >= 5      THEN 'Locked'
                        WHEN ExpiresUtc < SYSUTCDATETIME() THEN 'Expired'
                        ELSE 'Waiting'
                    END,
           FailedAttempts,
           CreatedKuwait  = DATEADD(HOUR, 3, CreatedUtc),
           ExpiresKuwait  = DATEADD(HOUR, 3, ExpiresUtc),
           RedeemedKuwait = DATEADD(HOUR, 3, RedeemedUtc)
      FROM app.DeviceActivationCode
     WHERE UserObjectId = @UserObjectId
     ORDER BY CreatedUtc DESC, CodeId DESC;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_Revoke
    @Email        NVARCHAR(255)    = NULL,
    @UserObjectId UNIQUEIDENTIFIER = NULL,
    @Reason       NVARCHAR(200)    = N'Revoked by IT'
AS
BEGIN
    SET NOCOUNT ON;

    IF @Email IS NULL AND @UserObjectId IS NULL
        THROW 50001, 'Pass @Email, or @UserObjectId (the user''s Object ID from Entra ID).', 1;
    SET @UserObjectId = COALESCE(@UserObjectId, app.fn_Device_ResolveUser(@Email));
    IF @UserObjectId IS NULL
        THROW 50003, 'No user with that email in dim.[User]. Pass @UserObjectId (the user''s Object ID from Entra ID) instead.', 1;

    UPDATE app.UserDevice
       SET RevokedUtc = SYSUTCDATETIME(), RevokedReason = @Reason
     WHERE UserObjectId = @UserObjectId AND RevokedUtc IS NULL;

    SELECT DevicesRevoked = @@ROWCOUNT;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_CancelCodes
    @Email        NVARCHAR(255)    = NULL,
    @UserObjectId UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Email IS NULL AND @UserObjectId IS NULL
        THROW 50001, 'Pass @Email, or @UserObjectId (the user''s Object ID from Entra ID).', 1;
    SET @UserObjectId = COALESCE(@UserObjectId, app.fn_Device_ResolveUser(@Email));
    IF @UserObjectId IS NULL
        THROW 50003, 'No user with that email in dim.[User]. Pass @UserObjectId (the user''s Object ID from Entra ID) instead.', 1;

    UPDATE app.DeviceActivationCode
       SET CancelledUtc = SYSUTCDATETIME()
     WHERE UserObjectId = @UserObjectId AND RedeemedUtc IS NULL AND CancelledUtc IS NULL;

    SELECT CodesCancelled = @@ROWCOUNT;
END;
GO

PRINT 'Device activation procedures created.';
