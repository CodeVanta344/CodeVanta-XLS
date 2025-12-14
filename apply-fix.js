const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_REF = 'achepsojutmuctpmedxg';
const TOKEN = 'sbp_c55626e222846ef2bef83b84e4db87f1e5c566d0';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'license-server', 'fix_lifetime_CORRECT.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

async function applyFix() {
    console.log(`Applying SQL fix from ${sqlFilePath}...`);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                query: sqlContent
            })
        });

        if (!response.ok) {
            console.error(`❌ Request failed with status: ${response.status} ${response.statusText}`);
            try {
                const errorData = await response.json();
                console.error('Error details:', JSON.stringify(errorData, null, 2));
            } catch (e) {
                console.error('Could not parse error response text:', await response.text());
            }
            return;
        }

        const data = await response.json();
        console.log('✅ SQL executed successfully!');
        console.log('Result:', JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('❌ Network error:', e.message);
    }
}

applyFix();
