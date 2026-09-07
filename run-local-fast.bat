@echo off
REM ============================================================
REM  Run the auction software on the LOCAL database (FAST).
REM  Use this on your laptop for setup, testing, or a local demo.
REM  Data stays on this computer (auction.db) and does NOT touch
REM  the cloud/Supabase database.
REM ============================================================
cd /d "%~dp0"
set DATABASE_URL=
echo.
echo   Starting auction software on the LOCAL database (fast)...
echo   Open http://localhost:5000 in your browser.
echo   Press Ctrl+C in this window to stop.
echo.
python app.py
pause
