@echo off
echo ========================================
echo Option 1: Single Port Deployment Setup
echo ========================================
echo.

echo [1/3] Building frontend for production...
cd item-req-frontend
call npm install
if errorlevel 1 (
    echo ERROR: Frontend npm install failed!
    pause
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
echo ✅ Frontend built successfully!
echo.

echo [2/3] Installing backend dependencies...
cd ..\item-req-backend
call npm install
if errorlevel 1 (
    echo ERROR: Backend npm install failed!
    pause
    exit /b 1
)
echo ✅ Backend dependencies installed!
echo.

echo [3/3] Setup complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Set NODE_ENV=production in item-req-backend\.env (optional)
echo 2. Configure your .env files with database, LDAP, etc.
echo 3. Start the server: cd item-req-backend ^&^& npm start
echo 4. Access at: http://localhost:3001 or http://YOUR_SERVER_IP:3001
echo.
echo The backend will serve both API and frontend on port 3001!
echo ========================================
pause
