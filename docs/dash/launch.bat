@echo off
title SDD Progress Dashboard
cd /d "C:\Projetos\FULLCYCLE"

where python >nul 2>&1
if %errorlevel% neq 0 (
  echo ERRO: Python nao encontrado no PATH.
  echo Instale Python em https://python.org ou ajuste este script.
  pause
  exit /b 1
)

echo.
echo  SDD Progress Dashboard
echo  Servidor: http://localhost:8080/sdd-harness-dash/index.html
echo  JSON:     sdd-harness/mba-ia-videomax-sdd-harness/docs/prd_progress.json
echo  Feche esta janela para encerrar o servidor.
echo.

start /B python -m http.server 8080
timeout /t 1 /nobreak > nul
start "" "http://localhost:8080/sdd-harness-dash/index.html"

pause > nul
