import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Récupérer les données de la requête
        const { email, plan = 'standard', duration, sendEmail = true } = await req.json()

        if (!email) {
            throw new Error('Email requis')
        }

        // Générer la clé de licence
        const licenseKey = generateLicenseKey()
        const licenseHash = await hashKey(licenseKey)

        // Calculer la date d'expiration
        const expiresAt = duration
            ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
            : null

        // Déterminer le nombre max d'activations selon le plan
        const maxActivations = plan === 'enterprise' ? 10 : plan === 'pro' ? 3 : 1

        // Créer le client Supabase avec la clé service_role
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Insérer la licence dans la base de données
        const { data, error } = await supabase
            .from('licenses')
            .insert({
                license_key: licenseKey,
                license_hash: licenseHash,
                email: email,
                plan: plan,
                expires_at: expiresAt,
                max_activations: maxActivations
            })
            .select()
            .single()

        if (error) {
            console.error('Database error:', error)
            throw new Error('Erreur lors de la création de la licence')
        }

        // Logger l'action
        await supabase.from('license_logs').insert({
            license_id: data.id,
            action: 'created',
            ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        })

        // TODO: Envoyer l'email au client si sendEmail === true
        // Vous pouvez utiliser Resend, SendGrid, ou autre service d'email

        // Retourner la licence générée
        return new Response(
            JSON.stringify({
                success: true,
                license: {
                    key: licenseKey,
                    email: email,
                    plan: plan,
                    expiresAt: expiresAt,
                    maxActivations: maxActivations
                }
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Erreur inconnue'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})

/**
 * Génère une clé de licence au format XXXX-XXXX-XXXX-XXXX
 */
function generateLicenseKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let key = ''

    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) {
            key += '-'
        }
        key += chars[Math.floor(Math.random() * chars.length)]
    }

    return key
}

/**
 * Hash une clé avec SHA-256
 */
async function hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(key)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
