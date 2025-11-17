@echo off
echo ========================================
echo  Corrigindo Prisma - Limpeza Completa
echo ========================================
echo.

echo [1/5] Parando processos do Node...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/5] Removendo node_modules\.prisma...
if exist "node_modules\.prisma" (
    rmdir /s /q "node_modules\.prisma"
    echo Pasta .prisma removida!
) else (
    echo Pasta .prisma nao existe
)
timeout /t 1 /nobreak >nul

echo [3/5] Removendo node_modules\@prisma...
if exist "node_modules\@prisma" (
    rmdir /s /q "node_modules\@prisma"
    echo Pasta @prisma removida!
) else (
    echo Pasta @prisma nao existe
)
timeout /t 1 /nobreak >nul

echo [4/5] Reinstalando Prisma...
call npm install prisma@6.19.0 @prisma/client@6.19.0

echo [5/5] Gerando Prisma Client...
call npx prisma generate

echo.
echo ========================================
echo  Processo concluido!
echo ========================================
echo.
echo Agora voce pode iniciar o servidor com: npm start
pause
