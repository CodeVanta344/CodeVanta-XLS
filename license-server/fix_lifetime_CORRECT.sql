-- 🔧 Script pour corriger la licence lifetime avec les bons noms de colonnes
-- À exécuter dans Supabase SQL Editor

-- 1. Afficher l'état actuel de la licence
SELECT 
    key_string,
    email,
    plan_type,
    status,
    expires_at,
    created_at,
    CASE 
        WHEN expires_at IS NULL THEN '✅ Lifetime (À vie)'
        WHEN expires_at > NOW() THEN '⚠️ Active jusqu''au ' || to_char(expires_at, 'DD/MM/YYYY')
        ELSE '❌ Expirée le ' || to_char(expires_at, 'DD/MM/YYYY')
    END as validity_status
FROM licenses
WHERE key_string = '3222-FD59-8AF5-623E';

-- 2. Corriger la licence : définir expires_at = NULL pour lifetime
UPDATE licenses
SET 
    status = 'active',
    expires_at = NULL  -- NULL = lifetime/perpétuel
WHERE key_string = '3222-FD59-8AF5-623E';

-- 3. Vérifier que la correction a fonctionné
SELECT 
    key_string,
    email,
    plan_type,
    status,
    expires_at,
    CASE 
        WHEN expires_at IS NULL THEN '✅ Lifetime (À vie) - CORRIGÉ !'
        WHEN expires_at > NOW() THEN 'Active jusqu''au ' || to_char(expires_at, 'DD/MM/YYYY')
        ELSE 'Expirée'
    END as validity_status
FROM licenses
WHERE key_string = '3222-FD59-8AF5-623E';
