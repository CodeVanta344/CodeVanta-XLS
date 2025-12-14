-- 🔍 Script pour vérifier la structure de la table licenses
-- Exécutez ce script pour voir les colonnes de votre table

-- 1. Afficher toutes les colonnes de la table licenses
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'licenses'
ORDER BY ordinal_position;

-- 2. Afficher quelques lignes de la table (pour voir les données)
SELECT * FROM licenses LIMIT 5;
