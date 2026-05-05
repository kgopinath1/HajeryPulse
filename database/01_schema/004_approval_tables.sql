/* ============================================================================
   Script 004: Approval workflow tables (LPO, asset, expense, HR).
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

-- ============================================================================
-- app.ApprovalRequest — header
-- ============================================================================
IF OBJECT_ID(N'app.ApprovalRequest', N'U') IS NULL
CREATE TABLE app.ApprovalRequest (
    RequestId         NVARCHAR(40)  NOT NULL PRIMARY KEY,    -- e.g. 'LPO-2026-1042'
    [Type]            NVARCHAR(20)  NOT NULL CHECK ([Type] IN ('lpo','asset','expense','hr')),
    Title             NVARCHAR(400) NOT NULL,
    [Description]     NVARCHAR(MAX) NULL,
    AmountKwd         DECIMAL(18,3) NOT NULL,
    RequesterUserKey  INT           NOT NULL REFERENCES dim.[User](UserKey),
    BuCode            NVARCHAR(20)  NOT NULL,
    [Status]          NVARCHAR(20)  NOT NULL DEFAULT 'Pending'
                          CHECK ([Status] IN ('Pending','Approved','Rejected','Clarification')),
    SubmittedAt       DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
    DecidedAt         DATETIME2(0)  NULL,
    DeciderUserKey    INT           NULL REFERENCES dim.[User](UserKey),
    Comment           NVARCHAR(MAX) NULL,

    INDEX IX_ApprovalRequest_StatusBu (Status, BuCode, SubmittedAt DESC) INCLUDE (Type, AmountKwd, Title)
);
GO

-- ============================================================================
-- app.ApprovalLineItem — line items for LPOs
-- ============================================================================
IF OBJECT_ID(N'app.ApprovalLineItem', N'U') IS NULL
CREATE TABLE app.ApprovalLineItem (
    LineItemKey      BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RequestId        NVARCHAR(40)   NOT NULL REFERENCES app.ApprovalRequest(RequestId) ON DELETE CASCADE,
    ItemNo           INT            NOT NULL,
    [Description]    NVARCHAR(400)  NOT NULL,
    Qty              DECIMAL(12,2)  NOT NULL,
    UnitPriceKwd     DECIMAL(18,3)  NOT NULL,
    Vendor           NVARCHAR(200)  NULL,
    UNIQUE (RequestId, ItemNo)
);
GO

-- ============================================================================
-- app.ApprovalAttachment
-- ============================================================================
IF OBJECT_ID(N'app.ApprovalAttachment', N'U') IS NULL
CREATE TABLE app.ApprovalAttachment (
    AttachmentKey BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RequestId     NVARCHAR(40)  NOT NULL REFERENCES app.ApprovalRequest(RequestId) ON DELETE CASCADE,
    FileName      NVARCHAR(400) NOT NULL,
    SizeBytes     BIGINT        NOT NULL,
    Url           NVARCHAR(800) NOT NULL,
    UploadedAt    DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ============================================================================
-- app.ApprovalHistory — append-only timeline
-- ============================================================================
IF OBJECT_ID(N'app.ApprovalHistory', N'U') IS NULL
CREATE TABLE app.ApprovalHistory (
    HistoryKey  BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RequestId   NVARCHAR(40) NOT NULL REFERENCES app.ApprovalRequest(RequestId) ON DELETE CASCADE,
    OccurredAt  DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
    UserKey     INT          NOT NULL REFERENCES dim.[User](UserKey),
    [Action]    NVARCHAR(40) NOT NULL,    -- 'Submitted', 'Approved', 'Rejected', 'Clarification', 'Replied'
    Comment     NVARCHAR(MAX) NULL,
    INDEX IX_ApprovalHistory_Request (RequestId, OccurredAt DESC)
);
GO

PRINT 'Approval workflow tables created.';
