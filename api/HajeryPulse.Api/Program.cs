using HajeryPulse.Api.Auth;
using HajeryPulse.Api.Data;
using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Middleware;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.SqlClient;
using Microsoft.Identity.Web;
using Serilog;
using StackExchange.Redis;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddLogging();

// ---------- Logging ----------
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/hajery-pulse-.log", rollingInterval: RollingInterval.Day));


// ---------- Auth ----------
// Registers JWT bearer with Entra ID. The settings come from appsettings.json
// under the "EntraId" section: TenantId, ClientId, Audience, Authority.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)

.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateIssuerSigningKey = true,
        RoleClaimType = ClaimTypes.Role,
        NameClaimType = ClaimTypes.Name,
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
            System.Text.Encoding.UTF8.GetBytes("TTHIS_IS_MY_DEV_SECRET_KEY_1234567890"))
    };
});

//.AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("EntraId"));

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ApproveLpo",   p => p.RequireRole("ceo", "cfo", "approver_lpo"));
    options.AddPolicy("ApproveAsset", p => p.RequireRole("ceo", "cfo", "approver_asset"));
    options.AddPolicy("ViewSales",    p => p.RequireAuthenticatedUser());
});

// ---------- CORS ----------
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:3000", "https://app.hajerypulse.internal")
    .AllowAnyHeader().AllowAnyMethod()));

// ---------- Health checks ----------
var sqlConnString   = builder.Configuration.GetConnectionString("ReportingDb")!;
//var redisConnString = builder.Configuration.GetConnectionString("Redis")!;
builder.Services.AddHealthChecks()
    .AddSqlServer(sqlConnString, name: "reporting-db");
   // .AddRedis(redisConnString,   name: "redis-cache");

// ---------- Data + cache ----------
//builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
//    ConnectionMultiplexer.Connect(redisConnString));
builder.Services.AddScoped<SqlConnection>(_ => new SqlConnection(sqlConnString));
builder.Services.AddScoped<IDbConnectionFactory, DbConnectionFactory>();

// ---------- Repositories ----------
builder.Services.AddScoped<ISalesRepository,   SalesRepository>();
builder.Services.AddScoped<IPharmaRepository,  PharmaRepository>();
builder.Services.AddScoped<IFBRepository,      FBRepository>();
builder.Services.AddScoped<IFinanceRepository, FinanceRepository>();
builder.Services.AddScoped<IInboxRepository,   InboxRepository>();

// ---------- Services ----------
//builder.Services.AddScoped<ICacheService,   RedisCacheService>();
builder.Services.AddScoped<ISalesService,   SalesService>();
builder.Services.AddScoped<IPharmaService,  PharmaService>();
builder.Services.AddScoped<IFBService,      FBService>();
builder.Services.AddScoped<IFinanceService, FinanceService>();
builder.Services.AddScoped<IInboxService,   InboxService>();

// ---------- API + Swagger ----------
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Hajery Pulse API", Version = "v1" });
});

var app = builder.Build();

// ---------- Pipeline ----------
// ---------- Pipeline ----------
app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<AuditLogMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

//app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();
