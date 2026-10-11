$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
if (!(Test-Path '.env')) {
    $settings = [IO.File]::ReadAllText((Join-Path (Get-Location) '.env.example'))
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    foreach ($name in @('POSTGRES_PASSWORD','MINIO_ROOT_PASSWORD','MVP_ADMIN_PASSWORD','MVP_TRAINING_PASSWORD')) {
        $bytes = New-Object byte[] 20
        $rng.GetBytes($bytes)
        $value = ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
        $settings = $settings.Replace("$name=`n", "$name=$value`n")
    }
    $bytes = New-Object byte[] 48
    $rng.GetBytes($bytes)
    $settings = $settings.Replace("JWT_SECRET=`n", 'JWT_SECRET=' + [Convert]::ToBase64String($bytes) + "`n")
    $rng.Dispose()
    [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $settings)
    Write-Host 'Создан .env. Администратор: admin@teethtech.kz; пароль в MVP_ADMIN_PASSWORD.'
}
docker compose up -d --build --remove-orphans --wait --wait-timeout 360
if ($LASTEXITCODE -ne 0) { throw 'Контейнеры не запустились. Проверьте docker compose logs --tail 100.' }
& (Join-Path $PSScriptRoot 'smoke.ps1')
