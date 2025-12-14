-- 🔑 Tables pour le système de licences CodeVanta-XLS
-- À exécuter dans Supabase SQL Editor

-- Table principale des licences
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(19) UNIQUE NOT NULL,
    license_hash VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    plan VARCHAR(20) DEFAULT 'standard' CHECK (plan IN ('standard', 'pro', 'enterprise')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'revoked')),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NULL,
    activated_at TIMESTAMP NULL,
    activation_count INT DEFAULT 0,
    max_activations INT DEFAULT 1,
    last_verified_at TIMESTAMP NULL,
    machine_id VARCHAR(255) NULL
);

-- Index pour améliorer les performances
CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_hash ON licenses(license_hash);
CREATE INDEX idx_licenses_created ON licenses(created_at DESC);

-- Table des activations (historique)
CREATE TABLE license_activations (
    id SERIAL PRIMARY KEY,
    license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
    machine_id VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    activated_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activations_license ON license_activations(license_id);

-- Table des logs (traçabilité)
CREATE TABLE license_logs (
    id SERIAL PRIMARY KEY,
    license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'activated', 'verified', 'suspended', 'revoked')),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_license ON license_logs(license_id);
CREATE INDEX idx_logs_action ON license_logs(action);

-- Activer Row Level Security
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_logs ENABLE ROW LEVEL SECURITY;

-- Politique : Lecture publique (pour vérification depuis l'app)
CREATE POLICY "Allow public read licenses" ON licenses
    FOR SELECT USING (true);

-- Politique : Seul le service_role peut tout faire
CREATE POLICY "Allow service role all on licenses" ON licenses
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role all on activations" ON license_activations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role all on logs" ON license_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Vue pour les statistiques
CREATE OR REPLACE VIEW license_stats AS
SELECT 
    COUNT(*) as total_licenses,
    COUNT(*) FILTER (WHERE status = 'active') as active_licenses,
    COUNT(*) FILTER (WHERE status = 'expired') as expired_licenses,
    COUNT(*) FILTER (WHERE status = 'revoked') as revoked_licenses,
    COUNT(*) FILTER (WHERE plan = 'standard') as standard_plan,
    COUNT(*) FILTER (WHERE plan = 'pro') as pro_plan,
    COUNT(*) FILTER (WHERE plan = 'enterprise') as enterprise_plan,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as licenses_last_30_days
FROM licenses;

-- Fonction pour nettoyer les licences expirées
CREATE OR REPLACE FUNCTION update_expired_licenses()
RETURNS void AS $$
BEGIN
    UPDATE licenses
    SET status = 'expired'
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() 
    AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour documentation
COMMENT ON TABLE licenses IS 'Table principale stockant toutes les licences générées';
COMMENT ON COLUMN licenses.license_key IS 'Clé de licence au format XXXX-XXXX-XXXX-XXXX';
COMMENT ON COLUMN licenses.license_hash IS 'Hash SHA256 de la clé pour sécurité';
COMMENT ON COLUMN licenses.plan IS 'Type de plan: standard, pro, ou enterprise';
COMMENT ON COLUMN licenses.status IS 'Statut: active, suspended, expired, ou revoked';
