$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$config = @{}
Get-Content '.env' | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { $config[$matches[1]] = $matches[2] } }
$base = if ($env:MVP_SMOKE_URL) { $env:MVP_SMOKE_URL.TrimEnd('/') } else { 'http://127.0.0.1:' + $config['MVP_PORT'] }
Invoke-RestMethod "$base/health" | Out-Null
$password = if ($env:MVP_SMOKE_ADMIN_PASSWORD) { $env:MVP_SMOKE_ADMIN_PASSWORD } else { $config['MVP_ADMIN_PASSWORD'] }
if (-not $password -and $config['MVP_ADMIN_PASSWORD_HASH']) {
    Invoke-WebRequest "$base/auth/login" -UseBasicParsing | Out-Null
    Write-Host 'MVP availability OK. Auth smoke skipped: set MVP_SMOKE_ADMIN_PASSWORD for full verification.'
    exit 0
}
$login = @{email='admin@teethtech.kz'; password=$password} | ConvertTo-Json
Invoke-RestMethod "$base/api/backend/auth/sessions" -Method Post -ContentType 'application/json' -Body $login -Headers @{Origin=$base} -SessionVariable mvpSession | Out-Null
foreach ($path in @('/api/auth/session','/api/backend/orders','/api/backend/laboratory/cases','/api/backend/personal-notes','/training')) {
    Invoke-WebRequest ($base+$path) -WebSession $mvpSession -UseBasicParsing | Out-Null
}
$today = (Get-Date).ToUniversalTime().AddHours(5).ToString('yyyy-MM-dd')
$report = Invoke-RestMethod "$base/api/backend/kpi?from=$today&to=$today" -WebSession $mvpSession
if ($null -eq $report.employees -or $null -eq $report.completions) { throw 'Некорректный ответ KPI' }
Invoke-RestMethod "$base/api/auth/logout" -Method Post -WebSession $mvpSession -Headers @{Origin=$base} | Out-Null
Write-Host "MVP smoke OK. Откройте $base."
