/* ============================================================================
   Script 005: Append-only audit log.
   The API service principal will be granted INSERT only; SELECT is restricted
   to a compliance role. UPDATE and DELETE are denied to all application
   accounts to ensure tamper-evidence.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

IF OBJECT_ID(N'audit.Event', N'U') IS NULL
CREATE TABLE audit.Event (
    EventId      BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OccurredAt   DATETIME2(0)         NOT NULL DEFAULT SYSUTCDATETIME(),
    UserKey      INT                  NULL REFERENCES dim.[User](UserKey),
    EventType    NVARCHAR(40)         NOT NULL,
    EntityType   NVARCHAR(40)         NULL,
    EntityId     NVARCHAR(80)         NULL,
    BeforeJson   NVARCHAR(MAX)        NULL,
    AfterJson    NVARCHAR(MAX)        NULL,
    ClientIp     NVARCHAR(45)         NULL,
    DeviceInfo   NVARCHAR(400)        NULL,
    TraceId      NVARCHAR(80)         NULL,

    INDEX IX_AuditEvent_OccurredAt (OccurredAt DESC),
    INDEX IX_AuditEvent_Entity     (EntityType, EntityId, OccurredAt DESC)
);
GO

-- Lock down to insert-only for service accounts (uncomment in prod)
-- DENY UPDATE, DELETE ON audit.Event TO [HajeryPulseApiServiceAccount];
-- GRANT INSERT ON audit.Event TO [HajeryPulseApiServiceAccount];

PRINT 'Audit log table created.';
