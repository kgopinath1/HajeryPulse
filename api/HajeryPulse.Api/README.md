# Hajery Pulse — API

ASP.NET Core 8 (C#) Web API.

## Setup

```bash
dotnet restore
dotnet user-secrets set "ConnectionStrings:ReportingDb" "Server=...;Database=HajeryPulse_Reporting;..."
dotnet user-secrets set "ConnectionStrings:Redis"       "localhost:6379"
dotnet user-secrets set "EntraId:TenantId"              "<your-tenant-id>"
dotnet user-secrets set "EntraId:ClientId"              "<your-api-client-id>"
dotnet run --project HajeryPulse.Api
```

API listens on `https://localhost:7001` (or `:5001` http). Swagger UI at `/swagger`.

## Layout

```
HajeryPulse.Api/
├── Program.cs                  Composition root: DI, middleware pipeline
├── Auth/                       EntraId options
├── Controllers/                REST endpoints
├── Services/                   Business logic (caching, orchestration)
├── Data/                       Connection factory + repositories (Dapper)
├── Models/Dto/                 DTOs returned by the API
├── Middleware/                 Exception, audit log
└── appsettings.json            Connection strings, Entra ID config
```

## Patterns

- **Controller → Service → Repository.** Controllers are thin, services own caching and orchestration, repositories own SQL.
- **Dapper** for SQL Server reads (faster than EF Core for read-heavy reporting).
- **Stored procedures** are the contract — the API never builds dynamic SQL except for trivial filtering.
- **All money fields are DECIMAL(18,3) in the database, returned as `decimal` and serialized to JSON `number`.**

## Testing

```bash
dotnet test
```

Integration tests should run against a Docker SQL Server with the schema scripts loaded.
