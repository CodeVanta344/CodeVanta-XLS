// Configuration
const SUPABASE_URL = 'https://achepsojutmuctpmedxg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjaGVwc29qdXRtdWN0cG1lZHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NTY0NTEsImV4cCI6MjA4MTEzMjQ1MX0.MvIga1zaVsl4qADTIhHpPpaSQ99PpVitcAH0io6fVoE';

async function testConnection() {
    console.log('Testing connection to Supabase via fetch...');

    // License to test
    const licenseKey = '3222-FD59-8AF5-623E';

    try {
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
                    check_key: licenseKey,
                    check_app_name: 'CodeVanta-XLS'
                })
            }
        );

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
        console.log('✅ RPC call successful!');
        console.log('Result:', JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('❌ Network/Fetch error:', e.message);
    }
}

testConnection();
