const PROJECT_REF = 'achepsojutmuctpmedxg';
const TOKEN = 'sbp_c55626e222846ef2bef83b84e4db87f1e5c566d0';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function debugLicense() {
    console.log(`Debugging license...`);

    // We try to find the license, or anything starting with 3222
    const query = `
        SELECT id, key_string FROM licenses LIMIT 10
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
        console.log('✅ Query executed!');
        console.log('Found rows:', JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('❌ Network error:', e.message);
    }
}

debugLicense();
