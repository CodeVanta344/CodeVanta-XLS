const PROJECT_REF = 'achepsojutmuctpmedxg';
const TOKEN = 'sbp_c55626e222846ef2bef83b84e4db87f1e5c566d0';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function restoreLicense() {
    console.log(`Restoring license...`);

    // Insert the license using standard SQL
    // Note: status 'active' and expires_at NULL for lifetime
    // Insert the license with hash
    const query = `
            INSERT INTO licenses (key_string, license_hash, email, plan_type, status, expires_at)
            VALUES (
                '3222-FD59-8AF5-623E',
                encode(digest('3222-FD59-8AF5-623E', 'sha256'), 'hex'),
                'XLS-Platinium@CodeVanta.com', 
                'lifetime', 
                'active', 
                NULL
            )
            ON CONFLICT (key_string) DO UPDATE 
            SET status = 'active', expires_at = NULL;
        `;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                query: query
            })
        });

        if (!response.ok) {
            console.error(`❌ Request failed: ${response.status}`);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        console.log('✅ License restored successfully!');
        console.log('Result:', JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('❌ Network error:', e.message);
    }
}

restoreLicense();
