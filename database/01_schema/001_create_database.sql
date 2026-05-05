/* ============================================================================
   Hajery Pulse — Reporting database
   Script 001: create database, schemas, and shared utility objects.
   Idempotent — safe to re-run.
   ============================================================================ */

IF DB_ID(N'HajeryPulse_Reporting') IS NULL
BEGIN
    CREATE DATABASE HajeryPulse_Reporting;
END
GO

USE HajeryPulse_Reporting;
GO

-- Application schemas ---------------------------------------------------------
IF SCHEMA_ID(N'dim')   IS NULL EXEC('CREATE SCHEMA dim   AUTHORIZATION dbo;');
IF SCHEMA_ID(N'fact')  IS NULL EXEC('CREATE SCHEMA fact  AUTHORIZATION dbo;');
IF SCHEMA_ID(N'app')   IS NULL EXEC('CREATE SCHEMA app   AUTHORIZATION dbo;');
IF SCHEMA_ID(N'audit') IS NULL EXEC('CREATE SCHEMA audit AUTHORIZATION dbo;');
IF SCHEMA_ID(N'ref')   IS NULL EXEC('CREATE SCHEMA ref   AUTHORIZATION dbo;');
IF SCHEMA_ID(N'etl')   IS NULL EXEC('CREATE SCHEMA etl   AUTHORIZATION dbo;');
GO

-- Database settings -----------------------------------------------------------
ALTER DATABASE HajeryPulse_Reporting SET COMPATIBILITY_LEVEL = 150;
ALTER DATABASE HajeryPulse_Reporting SET ANSI_NULLS ON;
ALTER DATABASE HajeryPulse_Reporting SET QUOTED_IDENTIFIER ON;
ALTER DATABASE HajeryPulse_Reporting SET RECOVERY FULL;
GO

PRINT 'HajeryPulse_Reporting database and schemas ready.';
