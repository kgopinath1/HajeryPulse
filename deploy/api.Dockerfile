# ============================================================================
# Hajery Pulse API — production Dockerfile
# ============================================================================

# ----- Build stage --------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY api/HajeryPulse.Api.sln ./
COPY api/HajeryPulse.Api/HajeryPulse.Api.csproj ./HajeryPulse.Api/

RUN dotnet restore HajeryPulse.Api/HajeryPulse.Api.csproj

COPY api/. ./
RUN dotnet publish HajeryPulse.Api/HajeryPulse.Api.csproj \
    -c Release -o /app/publish \
    --no-restore

# ----- Runtime stage ------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

# Create logs directory
RUN mkdir -p /app/logs && chown -R app:app /app

ENV ASPNETCORE_URLS=http://+:5001
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 5001

USER app
ENTRYPOINT ["dotnet", "HajeryPulse.Api.dll"]
