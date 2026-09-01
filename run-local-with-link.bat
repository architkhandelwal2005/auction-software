@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   AUCTION SOFTWARE - LOCAL + SHAREABLE LINK
echo ============================================================
echo   Starting the app on this laptop (local database, fast)...
echo   Then creating a public link via Cloudflare Tunnel.
echo   Team owners and spectators can open that link from ANY
echo   network (WiFi, mobile data) - not just this venue's WiFi.
echo ============================================================
echo.

set DATABASE_URL=

REM Start the Flask app in its own window
start "AUCTION SERVER (do not close)" cmd /k "cd /d "%~dp0" && set DATABASE_URL=&& python app.py"

echo Waiting for the app to start...
timeout /t 6 /nobreak >nul

echo.
echo Starting the public tunnel...
echo ============================================================
echo   YOUR SHAREABLE LINK WILL APPEAR BELOW IN A FEW SECONDS.
echo   It looks like: https://xxxx-xxxx-xxxx.trycloudflare.com
echo.
echo   Give that link to team owners / spectators, then add:
echo     /login       -^> role selection (Team / Spectator)
echo     /live        -^> spectator screen directly
echo.
echo   ADMIN CONTROL PANEL: use this laptop only, NOT this link.
echo   Open http://localhost:5000/login here and choose Auctioneer.
echo ============================================================
echo.
echo   Keep BOTH this window and the AUCTION SERVER window open
echo   for the whole auction. Closing either one disconnects
echo   everyone. Press Ctrl+C here to stop sharing when you're done.
echo ============================================================
echo.

cloudflared.exe tunnel --url http://localhost:5000

pause
