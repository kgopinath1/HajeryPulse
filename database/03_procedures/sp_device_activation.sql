/* ============================================================================
   Users and device tokens — procedures for IT (run from SSMS).

     -- Give someone access (or re-enable them). Only users here, with
     -- IsActive = 1, get past the app's sign-in.
     EXEC app.usp_User_Add @Email = N'someone@hajery.com', @DisplayName = N'Some One';

     -- Take access away. Also turns off all their devices.
     EXEC app.usp_User_SetActive @Email = N'someone@hajery.com', @IsActive = 0;

     -- Token requests waiting for IT (the email IT receives has the same ID):
     EXEC app.usp_Device_Requests;

     -- Issue a token for a request (valid 2 hours to enter). Give the token
     -- to the user. Running it again replaces the earlier token.
     EXEC app.usp_Device_IssueToken @RequestId = 12;

     -- A user's devices (no arguments = every active device):
     EXEC app.usp_Device_List @Email = N'someone@hajery.com';

     -- Lost/stolen phone: turn off one device (ID from usp_Device_List), or
     -- all of a user's devices.
     EXEC app.usp_Device_Deactivate @DeviceTokenId = 12, @Reason = N'Phone lost';
     EXEC app.usp_Device_Deactivate @Email = N'someone@hajery.com';

     -- Who gets the "Get token" emails (takes effect immediately):
     EXEC app.usp_Device_Recipients;
     EXEC app.usp_Device_SetRecipient @Email = N'someone@hajery.com';                  -- add
     EXEC app.usp_Device_SetRecipient @Email = N'someone@hajery.com', @IsActive = 0;   -- stop

   A user can have up to 2 active devices. A token belongs to one device:
   after a reinstall the same token works again (iOS keeps it; on Android
   the user re-enters it), so keep it like a password. Tokens use 8 characters from an
   alphabet without look-alikes (no 0/O, 1/I), shown as XXXX-XXXX. Only the
   SHA-256 hash is stored; the API hashes what the user types the same way.
   A token locks after 5 wrong attempts.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- Previous design (activation codes).
DROP PROCEDURE IF EXISTS app.usp_Device_GenerateActivationCode;
DROP PROCEDURE IF EXISTS app.usp_Device_Revoke;
DROP PROCEDURE IF EXISTS app.usp_Device_CancelCodes;
DROP FUNCTION  IF EXISTS app.fn_Device_ResolveUser;
GO

CREATE OR ALTER PROCEDURE app.usp_User_Add
    @Email       NVARCHAR(255),
    @DisplayName NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SET @Email = LOWER(LTRIM(RTRIM(@Email)));
    IF @Email IS NULL OR @Email NOT LIKE N'_%@_%'
        THROW 50001, 'Pass the user''s email address as @Email.', 1;
    SET @DisplayName = NULLIF(LTRIM(RTRIM(@DisplayName)), N'');

    IF EXISTS (SELECT 1 FROM dim.[User] WHERE Email = @Email)
        UPDATE dim.[User]
           SET IsActive = 1, DisplayName = COALESCE(@DisplayName, DisplayName)
         WHERE Email = @Email;
    ELSE
        INSERT INTO dim.[User] (Email, DisplayName) VALUES (@Email, COALESCE(@DisplayName, @Email));

    SELECT UserKey, Email, DisplayName, IsActive FROM dim.[User] WHERE Email = @Email;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_User_SetActive
    @Email    NVARCHAR(255),
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dim.[User] WHERE Email = @Email)
        THROW 50003, 'No user with that email in dim.[User].', 1;

    BEGIN TRANSACTION;
        UPDATE dim.[User] SET IsActive = @IsActive WHERE Email = @Email;

        DECLARE @DevicesDeactivated INT = 0;
        IF @IsActive = 0
        BEGIN
            UPDATE app.DeviceToken
               SET Status = 'Inactive', InactiveUtc = SYSUTCDATETIME(), InactiveReason = N'User deactivated'
             WHERE UserEmail = @Email AND Status <> 'Inactive';
            SET @DevicesDeactivated = @@ROWCOUNT;
        END;
    COMMIT;

    SELECT Email, IsActive, DevicesDeactivated = @DevicesDeactivated FROM dim.[User] WHERE Email = @Email;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_Requests
AS
BEGIN
    SET NOCOUNT ON;

    SELECT RequestId       = t.DeviceTokenId,
           t.UserEmail, u.DisplayName, t.Platform, t.DeviceName,
           Status          = CASE
                                 WHEN t.Status = 'Requested'               THEN 'Waiting for IT'
                                 WHEN t.FailedAttempts >= 5                THEN 'Token locked'
                                 WHEN t.TokenExpiresUtc < SYSUTCDATETIME() THEN 'Token expired'
                                 ELSE 'Token issued'
                             END,
           ActiveDevices   = (SELECT COUNT(*) FROM app.DeviceToken a WHERE a.UserEmail = t.UserEmail AND a.Status = 'Active'),
           RequestedKuwait = DATEADD(HOUR, 3, t.RequestedUtc),
           IssuedKuwait    = DATEADD(HOUR, 3, t.IssuedUtc),
           ExpiresKuwait   = DATEADD(HOUR, 3, t.TokenExpiresUtc)
      FROM app.DeviceToken t
      LEFT JOIN dim.[User] u ON u.Email = t.UserEmail
     WHERE t.Status IN ('Requested', 'Issued')
     ORDER BY t.RequestedUtc DESC;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_IssueToken
    @RequestId        INT,
    @ValidHours       INT = 2,
    @MaxActiveDevices INT = 2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @ValidHours NOT BETWEEN 1 AND 48
        THROW 50002, '@ValidHours must be between 1 and 48.', 1;

    DECLARE @Email NVARCHAR(255), @Status VARCHAR(10), @Message NVARCHAR(2048);
    SELECT @Email = UserEmail, @Status = Status FROM app.DeviceToken WHERE DeviceTokenId = @RequestId;

    IF @Email IS NULL
        THROW 50011, 'No request with that ID. EXEC app.usp_Device_Requests lists the open ones.', 1;
    IF @Status = 'Active'
        THROW 50012, 'That device is already active. If the user lost the token, they tap "Get token" again, which opens a new request for it.', 1;
    IF @Status = 'Inactive'
        THROW 50013, 'That request was turned off. The user needs to tap "Get token" again.', 1;
    IF NOT EXISTS (SELECT 1 FROM dim.[User] WHERE Email = @Email AND IsActive = 1)
    BEGIN
        SET @Message = CONCAT(@Email, N' isn''t an active user. Enable them first: EXEC app.usp_User_Add @Email = N''', @Email, N''';');
        THROW 50014, @Message, 1;
    END;
    IF (SELECT COUNT(*) FROM app.DeviceToken WHERE UserEmail = @Email AND Status = 'Active') >= @MaxActiveDevices
    BEGIN
        SET @Message = CONCAT(@Email, N' already has ', @MaxActiveDevices, N' active devices. Turn one off first: EXEC app.usp_Device_List @Email = N''', @Email,
                              N'''; then EXEC app.usp_Device_Deactivate @DeviceTokenId = <ID>;');
        THROW 50010, @Message, 1;
    END;

    -- 8 random characters from a 32-letter alphabet. 256 is a multiple of 32,
    -- so byte % 32 picks every letter with equal probability.
    DECLARE @Alphabet CHAR(32)     = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    DECLARE @Random   VARBINARY(8) = CRYPT_GEN_RANDOM(8);
    DECLARE @Token    VARCHAR(8)   = '';
    DECLARE @i        INT          = 1;
    WHILE @i <= 8
    BEGIN
        SET @Token += SUBSTRING(@Alphabet, CAST(SUBSTRING(@Random, @i, 1) AS INT) % 32 + 1, 1);
        SET @i += 1;
    END;

    DECLARE @Now     DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @Expires DATETIME2(0) = DATEADD(HOUR, @ValidHours, @Now);

    UPDATE app.DeviceToken
       SET Status = 'Issued', TokenHash = HASHBYTES('SHA2_256', @Token), FailedAttempts = 0,
           IssuedUtc = @Now, IssuedBy = SUSER_SNAME(), TokenExpiresUtc = @Expires
     WHERE DeviceTokenId = @RequestId AND Status IN ('Requested', 'Issued');

    SELECT Token         = LEFT(@Token, 4) + '-' + RIGHT(@Token, 4),
           t.UserEmail, u.DisplayName, t.Platform, t.DeviceName,
           ExpiresKuwait = DATEADD(HOUR, 3, @Expires),
           ExpiresUtc    = @Expires
      FROM app.DeviceToken t
      LEFT JOIN dim.[User] u ON u.Email = t.UserEmail
     WHERE t.DeviceTokenId = @RequestId;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_List
    @Email NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DeviceTokenId, t.UserEmail, u.DisplayName, t.Platform, t.DeviceName, t.DeviceId,
           Status          = CASE
                                 WHEN t.Status = 'Requested'                                    THEN 'Waiting for IT'
                                 WHEN t.Status = 'Issued' AND t.FailedAttempts >= 5             THEN 'Token locked'
                                 WHEN t.Status = 'Issued' AND t.TokenExpiresUtc < SYSUTCDATETIME() THEN 'Token expired'
                                 WHEN t.Status = 'Issued'                                       THEN 'Token issued'
                                 ELSE t.Status
                             END,
           RequestedKuwait = DATEADD(HOUR, 3, t.RequestedUtc),
           ActivatedKuwait = DATEADD(HOUR, 3, t.ActivatedUtc),
           LastSeenKuwait  = DATEADD(HOUR, 3, t.LastSeenUtc),
           InactiveKuwait  = DATEADD(HOUR, 3, t.InactiveUtc),
           t.InactiveReason
      FROM app.DeviceToken t
      LEFT JOIN dim.[User] u ON u.Email = t.UserEmail
     WHERE (@Email IS NULL AND t.Status = 'Active') OR t.UserEmail = @Email
     ORDER BY t.UserEmail, t.DeviceTokenId DESC;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_Deactivate
    @DeviceTokenId INT           = NULL,
    @Email         NVARCHAR(255) = NULL,
    @Reason        NVARCHAR(200) = N'Turned off by IT'
AS
BEGIN
    SET NOCOUNT ON;

    IF @DeviceTokenId IS NULL AND @Email IS NULL
        THROW 50001, 'Pass @DeviceTokenId (from app.usp_Device_List) for one device, or @Email for all of a user''s devices.', 1;

    UPDATE app.DeviceToken
       SET Status = 'Inactive', InactiveUtc = SYSUTCDATETIME(), InactiveReason = @Reason
     WHERE Status <> 'Inactive'
       AND (DeviceTokenId = @DeviceTokenId OR (@DeviceTokenId IS NULL AND UserEmail = @Email));

    SELECT DevicesDeactivated = @@ROWCOUNT;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_Recipients
AS
BEGIN
    SET NOCOUNT ON;

    SELECT Email, IsActive, ChangedBy, ChangedKuwait = DATEADD(HOUR, 3, ChangedUtc)
      FROM app.DeviceTokenRecipient
     ORDER BY IsActive DESC, Email;
END;
GO

CREATE OR ALTER PROCEDURE app.usp_Device_SetRecipient
    @Email    NVARCHAR(255),
    @IsActive BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    SET @Email = LOWER(LTRIM(RTRIM(@Email)));
    IF @Email IS NULL OR @Email NOT LIKE N'_%@_%._%'
        THROW 50001, 'Pass an email address as @Email.', 1;

    IF EXISTS (SELECT 1 FROM app.DeviceTokenRecipient WHERE Email = @Email)
        UPDATE app.DeviceTokenRecipient
           SET IsActive = @IsActive, ChangedBy = SUSER_SNAME(), ChangedUtc = SYSUTCDATETIME()
         WHERE Email = @Email;
    ELSE
        INSERT INTO app.DeviceTokenRecipient (Email, IsActive) VALUES (@Email, @IsActive);

    IF NOT EXISTS (SELECT 1 FROM app.DeviceTokenRecipient WHERE IsActive = 1)
        PRINT 'Warning: nobody is emailed about token requests now. They still appear in EXEC app.usp_Device_Requests.';

    EXEC app.usp_Device_Recipients;
END;
GO

PRINT 'User and device token procedures created.';
