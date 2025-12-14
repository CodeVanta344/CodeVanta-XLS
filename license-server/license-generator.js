const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class LicenseGenerator {
    constructor(secretKey) {
        this.secretKey = secretKey || 'default-secret-key';
    }

    /**
     * Génère une clé de licence unique
     * Format: XXXX-XXXX-XXXX-XXXX
     */
    generateKey() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let key = '';

        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) {
                key += '-';
            }
            const randomIndex = crypto.randomInt(0, chars.length);
            key += chars[randomIndex];
        }

        return key;
    }

    /**
     * Génère une licence complète avec métadonnées
     */
    generateLicense(email, plan = 'standard', duration = null) {
        const licenseKey = this.generateKey();
        const licenseId = uuidv4();
        const createdAt = new Date();
        const expiresAt = duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;

        const maxActivations = {
            'standard': 1,
            'pro': 3,
            'enterprise': 10
        };

        return {
            id: licenseId,
            key: licenseKey,
            email: email,
            plan: plan,
            status: 'active',
            createdAt: createdAt.toISOString(),
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
            activatedAt: null,
            activationCount: 0,
            maxActivations: maxActivations[plan] || 1
        };
    }

    /**
     * Vérifie la validité d'une clé
     */
    validateKeyFormat(key) {
        const regex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        return regex.test(key);
    }

    /**
     * Génère un hash de la clé pour stockage sécurisé
     */
    hashKey(key) {
        return crypto
            .createHmac('sha256', this.secretKey)
            .update(key)
            .digest('hex');
    }
}

module.exports = LicenseGenerator;
