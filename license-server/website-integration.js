import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
// Projet: CodeVanta344's Project (achepsojutmuctpmedxg)
const supabaseUrl = 'https://achepsojutmuctpmedxg.supabase.co';

// ATTENTION: Pour générer des licences, vous DEVEZ utiliser la "Service Role Key" (secrète).
// Ne mettez JAMAIS cette clé dans le code frontend (navigateur).
// Cette clé est disponible dans: Project Settings > API > service_role (secret)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'VOTRE_SERVICE_ROLE_KEY_ICI';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Génère une nouvelle licence pour un client.
 * @param {string} email - L'email du client
 * @param {string} plan - 'standard', 'pro', ou 'enterprise'
 * @param {number} durationDays - Durée en jours (365 par défaut)
 */
export async function generateLicenseForUser(email, plan = 'standard', durationDays = 365) {
    try {
        const { data, error } = await supabase
            .rpc('generate_license', {
                user_email: email,
                plan_type: plan,
                duration_days: durationDays
            });

        if (error) {
            console.error('Erreur lors de la génération:', error);
            throw error;
        }

        return data; // { success: true, license_key: '...', ... }

    } catch (err) {
        console.error('Exception:', err);
        return { success: false, error: err.message };
    }
}

// Exemple d'utilisation (dans une route API sécurisée par exemple)
/*
generateLicenseForUser('client@example.com', 'pro')
    .then(result => {
        if (result.success) {
            console.log('Nouvelle clé générée:', result.license_key);
            // Envoyer la clé par email au client ici
        }
    });
*/
