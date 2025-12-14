-- 🔧 Script pour corriger les licences lifetime marquées comme expirées
-- À exécuter dans Supabase SQL Editor

-- 1. Afficher les licences actuellement expirées
SELECT 
    license_key,
    email,
    plan,
    status,
    expires_at,
    created_at
FROM licenses
WHERE status = 'expired'
ORDER BY created_at DESC;

-- 2. Réactiver les licences "lifetime" qui ont été marquées comme expirées
-- (Remplacer '3222-FD59-8AF5-623E' par votre clé de licence si nécessaire)
UPDATE licenses
SET 
    status = 'active',
    expires_at = NULL  -- NULL = lifetime/perpétuel
WHERE license_key = '3222-FD59-8AF5-623E'
AND status = 'expired';

-- 3. Vérifier que la correction a fonctionné
SELECT 
    license_key,
    email,
    plan,
    status,
    expires_at,
    CASE 
        WHEN expires_at IS NULL THEN 'Lifetime (À vie)'
        WHEN expires_at > NOW() THEN 'Active jusqu''au ' || to_char(expires_at, 'DD/MM/YYYY')
        ELSE 'Expirée'
    END as validity_status
FROM licenses
WHERE license_key = '3222-FD59-8AF5-623E';

-- 4. (Optionnel) Convertir TOUTES les licences expirées en lifetime
-- ATTENTION: Décommentez seulement si vous voulez vraiment faire ça !
-- UPDATE licenses
-- SET 
--     status = 'active',
--     expires_at = NULL
-- WHERE status = 'expired';
