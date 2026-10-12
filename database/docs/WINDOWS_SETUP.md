# Windows database setup

Run these PowerShell commands from the repository root. The verified local result is recorded in [VALIDATION.md](VALIDATION.md). Reuse existing credentials and volumes. This guide applies the supplied migration; it does not regenerate the schema.

## Prerequisites and checkout

```powershell
git branch --show-current
git status --short
git --version
py -3.12 --version
docker version
docker compose version
```

The branch must be `database`. Use Python 3.12 and Docker Desktop with its Linux engine running; `docker version` must show a working server. Preserve unrelated working-tree changes. Read [AGENTS.md](../../AGENTS.md), the [README](../README.md) and [backend contract](BACKEND_CONTRACT.md) before setup.

## Python environment

Create the virtual environment only if absent, then install the supplied requirements. Activation and execution-policy changes are unnecessary.

```powershell
if (-not (Test-Path .\database\.venv\Scripts\python.exe)) {
    py -3.12 -m venv database/.venv
    if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed.' }
}
& .\database\.venv\Scripts\python.exe --version
& .\database\.venv\Scripts\python.exe -m pip install -r database/requirements-test.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
& .\database\.venv\Scripts\python.exe -m pip check
```

## Local credentials

The following creates `database/.env` only if absent. Do not display or commit that file. Before first startup, check whether the project's volume already exists; if it does and the credentials file is missing, recover the existing credentials instead of generating replacements.

```powershell
docker volume ls --filter label=com.docker.compose.project=yes4041
if (-not (Test-Path .\database\.env)) {
    $existingVolume = docker volume ls --filter name=^yes4041_yes4041_data$ --format '{{.Name}}'
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Docker volumes.' }
    if ($existingVolume) { throw 'Recover the existing volume credentials before continuing.' }
    git check-ignore -q database/.env
    if ($LASTEXITCODE -ne 0) { throw 'Local credentials path must be ignored.' }
    $dbPassword = & .\database\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(24))"
    if ($LASTEXITCODE -ne 0 -or $dbPassword -notmatch '^[0-9a-f]{48}$') {
        throw 'Password generation failed.'
    }
    @("POSTGRES_PASSWORD=$dbPassword", 'POSTGRES_PORT=5433') |
        Set-Content -LiteralPath .\database\.env -Encoding ascii
    Remove-Variable dbPassword
}
git check-ignore database/.env database/.venv/
```

Load connections privately in each new PowerShell session. This expects the simple unquoted `.env` format above. The migration connection targets `yes4041`; the test connection targets `postgres` on this dedicated local server.

```powershell
$dbConfig = Get-Content -Raw .\database\.env | ConvertFrom-StringData
$dbPasswordEncoded = [Uri]::EscapeDataString($dbConfig.POSTGRES_PASSWORD)
$dbPort = $dbConfig.POSTGRES_PORT
$env:DATABASE_URL = "postgresql://yes4041_migrator:${dbPasswordEncoded}@127.0.0.1:${dbPort}/yes4041"
$env:TEST_DATABASE_URL = "postgresql://yes4041_migrator:${dbPasswordEncoded}@127.0.0.1:${dbPort}/postgres"
Remove-Variable dbConfig, dbPasswordEncoded
```

## Start, migrate and verify

```powershell
docker compose --project-directory database --env-file database/.env -f database/compose.yaml up -d --wait
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL startup failed.' }
docker compose --project-directory database --env-file database/.env -f database/compose.yaml ps
& .\database\.venv\Scripts\python.exe -m alembic -c database/alembic.ini upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Migration failed.' }
& .\database\.venv\Scripts\python.exe -m alembic -c database/alembic.ini current
& .\database\.venv\Scripts\python.exe -m pytest -c database/pytest.ini -q
if ($LASTEXITCODE -ne 0) { throw 'Native PostgreSQL tests failed.' }
```

Expect `0001_initial_model (head)`, 20 domain tables, 141 domain columns, 30 foreign keys and the role codes `admin` and `researcher`. [VALIDATION.md](VALIDATION.md) contains the read-only catalog queries and observed 28-test result. Tests create and remove uniquely named temporary databases; never aim them at a shared or production server. Do not run the raw initial SQL separately or stamp a failed migration.

The local connection is `127.0.0.1:5433`, database `yes4041`, user `yes4041_migrator`, with the password kept in `.env`. This owner is for migrations/tests. Provision a separate non-owner login before connecting Flask, using [application privileges](../ops/application_privileges.sql).

## Troubleshooting and daily use

- Start Docker Desktop if the server is unavailable. Reuse the same Compose command for later starts.
- If port 5433 is occupied, choose an unused loopback port in `.env`, reload the connection variables and retry. Leave other projects alone.
- Authentication failure on an existing volume requires recovering its original credentials. Editing `.env` does not reset the database password.
- Preserve the applied migration. Schema changes require a new Alembic revision and aligned documentation.
- Stop only this service when needed with `docker compose --project-directory database --env-file database/.env -f database/compose.yaml stop`. Do not remove its volume or perform a destructive downgrade during normal setup.
- Record actual failures and results in the validation report. Local tests do not establish GitHub Actions or application acceptance.
