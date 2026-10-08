@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo =============================================================
echo      UNDANGAN DIGITAL KARTUN - PANEL ADMIN
 echo =============================================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Install dari https://nodejs.org/
  pause
  exit /b 1
)
echo.
echo Setelah server aktif, buka:
echo     http://localhost:3000/admin   [PANEL ADMIN]
echo     http://localhost:3000/        [UNDANGAN TAMU]
echo.
echo JIKA pertama kali: catat PASSWORD ADMIN yang tercetak di bawah.
echo Jangan tutup jendela ini saat ingin menggunakan website.
echo.
node server.js
echo.
echo Server berhenti.
pause
