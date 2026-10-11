$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
python scripts/backup.py
if ($LASTEXITCODE -ne 0) { throw 'Backup failed' }
