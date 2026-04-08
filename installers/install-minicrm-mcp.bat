@echo off
chcp 65001 >nul 2>&1
title MiniCRM MCP Telepito - Windows

cls
echo.
echo ╔══════════════════════════════════════════╗
echo ║   MiniCRM MCP - Telepito (Windows)       ║
echo ║   Claude Desktop integraciohoz           ║
echo ╚══════════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo HIBA: Node.js nincs telepitve!
    echo.
    echo Telepitse a Node.js-t innen: https://nodejs.org
    echo Majd futtassa ujra ezt a telepitot.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do echo Node.js talalhato: %%i
echo.

:: Collect credentials
set /p LICENSE_KEY="Licenckulcs (lic_...): "
echo %LICENSE_KEY% | findstr /b "lic_" >nul
if %errorlevel% neq 0 (
    echo HIBA: A licenckulcsnak 'lic_' elotaggal kell kezdodnie.
    pause
    exit /b 1
)

:: Validate license
echo.
echo Licenc ellenorzese...
for /f "tokens=*" %%i in ('curl -s -X POST https://minicrm-license.nexlyhu.workers.dev/validate -H "Content-Type: application/json" -d "{\"key\":\"%LICENSE_KEY%\"}"') do set VALIDATE_RESPONSE=%%i
echo %VALIDATE_RESPONSE% | findstr "\"valid\":true" >nul
if %errorlevel% neq 0 (
    echo HIBA: Ervenytelen licenckulcs.
    echo Valasz: %VALIDATE_RESPONSE%
    pause
    exit /b 1
)
echo Licenc ervenyes!

echo.
echo A MiniCRM System ID megtalalhato a bongeszo cimsoraban:
echo   r3.minicrm.hu/XXXXX/...
echo.
set /p SYSTEM_ID="MiniCRM System ID: "

echo.
echo Az API kulcsot a MiniCRM Beallitasok ^> Rendszer oldalon talalja.
echo.
set /p API_KEY="MiniCRM API kulcs: "

if "%SYSTEM_ID%"=="" (
    echo HIBA: Minden mezo kitoltese kotelezo.
    pause
    exit /b 1
)
if "%API_KEY%"=="" (
    echo HIBA: Minden mezo kitoltese kotelezo.
    pause
    exit /b 1
)

:: Write config
set CONFIG_DIR=%APPDATA%\Claude
set CONFIG_FILE=%CONFIG_DIR%\claude_desktop_config.json

if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

node -e "const fs=require('fs');const p='%CONFIG_FILE:\=\\%';let c={};try{c=JSON.parse(fs.readFileSync(p,'utf-8'))}catch{}if(!c.mcpServers)c.mcpServers={};c.mcpServers.minicrm={command:'npx',args:['-y','minicrm-mcp'],env:{MINICRM_LICENSE_KEY:'%LICENSE_KEY%',MINICRM_SYSTEM_ID:'%SYSTEM_ID%',MINICRM_API_KEY:'%API_KEY%'}};fs.writeFileSync(p,JSON.stringify(c,null,2))"

echo.
echo ════════════════════════════════════════════
echo   Sikeres telepites!
echo   Konfiguracio mentve: %CONFIG_FILE%
echo.
echo   Kovetkezo lepes:
echo   Inditsa ujra a Claude Desktop alkalmazast.
echo ════════════════════════════════════════════
echo.
pause
