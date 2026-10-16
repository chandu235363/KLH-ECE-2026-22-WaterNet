@echo off
echo ==============================================
echo   WaterNet PostgreSQL Starter (Local Instance)
echo ==============================================
echo.
set PG_BIN=C:\Program Files\PostgreSQL\18\bin
set PG_DATA=%USERPROFILE%\pgdata

if exist "%PG_DATA%\postmaster.pid" (
    del /f /q "%PG_DATA%\postmaster.pid" >nul 2>&1
)

echo Starting PostgreSQL server on port 5432...
echo Data directory: %PG_DATA%
echo.
echo [NOTE] Keep this window OPEN while running WaterNet!
echo Press Ctrl+C to stop PostgreSQL when finished.
echo ==============================================
echo.

"%PG_BIN%\postgres.exe" -D "%PG_DATA%"
