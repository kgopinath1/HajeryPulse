/* ============================================================================
   Script 033: Inbox + Finance/Ops stored procedures.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- ============================================================================
-- sp_GetInbox — list approval requests visible to the current user
-- Filters by user's ScopedBuCodes (JSON array in dim.User).
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetInbox
    @UserEntraId UNIQUEIDENTIFIER,
    @Status      NVARCHAR(20) = 'Pending',
    @Limit       INT = 50
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @userKey INT, @scopedBuJson NVARCHAR(MAX);
    SELECT @userKey = UserKey, @scopedBuJson = ScopedBuCodes
    FROM dim.[User] WHERE EntraObjectId = @UserEntraId AND IsActive = 1;

    IF @userKey IS NULL
    BEGIN
        -- Unknown user — return empty result
        SELECT TOP 0
            CAST(NULL AS NVARCHAR(40)) AS Id,
            CAST(NULL AS NVARCHAR(20)) AS [Type],
            CAST(NULL AS NVARCHAR(400)) AS Title,
            CAST(NULL AS DECIMAL(18,3)) AS AmountKwd,
            CAST(NULL AS NVARCHAR(200)) AS Requester,
            CAST(NULL AS DATETIME2(0))  AS SubmittedAt,
            CAST(NULL AS NVARCHAR(20))  AS Status;
        RETURN;
    END

    -- Empty array means CEO/CFO scope (sees all). Non-empty restricts.
    DECLARE @hasScope BIT =
        CASE WHEN @scopedBuJson IS NULL OR @scopedBuJson = N'[]' THEN 0 ELSE 1 END;

    SELECT TOP (@Limit)
        r.RequestId   AS Id,
        r.[Type]      AS [Type],
        r.Title       AS Title,
        r.AmountKwd   AS AmountKwd,
        u.DisplayName AS Requester,
        r.SubmittedAt AS SubmittedAt,
        r.[Status]    AS [Status]
    FROM app.ApprovalRequest r
    JOIN dim.[User]          u ON u.UserKey = r.RequesterUserKey
    WHERE (@Status = 'all' OR r.[Status] = @Status)
      AND ( @hasScope = 0
         OR EXISTS (
              SELECT 1 FROM OPENJSON(@scopedBuJson) WITH (BuCode NVARCHAR(20) '$') sc
              WHERE sc.BuCode = r.BuCode
            )
          )
    ORDER BY r.SubmittedAt DESC;
END;
GO

-- ============================================================================
-- sp_GetApprovalDetail
-- Returns: 1) request header, 2) line items, 3) attachments, 4) history
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetApprovalDetail
    @UserEntraId UNIQUEIDENTIFIER,
    @RequestId   NVARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;

    -- Header
    SELECT
        r.RequestId      AS Id,
        r.[Type]         AS [Type],
        r.Title          AS Title,
        r.[Description]  AS [Description],
        r.AmountKwd      AS AmountKwd,
        u.DisplayName    AS Requester,
        r.BuCode         AS BuCode,
        r.SubmittedAt    AS SubmittedAt,
        r.[Status]       AS [Status]
    FROM app.ApprovalRequest r
    JOIN dim.[User] u ON u.UserKey = r.RequesterUserKey
    WHERE r.RequestId = @RequestId;

    -- Line items
    SELECT ItemNo, [Description], Qty, UnitPriceKwd, Vendor
    FROM app.ApprovalLineItem
    WHERE RequestId = @RequestId
    ORDER BY ItemNo;

    -- Attachments
    SELECT FileName, SizeBytes, Url
    FROM app.ApprovalAttachment
    WHERE RequestId = @RequestId
    ORDER BY UploadedAt;

    -- History
    SELECT h.OccurredAt, u.DisplayName AS [User], h.[Action], h.Comment
    FROM app.ApprovalHistory h
    JOIN dim.[User]          u ON u.UserKey = h.UserKey
    WHERE h.RequestId = @RequestId
    ORDER BY h.OccurredAt;
END;
GO

-- ============================================================================
-- sp_ApproveRequest, sp_RejectRequest, sp_ClarifyRequest
-- All wrap the same audit-friendly transactional update.
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_ApproveRequest
    @UserEntraId UNIQUEIDENTIFIER,
    @RequestId   NVARCHAR(40),
    @Comment     NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;
        DECLARE @userKey INT = (SELECT UserKey FROM dim.[User] WHERE EntraObjectId = @UserEntraId);
        IF @userKey IS NULL THROW 51010, 'Unknown user', 1;

        UPDATE app.ApprovalRequest
        SET [Status] = 'Approved',
            DecidedAt = SYSUTCDATETIME(),
            DeciderUserKey = @userKey,
            Comment = @Comment
        WHERE RequestId = @RequestId AND [Status] = 'Pending';

        IF @@ROWCOUNT = 0 THROW 51011, 'Request not found or already decided', 1;

        INSERT INTO app.ApprovalHistory (RequestId, UserKey, [Action], Comment)
        VALUES (@RequestId, @userKey, 'Approved', @Comment);

        SELECT RequestId AS Id, [Status], DecidedAt
        FROM app.ApprovalRequest WHERE RequestId = @RequestId;
    COMMIT;
END;
GO

CREATE OR ALTER PROCEDURE app.sp_RejectRequest
    @UserEntraId UNIQUEIDENTIFIER,
    @RequestId   NVARCHAR(40),
    @Comment     NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;
        DECLARE @userKey INT = (SELECT UserKey FROM dim.[User] WHERE EntraObjectId = @UserEntraId);
        IF @userKey IS NULL THROW 51010, 'Unknown user', 1;

        UPDATE app.ApprovalRequest
        SET [Status] = 'Rejected',
            DecidedAt = SYSUTCDATETIME(),
            DeciderUserKey = @userKey,
            Comment = @Comment
        WHERE RequestId = @RequestId AND [Status] = 'Pending';

        IF @@ROWCOUNT = 0 THROW 51011, 'Request not found or already decided', 1;

        INSERT INTO app.ApprovalHistory (RequestId, UserKey, [Action], Comment)
        VALUES (@RequestId, @userKey, 'Rejected', @Comment);

        SELECT RequestId AS Id, [Status], DecidedAt
        FROM app.ApprovalRequest WHERE RequestId = @RequestId;
    COMMIT;
END;
GO

CREATE OR ALTER PROCEDURE app.sp_ClarifyRequest
    @UserEntraId UNIQUEIDENTIFIER,
    @RequestId   NVARCHAR(40),
    @Question    NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;
        DECLARE @userKey INT = (SELECT UserKey FROM dim.[User] WHERE EntraObjectId = @UserEntraId);
        IF @userKey IS NULL THROW 51010, 'Unknown user', 1;

        UPDATE app.ApprovalRequest
        SET [Status] = 'Clarification'
        WHERE RequestId = @RequestId AND [Status] = 'Pending';

        IF @@ROWCOUNT = 0 THROW 51011, 'Request not found or already decided', 1;

        INSERT INTO app.ApprovalHistory (RequestId, UserKey, [Action], Comment)
        VALUES (@RequestId, @userKey, 'Clarification', @Question);

        SELECT RequestId AS Id, [Status], CAST(SYSUTCDATETIME() AS DATETIME2(0)) AS DecidedAt
        FROM app.ApprovalRequest WHERE RequestId = @RequestId;
    COMMIT;
END;
GO

-- ============================================================================
-- Finance & Ops snapshot retrieval
-- ============================================================================
CREATE OR ALTER PROCEDURE app.sp_GetFinanceHealth
    @AsOfDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));

    SELECT TOP 1
        GrossMarginPct, TargetPct, PreviousPct,
        ArDaysOutstanding, ApDaysOutstanding,
        WorkingCapitalKwd / 1000.0 AS WorkingCapitalKwd,
        CashOnHandKwd     / 1000.0 AS CashOnHandKwd
    FROM fact.FinanceSnapshot
    WHERE DateKey <= @asOfKey
    ORDER BY DateKey DESC;
END;
GO

CREATE OR ALTER PROCEDURE app.sp_GetOpsSummary
    @AsOfDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @asOfKey INT = CONVERT(INT, FORMAT(@AsOfDate, 'yyyyMMdd'));

    SELECT TOP 1
        FillRatePct, SlaCompliancePct,
        AvgDispatchHours, OpenServiceTickets
    FROM fact.FinanceSnapshot
    WHERE DateKey <= @asOfKey
    ORDER BY DateKey DESC;
END;
GO

PRINT 'Inbox & Finance/Ops stored procedures created.';
