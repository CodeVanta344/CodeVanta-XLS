const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const database = require('./database');
const LicenseGenerator = require('./license-generator');
const emailService = require('./email-service');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Initialize
const licenseGen = new LicenseGenerator(process.env.SECRET_KEY);
let db;

// Initialize database
(async () => {
    try {
        await database.connect();
        await database.initialize();
        db = database.getPool();
        console.log('🚀 License server ready!');
    } catch (error) {
        console.error('Failed to initialize:', error);
        process.exit(1);
    }
})();

/**
 * POST /api/verify-license
 * Vérifie une licence depuis l'application desktop
 */
app.post('/api/verify-license', async (req, res) => {
    try {
        const { licenseKey, appVersion, platform } = req.body;

        if (!licenseGen.validateKeyFormat(licenseKey)) {
            return res.json({
                valid: false,
                message: 'Format de clé invalide'
            });
        }

        const keyHash = licenseGen.hashKey(licenseKey);

        const [rows] = await db.execute(
            `SELECT * FROM licenses WHERE license_hash = ? AND status = 'active'`,
            [keyHash]
        );

        if (rows.length === 0) {
            return res.json({
                valid: false,
                message: 'Clé de licence invalide ou inactive'
            });
        }

        const license = rows[0];

        // Check expiration
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            await db.execute(
                `UPDATE licenses SET status = 'expired' WHERE id = ?`,
                [license.id]
            );
            return res.json({
                valid: false,
                message: 'Licence expirée'
            });
        }

        // Update last verification
        await db.execute(
            `UPDATE licenses SET last_verified_at = NOW() WHERE id = ?`,
            [license.id]
        );

        // Log action
        await db.execute(
            `INSERT INTO license_logs (license_id, action, ip_address) VALUES (?, 'verified', ?)`,
            [license.id, req.ip]
        );

        res.json({
            valid: true,
            email: license.email,
            plan: license.plan,
            expiresAt: license.expires_at
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            valid: false,
            message: 'Erreur serveur'
        });
    }
});

/**
 * POST /api/generate-license
 * Génère une nouvelle licence
 */
app.post('/api/generate-license', async (req, res) => {
    try {
        const { email, plan, duration, sendEmail } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email requis'
            });
        }

        // Generate license
        const license = licenseGen.generateLicense(email, plan || 'standard', duration);
        const keyHash = licenseGen.hashKey(license.key);

        // Insert into database
        await db.execute(
            `INSERT INTO licenses (id, license_key, license_hash, email, plan, expires_at, max_activations) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                license.id,
                license.key,
                keyHash,
                license.email,
                license.plan,
                license.expiresAt,
                license.maxActivations
            ]
        );

        // Log
        await db.execute(
            `INSERT INTO license_logs (license_id, action, ip_address) VALUES (?, 'created', ?)`,
            [license.id, req.ip]
        );

        // Send email if requested
        if (sendEmail !== false) {
            await emailService.sendLicenseEmail(
                license.email,
                license.key,
                license.plan,
                license.expiresAt
            );
        }

        res.json({
            success: true,
            license: {
                key: license.key,
                email: license.email,
                plan: license.plan,
                expiresAt: license.expiresAt
            }
        });

    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la génération'
        });
    }
});

/**
 * GET /api/license/:key
 * Récupère les infos d'une licence
 */
app.get('/api/license/:key', async (req, res) => {
    try {
        const keyHash = licenseGen.hashKey(req.params.key);

        const [rows] = await db.execute(
            `SELECT id, email, plan, status, created_at, expires_at, activation_count, max_activations, last_verified_at 
             FROM licenses WHERE license_hash = ?`,
            [keyHash]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Licence non trouvée' });
        }

        res.json(rows[0]);

    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/stats
 * Statistiques globales
 */
app.get('/api/stats', async (req, res) => {
    try {
        const [stats] = await db.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
                SUM(CASE WHEN plan = 'standard' THEN 1 ELSE 0 END) as standard,
                SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) as pro,
                SUM(CASE WHEN plan = 'enterprise' THEN 1 ELSE 0 END) as enterprise
            FROM licenses
        `);

        res.json(stats[0]);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║   🔑 CodeVanta License Server        ║
    ║   Port: ${PORT}                          ║
    ║   Environment: ${process.env.NODE_ENV || 'development'}            ║
    ╚═══════════════════════════════════════╝
    `);
});

module.exports = app;
