// License Activation System
class LicenseManager {
    constructor() {
        this.licenseKey = null;
        this.isActivated = false;
        this.initialized = false;
        this.verificationInterval = null;
        this.verificationIntervalMs = 5000; // 5 seconds
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Check if license exists on startup
        this.checkLicense();
    }

    async checkLicense() {
        if (!window.electronAPI) {
            console.error('electronAPI not available');
            this.showActivationScreen();
            return;
        }

        try {
            const license = await window.electronAPI.getLicense();

            if (license && license.key && license.activated) {
                this.licenseKey = license.key;
                this.isActivated = true;
                this.showMainApp();

                // Start automatic license verification
                this.startAutoVerification();

                // Only initialize dashboard if license was already activated
                // (not during new activation to avoid loading errors)
                setTimeout(() => {
                    if (typeof dashboardController !== 'undefined' && dashboardController.initialize) {
                        dashboardController.initialize();
                    }
                }, 500);
            } else {
                this.showActivationScreen();
            }
        } catch (error) {
            console.error('Error checking license:', error);
            this.showActivationScreen();
        }
    }

    showActivationScreen() {
        const splashScreen = document.getElementById('splash-screen');
        const activationScreen = document.getElementById('activation-screen');
        const mainAppWrapper = document.getElementById('main-app');
        const appContent = document.getElementById('app');

        if (splashScreen) splashScreen.style.display = 'none';
        if (activationScreen) activationScreen.classList.remove('hidden');
        if (mainAppWrapper) mainAppWrapper.classList.add('hidden');
        if (appContent) appContent.classList.add('hidden');
    }

    showMainApp() {
        const splashScreen = document.getElementById('splash-screen');
        const activationScreen = document.getElementById('activation-screen');
        const mainAppWrapper = document.getElementById('main-app');
        const appContent = document.getElementById('app');

        if (splashScreen) splashScreen.style.display = 'none';
        if (activationScreen) activationScreen.classList.add('hidden');

        // Unhide the wrapper
        if (mainAppWrapper) mainAppWrapper.classList.remove('hidden');

        // CRITICAL: Unhide the inner app content
        if (appContent) {
            // Remove manual display style to let CSS handle layout (fixes broken design)
            appContent.style.display = '';

            // Fix: Remove the 3s fade-in delay intended for splash screen
            // Force immediate visibility
            appContent.style.opacity = '1';
            appContent.style.animation = 'none';
        }
    }

    async activateLicense(key) {
        // Validate key format
        if (!this.validateKeyFormat(key)) {
            return {
                success: false,
                message: 'Format de clé invalide. Format attendu: XXXX-XXXX-XXXX-XXXX'
            };
        }

        // Show loading
        window.loading?.show('Vérification de la licence...');

        try {
            // Verify with Supabase
            const result = await this.verifyWithServer(key);

            if (result.valid) {
                // Save license
                await window.electronAPI.saveLicense({
                    key: key,
                    activated: true,
                    activatedAt: new Date().toISOString(),
                    email: result.email || '',
                    expiresAt: result.expiresAt || null
                });

                this.licenseKey = key;
                this.isActivated = true;

                // Start automatic license verification
                this.startAutoVerification();

                window.loading?.hide();
                window.toast?.success('Licence activée ! Redémarrage en cours...');

                // Auto relaunch after 1.5 seconds
                setTimeout(() => {
                    if (window.electronAPI && window.electronAPI.relaunchApp) {
                        window.electronAPI.relaunchApp();
                    } else {
                        // Fallback if API not available
                        location.reload();
                    }
                }, 1500);

                return { success: true, message: 'Activation réussie. Redémarrage...' };
            } else {
                window.loading?.hide();
                return {
                    success: false,
                    message: result.message || 'Clé de licence invalide ou déjà utilisée'
                };
            }
        } catch (error) {
            window.loading?.hide();
            console.error('License verification error:', error);
            return {
                success: false,
                message: 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
            };
        }
    }

    validateKeyFormat(key) {
        // Format: XXXX-XXXX-XXXX-XXXX (16 caractères + 3 tirets)
        const regex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        return regex.test(key);
    }

    async verifyWithServer(key) {
        // Configuration Supabase
        const SUPABASE_URL = 'https://achepsojutmuctpmedxg.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjaGVwc29qdXRtdWN0cG1lZHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTY0NTEsImV4cCI6MjA4MTEzMjQ1MX0.MvIga1zaVsl4qADTIhHpPpaSQ99PpVitcAH0io6fVoE';

        try {
            // Verify with Supabase RPC to enforce App Blocking
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/rpc/verify_license_key`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        check_key: key,
                        check_app_name: 'CodeVanta-XLS'
                    })
                }
            );

            if (!response.ok) {
                // Try to parse error message
                const errData = await response.json().catch(() => ({}));
                console.error('RPC Error:', errData);
                throw new Error('Erreur serveur');
            }

            const data = await response.json();

            // RPC returns { valid: boolean, message: string, plan: string, expires_at: date, app: string }
            if (!data.valid) {
                return {
                    valid: false,
                    message: data.message || 'Clé de licence invalide'
                };
            }

            return {
                valid: true,
                email: data.email || '', // RPC might not return email, handled by fallback
                plan: data.plan,
                expiresAt: data.expires_at
            };

        } catch (error) {
            console.error('License verification error:', error);

            return {
                valid: false,
                message: 'Erreur de connexion au serveur'
            };
        }
    }

    async deactivateLicense() {
        const confirmed = confirm('Êtes-vous sûr de vouloir désactiver cette licence ?');
        if (!confirmed) return;

        // Stop automatic verification
        this.stopAutoVerification();

        await window.electronAPI.removeLicense();
        this.licenseKey = null;
        this.isActivated = false;

        window.toast?.info('Licence désactivée');
        this.showActivationScreen();

        // Recharger pour être propre
        setTimeout(() => location.reload(), 1000);
    }

    async getLicenseInfo() {
        return await window.electronAPI.getLicense();
    }

    /**
     * Start automatic license verification every 5 seconds
     */
    startAutoVerification() {
        // Clear any existing interval
        this.stopAutoVerification();

        console.log('🔄 Starting automatic license verification (every 5s)');

        // Verify immediately
        this.verifyLicenseInBackground();

        // Then verify every 5 seconds
        this.verificationInterval = setInterval(() => {
            this.verifyLicenseInBackground();
        }, this.verificationIntervalMs);
    }

    /**
     * Stop automatic license verification
     */
    stopAutoVerification() {
        if (this.verificationInterval) {
            clearInterval(this.verificationInterval);
            this.verificationInterval = null;
            console.log('⏹️ Stopped automatic license verification');
        }
    }

    /**
     * Verify license in background without showing UI
     */
    async verifyLicenseInBackground() {
        if (!this.licenseKey || !this.isActivated) {
            return;
        }

        try {
            const result = await this.verifyWithServer(this.licenseKey);

            if (!result.valid) {
                console.error('❌ License verification failed:', result.message);

                // Stop verification
                this.stopAutoVerification();

                // Show error and deactivate
                window.toast?.error(`Licence invalide: ${result.message}`);

                // Force deactivation
                await window.electronAPI.removeLicense();
                this.licenseKey = null;
                this.isActivated = false;

                // Show activation screen
                setTimeout(() => {
                    this.showActivationScreen();
                }, 2000);
            } else {
                console.log('✅ License verified successfully');
            }
        } catch (error) {
            console.error('⚠️ License verification error (will retry):', error);
            // Don't deactivate on network errors, just log and retry next interval
        }
    }
}

// Initialize license manager
const licenseManager = new LicenseManager();

// Activation form handler
document.addEventListener('DOMContentLoaded', () => {
    // Initialize license check after DOM is ready
    if (window.electronAPI) {
        licenseManager.init();
    }

    const activationForm = document.getElementById('activation-form');
    const licenseInput = document.getElementById('license-key-input');
    const activateBtn = document.getElementById('activate-btn');
    const errorMessage = document.getElementById('activation-error');

    // Format input as user types
    // Format input: allow free typing but uppercase and strictly A-Z0-9-
    licenseInput?.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        let value = e.target.value.toUpperCase();

        // Remove invalid characters (keep dashes)
        const sanitized = value.replace(/[^A-Z0-9-]/g, '');

        // Only update if changes were made (prevents cursor jump on valid input)
        if (value !== sanitized) {
            e.target.value = sanitized;
            // Restore cursor position (approximate)
            if (start && start < sanitized.length) {
                e.target.setSelectionRange(start, start);
            }
        } else {
            e.target.value = value;
        }

        // Clear error when typing
        if (errorMessage) {
            errorMessage.textContent = '';
            errorMessage.classList.add('hidden');
        }
    });

    // Auto-format on blur for convenience
    licenseInput?.addEventListener('blur', (e) => {
        let value = e.target.value.replace(/[^A-Z0-9]/g, ''); // strip dashes
        let formatted = '';
        for (let i = 0; i < value.length && i < 16; i++) {
            if (i > 0 && i % 4 === 0) formatted += '-';
            formatted += value[i];
        }
        e.target.value = formatted;
    });

    activationForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const key = licenseInput.value.trim();

        if (!key) {
            showError('Veuillez entrer une clé de licence');
            return;
        }

        activateBtn.disabled = true;
        activateBtn.textContent = 'Activation en cours...';

        const result = await licenseManager.activateLicense(key);

        if (!result.success) {
            showError(result.message);
            activateBtn.disabled = false;
            activateBtn.textContent = 'Activer';
        } else {
            // Success - show message
            activateBtn.textContent = 'Redémarrage...';
            activateBtn.style.backgroundColor = '#10b981';
        }
    });

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.classList.remove('hidden');
        }
    }
});

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.licenseManager = licenseManager;
}
