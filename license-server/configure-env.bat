@echo off
REM Script de configuration automatique du fichier .env
REM CodeVanta License Server

echo ========================================
echo Configuration du fichier .env
echo ========================================
echo.

REM Vérifier si le fichier .env.configured existe
if not exist ".env.configured" (
    echo ERREUR: Le fichier .env.configured n'existe pas!
    pause
    exit /b 1
)

echo Etape 1: Copie du fichier de configuration...
copy /Y ".env.configured" ".env" >nul

if errorlevel 1 (
    echo ERREUR: Impossible de copier le fichier!
    pause
    exit /b 1
)

echo ✓ Fichier .env cree avec succes!
echo.

echo ========================================
echo IMPORTANT: Configuration de la Service Role Key
echo ========================================
echo.
echo 1. Allez sur la page Supabase API Settings (deja ouverte dans votre navigateur)
echo 2. Cherchez la section "service_role" (cle secrete)
echo 3. Cliquez sur "Copy" pour copier la cle
echo 4. Ouvrez le fichier .env qui vient d'etre cree
echo 5. Remplacez VOTRE_SERVICE_ROLE_KEY_ICI par votre cle
echo 6. Sauvegardez le fichier
echo.

echo ========================================
echo Configuration terminee!
echo ========================================
echo.
echo Prochaines etapes:
echo 1. Configurez la Service Role Key (voir instructions ci-dessus)
echo 2. Lancez le serveur avec: npm start
echo 3. Ouvrez http://localhost:3001 dans votre navigateur
echo.

pause
