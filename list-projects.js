const PROJECT_REF = 'achepsojutmuctpmedxg';
const TOKEN = 'sbp_c55626e222846ef2bef83b84e4db87f1e5c566d0';
const API_URL = 'https://api.supabase.com/v1/projects';

async function listProjects() {
    console.log(`Listing projects...`);

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TOKEN}`
            }
        });

        if (!response.ok) {
            console.error(`❌ Request failed with status: ${response.status} ${response.statusText}`);
            return;
        }

        const data = await response.json();
        console.log('✅ Projects listed successfully!');
        // Find our project
        const project = data.find(p => p.id === PROJECT_REF);
        if (project) {
            console.log('Found project:', JSON.stringify(project, null, 2));
        } else {
            console.log('Project not found in list (or list truncated).');
        }

    } catch (e) {
        console.error('❌ Network error:', e.message);
    }
}

listProjects();
