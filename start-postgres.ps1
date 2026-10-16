Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  WaterNet PostgreSQL Starter (Local Instance)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$pgBin = "C:\Program Files\PostgreSQL\18\bin\postgres.exe"
$pgData = "$HOME\pgdata"

if (Test-Path "$pgData\postmaster.pid") {
    Remove-Item -Force "$pgData\postmaster.pid" -ErrorAction SilentlyContinue
}

Write-Host "`nStarting PostgreSQL on port 5432..." -ForegroundColor Green
Write-Host "Data directory: $pgData" -ForegroundColor Yellow
Write-Host "`n[NOTE] Keep this terminal window OPEN while running WaterNet!" -ForegroundColor Magenta
Write-Host "Press Ctrl+C to stop the database when you are done.`n" -ForegroundColor DarkGray

& $pgBin -D $pgData
