$ErrorActionPreference = "Stop"
$source = $env:BACKUP_SOURCE_DATABASE_URL
$verify = $env:BACKUP_VERIFY_DATABASE_URL
if ([string]::IsNullOrWhiteSpace($source) -or [string]::IsNullOrWhiteSpace($verify)) { throw "Set BACKUP_SOURCE_DATABASE_URL and BACKUP_VERIFY_DATABASE_URL." }
if ($source -eq $verify) { throw "The isolated verification database must not be the source database." }
Get-Command pg_dump -ErrorAction Stop | Out-Null
Get-Command pg_restore -ErrorAction Stop | Out-Null
$backup = Join-Path ([System.IO.Path]::GetTempPath()) ("itf-flow-" + [guid]::NewGuid().ToString() + ".backup")
try {
  & pg_dump --format=custom --no-owner --file=$backup --dbname=$source
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }
  & pg_restore --clean --if-exists --no-owner --exit-on-error --dbname=$verify $backup
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed." }
  $tables = & psql --tuples-only --no-align --dbname=$verify --command='SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ''public'';'
  if ($LASTEXITCODE -ne 0 -or [int]$tables -lt 1) { throw "Restored database validation failed." }
  Write-Output "Restore verification passed: $tables public tables restored to the isolated target."
} finally { if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force } }
