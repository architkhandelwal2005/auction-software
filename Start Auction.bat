@echo off
echo Starting Live Player Auction Server...
cd /d "%~dp0"
call venv\Scripts\activate
echo Opening browser...
start http://127.0.0.1:5000/
python app.py
pause
