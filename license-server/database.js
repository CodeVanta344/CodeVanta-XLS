const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
    constructor() {
        this.pool = null;
    }

    async connect() {
        try {
            this.pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'codevanta_licenses',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });

            // Test connection
            const connection = await this.pool.getConnection();
            console.log('✅ Connected to MySQL database');
            connection.release();

            return this.pool;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            throw error;
        }
    }

    async initialize() {
        try {
            const connection = await this.pool.getConnection();

            // Create licenses table
            await connection.query(`
                CREATE TABLE IF NOT EXISTS licenses (
                    id VARCHAR(36) PRIMARY KEY,
                    license_key VARCHAR(19) UNIQUE NOT NULL,
                    license_hash VARCHAR(64) UNIQUE NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    plan ENUM('standard', 'pro', 'enterprise') DEFAULT 'standard',
                    status ENUM('active', 'suspended', 'expired', 'revoked') DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NULL,
                    activated_at TIMESTAMP NULL,
                    activation_count INT DEFAULT 0,
                    max_activations INT DEFAULT 1,
                    last_verified_at TIMESTAMP NULL,
                    machine_id VARCHAR(255) NULL,
                    INDEX idx_email (email),
                    INDEX idx_status (status),
                    INDEX idx_license_hash (license_hash)
                )
            `);

            // Create license_activations table
            await connection.query(`
                CREATE TABLE IF NOT EXISTS license_activations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    license_id VARCHAR(36) NOT NULL,
                    machine_id VARCHAR(255) NOT NULL,
                    ip_address VARCHAR(45),
                    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
                    INDEX idx_license (license_id)
                )
            `);

            // Create license_logs table
            await connection.query(`
                CREATE TABLE IF NOT EXISTS license_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    license_id VARCHAR(36) NOT NULL,
                    action ENUM('created', 'activated', 'verified', 'suspended', 'revoked') NOT NULL,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
                    INDEX idx_license (license_id),
                    INDEX idx_action (action)
                )
            `);

            console.log('✅ Database tables initialized');
            connection.release();
        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            throw error;
        }
    }

    getPool() {
        return this.pool;
    }
}

module.exports = new Database();
