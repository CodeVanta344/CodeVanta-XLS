const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

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

/**
 * POST /api/verify-license
 * Vérifie une licence depuis l'application desktop
 */
app.post('/api/verify-license', async (req, res) => {
    try {
        const { licenseKey, appVersion, platform, appName } = req.body;

        if (!licenseKey) {
            return res.json({
                valid: false,
                message: 'Clé de licence requise'
            });
        }

        // Call Supabase RPC function
        const { data, error } = await supabase.rpc('verify_license_key', {
            check_key: licenseKey,
            check_app_name: appName || 'CodeVanta-XLS'
        });

        if (error) {
            console.error('Verification error:', error);
            return res.status(500).json({
                valid: false,
                message: 'Erreur serveur'
            });
        }

        res.json(data);

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
        const { email, plan, duration } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email requis'
            });
        }

        // Call Supabase RPC function
        const { data, error } = await supabase.rpc('generate_license', {
            user_email: email,
            plan_type: plan || 'standard',
            duration_days: duration || 365
        });

        if (error) {
            console.error('Generation error:', error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la génération'
            });
        }

        res.json({
            success: true,
            license: data
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
        const { data, error } = await supabase
            .from('licenses')
            .select('id, email, plan_type, status, created_at, expires_at, activation_count, max_activations, last_verified_at')
            .eq('key_string', req.params.key)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Licence non trouvée' });
        }

        res.json(data);

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
        const { data, error } = await supabase
            .from('licenses')
            .select('status, plan_type');

        if (error) {
            throw error;
        }

        const stats = {
            total: data.length,
            active: data.filter(l => l.status === 'active').length,
            expired: data.filter(l => l.status === 'expired').length,
            standard: data.filter(l => l.plan_type === 'standard').length,
            pro: data.filter(l => l.plan_type === 'pro').length,
            enterprise: data.filter(l => l.plan_type === 'enterprise').length
        };

        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/licenses
 * Liste toutes les licences (admin)
 */
app.get('/api/licenses', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('licenses')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        res.json(data);
    } catch (error) {
        console.error('List error:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test Supabase connection on startup
(async () => {
    try {
        const { data, error } = await supabase
            .from('licenses')
            .select('count')
            .limit(1);

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        console.log('✅ Connected to Supabase');
    } catch (error) {
        console.error('❌ Supabase connection failed:', error.message);
        console.error('Please check your SUPABASE_URL and SUPABASE_SERVICE_KEY in .env file');
    }
})();

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║   🔑 CodeVanta License Server        ║
    ║   Port: ${PORT}                          ║
    ║   Environment: ${process.env.NODE_ENV || 'development'}            ║
    ║   Database: Supabase                 ║
    ╚═══════════════════════════════════════╝
    `);
});

module.exports = app;
