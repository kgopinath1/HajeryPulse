/* ============================================================================
   Script 007: dim.[User] is keyed by email.

   Access is granted by adding a user's email to dim.[User] (IsActive = 1).
   The Entra Object ID isn't used any more, so EntraObjectId is dropped and
   Email becomes unique.

   Safe to re-run.
   ============================================================================ */
USE HajeryPulse_Reporting;
GO

IF EXISTS (SELECT 1 FROM dim.[User] GROUP BY Email HAVING COUNT(*) > 1)
    THROW 50020, 'dim.[User] has duplicate emails. Remove the duplicates (SELECT Email FROM dim.[User] GROUP BY Email HAVING COUNT(*) > 1) and run this script again.', 1;
GO

-- Constraints and indexes on EntraObjectId have to go before the column.
DECLARE @Constraint SYSNAME = (
    SELECT kc.name
      FROM sys.key_constraints kc
      JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
      JOIN sys.columns c        ON c.object_id = ic.object_id AND c.column_id = ic.column_id
     WHERE kc.parent_object_id = OBJECT_ID(N'dim.[User]') AND kc.type = 'UQ' AND c.name = N'EntraObjectId');
IF @Constraint IS NOT NULL
    EXEC(N'ALTER TABLE dim.[User] DROP CONSTRAINT ' + @Constraint);
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_User_EntraObjectId' AND object_id = OBJECT_ID(N'dim.[User]'))
    DROP INDEX UX_User_EntraObjectId ON dim.[User];
GO

IF COL_LENGTH(N'dim.[User]', N'EntraObjectId') IS NOT NULL
    ALTER TABLE dim.[User] DROP COLUMN EntraObjectId;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_User_Email')
CREATE UNIQUE INDEX UX_User_Email ON dim.[User] (Email);
GO

PRINT 'dim.[User] keyed by email.';
