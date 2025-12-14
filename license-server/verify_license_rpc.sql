-- 🔑 Fonction RPC pour vérifier une licence CodeVanta-XLS
-- À exécuter dans Supabase SQL Editor

-- Ajouter la colonne app_name si elle n'existe pas
ALTER TABLE licenses 
ADD COLUMN IF NOT EXISTS app_name VARCHAR(50) DEFAULT 'CodeVanta-XLS';

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_licenses_app_name ON licenses(app_name);

-- Fonction RPC pour vérifier une licence
CREATE OR REPLACE FUNCTION verify_license_key(
    check_key TEXT,
    check_app_name TEXT DEFAULT 'CodeVanta-XLS'
)
RETURNS JSONB AS $$
DECLARE
    license_record RECORD;
    is_expired BOOLEAN;
BEGIN
    -- 1. Rechercher la licence par clé
    SELECT * INTO license_record
    FROM licenses
    WHERE license_key = check_key;

    -- 2. Vérifier si la licence existe
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'Clé de licence invalide'
        );
    END IF;

    -- 3. Vérifier si la licence est pour la bonne application
    IF license_record.app_name IS NOT NULL AND license_record.app_name != check_app_name THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'Cette licence n''est pas valide pour ' || check_app_name
        );
    END IF;

    -- 4. Vérifier le statut
    IF license_record.status != 'active' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'Licence ' || license_record.status
        );
    END IF;

    -- 5. Vérifier l'expiration (NULL = lifetime/perpétuel)
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

    -- 6. Mettre à jour la dernière vérification
    UPDATE licenses 
    SET last_verified_at = NOW()
    WHERE id = license_record.id;

    -- 7. Logger la vérification
    INSERT INTO license_logs (license_id, action, ip_address)
    VALUES (license_record.id, 'verified', 'app-client');

    -- 8. Retourner succès avec les infos
    RETURN jsonb_build_object(
        'valid', true,
        'message', 'Licence valide',
        'plan', license_record.plan,
        'email', license_record.email,
        'expires_at', license_record.expires_at,
        'app', license_record.app_name,
        'is_lifetime', license_record.expires_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mettre à jour les licences existantes pour CodeVanta-XLS
UPDATE licenses 
SET app_name = 'CodeVanta-XLS' 
WHERE app_name IS NULL;

-- Commentaire
COMMENT ON FUNCTION verify_license_key IS 'Vérifie la validité d''une licence pour une application spécifique';
