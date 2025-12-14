const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class Database {
    constructor() {
        this.supabase = null;
    }

    async connect() {
        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

            if (!supabaseUrl || !supabaseKey) {
                throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
            }

            this.supabase = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });

            // Test connection
            const { data, error } = await this.supabase
                .from('licenses')
                .select('count')
                .limit(1);

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is OK
                throw error;
            }

            console.log('✅ Connected to Supabase database');
            return this.supabase;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            throw error;
        }
    }

    async initialize() {
        // Tables already exist in Supabase, no need to create them
        console.log('✅ Database tables already initialized in Supabase');
    }

    getClient() {
        return this.supabase;
    }

    // Compatibility method for MySQL-style execute
    async execute(query, params = []) {
        // This is a compatibility layer for the existing MySQL queries
        // In production, you should use Supabase's query builder instead
        const { data, error } = await this.supabase.rpc('execute_sql', {
            query: query,
            params: params
        });

        if (error) throw error;
        return [data || []];
    }
}

module.exports = new Database();
