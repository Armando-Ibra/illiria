# Build context: repository root.  docker build -f deploy/api.Dockerfile .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json Directory.Build.props Directory.Packages.props .editorconfig ./
COPY src/Illiria.Api/Illiria.Api.csproj src/Illiria.Api/
RUN dotnet restore src/Illiria.Api/Illiria.Api.csproj
COPY src/ src/
RUN dotnet publish src/Illiria.Api/Illiria.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .
# Non-root user shipped with the official image.
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
# `docker run <image> migrate` applies migrations and exits; no argument serves the API.
ENTRYPOINT ["dotnet", "Illiria.Api.dll"]
