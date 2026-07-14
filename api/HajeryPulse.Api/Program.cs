using HajeryPulse.Api.Auth;
using HajeryPulse.Api.Data;
using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Middleware;
using HajeryPulse.Api.Services;
using Microsoft.Data.SqlClient;
using Microsoft.Identity.Web;
using Serilog;
using StackExchange.Redis;
using Microsoft.AspNetCore.Authentication.JwtBearer; 


var builder = WebApplication.CreateBuilder(args);
builder.Services.AddLogging();

// ---------- Logging ----------
builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/hajery-pulse-.log", rollingInterval: RollingInterval.Day));


// ---------- Auth ----------
// Real Entra ID validation. Settings come from appsettings.json under "EntraId":
// TenantId, ClientId, Audience. Fill those in with the values from your API
// app registration before this will actually validate tokens.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("EntraId"));

builder.Services.AddAuthorization(options =>
{
    // TODO: restore real role checks once role source (App Roles vs groups)
    // is decided: RequireRole("ceo","cfo","approver_lpo") etc.
    // For now, any authenticated user has full access to every screen.
    options.AddPolicy("ApproveLpo",   p => p.RequireAuthenticatedUser());
    options.AddPolicy("ApproveAsset", p => p.RequireAuthenticatedUser());
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
builder.Services.AddScoped<IHomeRepository,    HomeRepository>();
builder.Services.AddHttpClient<IInboxRepository, InboxRepository>(client =>
{
    client.BaseAddress = new Uri("http://192.168.10.147:8086/");
});
// ---------- Services ----------
//builder.Services.AddScoped<ICacheService,   RedisCacheService>();
builder.Services.AddScoped<ISalesService,   SalesService>();
builder.Services.AddScoped<IPharmaService,  PharmaService>();
builder.Services.AddScoped<IFBService,      FBService>();
builder.Services.AddScoped<IFinanceService, FinanceService>();
builder.Services.AddScoped<IInboxService, InboxService>();
builder.Services.AddScoped<IHomeService,    HomeService>();

// ---------- API + Swagger ----------
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Hajery Pulse API", Version = "v1" });
});

var app = builder.Build();

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