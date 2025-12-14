-- 🔧 Fonction RPC verify_license_key CORRIGÉE avec les bons noms de colonnes
-- À exécuter dans Supabase SQL Editor

-- 1. Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS verify_license_key(TEXT, TEXT);
DROP FUNCTION IF EXISTS verify_license_key(TEXT);

-- 2. Créer la fonction avec les bons noms de colonnes
CREATE OR REPLACE FUNCTION verify_license_key(
    check_key TEXT,
    check_app_name TEXT DEFAULT 'CodeVanta-XLS'
)
RETURNS JSONB AS $$
DECLARE
    license_record RECORD;
    is_expired BOOLEAN;
BEGIN
    -- 1. Rechercher la licence par clé (colonne = key_string)
    SELECT * INTO license_record
    FROM licenses
    WHERE key_string = check_key;

    -- 2. Vérifier si la licence existe
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'Clé de licence invalide'
        );
    END IF;

    -- 3. Vérifier le statut
    IF license_record.status != 'active' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'Licence ' || license_record.status
        );
    END IF;

    -- 4. Vérifier l'expiration (NULL = lifetime/perpétuel)
    IF license_record.expires_at IS NOT NULL THEN
        is_expired := license_record.expires_at < NOW();
        
        IF is_expired THEN
            -- Mettre à jour le statut si expiré
            UPDATE licenses 
            SET status = 'expired' 
            WHERE id = license_record.id;
            
            RETURN jsonb_build_object(
                'valid', false,
                'message', 'Licence expirée le ' || to_char(license_record.expires_at, 'DD/MM/YYYY')
            );
        END IF;
    END IF;

    -- 5. Mettre à jour la dernière vérification
    UPDATE licenses 
    SET last_verified_at = NOW()
    WHERE id = license_record.id;

    -- 6. Retourner succès avec les infos
    RETURN jsonb_build_object(
        'valid', true,
        'message', 'Licence valide',
        'plan', license_record.plan_type,
        'email', license_record.email,
        'expires_at', license_record.expires_at,
        'is_lifetime', license_record.expires_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaire
COMMENT ON FUNCTION verify_license_key IS 'Vérifie la validité d''une licence CodeVanta-XLS';
