-- Fonction pour générer une licence
-- À exécuter dans Supabase SQL Editor

CREATE OR REPLACE FUNCTION generate_license(
    user_email TEXT,
    plan_type TEXT DEFAULT 'standard',
    duration_days INT DEFAULT 365
)
RETURNS JSONB AS $$
DECLARE
    new_key TEXT;
    new_hash TEXT;
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    segment TEXT;
    i INT;
    j INT;
    expiration TIMESTAMP;
    license_id UUID;
BEGIN
    -- 1. Générer une clé unique au format XXXX-XXXX-XXXX-XXXX
    LOOP
        new_key := '';
        FOR i IN 1..4 LOOP
            segment := '';
            FOR j IN 1..4 LOOP
                segment := segment || substr(chars, floor(random() * length(chars) + 1)::int, 1);
            END LOOP;
            IF i > 1 THEN
                new_key := new_key || '-';
            END LOOP;
            new_key := new_key || segment;
        END LOOP;

        -- Vérifier unicité (rare collision possible)
        IF NOT EXISTS (SELECT 1 FROM licenses WHERE license_key = new_key) THEN
            EXIT;
        END IF;
    END LOOP;

    -- 2. Calculer le hash
    new_hash := encode(digest(new_key, 'sha256'), 'hex');

    -- 3. Définir expiration (NULL pour perpétuel si duration_days <= 0)
    IF duration_days > 0 THEN
        expiration := NOW() + (duration_days || ' days')::INTERVAL;
    ELSE
        expiration := NULL;
    END IF;

    -- 4. Insérer dans la table
    INSERT INTO licenses (
        license_key,
        license_hash,
        email,
        plan,
        status,
        expires_at
    ) VALUES (
        new_key,
        new_hash,
        user_email,
        plan_type,
        'active',
        expiration
    ) RETURNING id INTO license_id;

    -- 5. Retourner la clé générée (elle ne sera plus jamais visible sous cette forme)
    RETURN jsonb_build_object(
        'success', true,
        'license_key', new_key,
        'license_id', license_id,
        'expires_at', expiration
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- S'assurer que pgchrypto est activé pour le hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
