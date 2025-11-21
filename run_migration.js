const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    host: '49.50.139.223',
    port: 5432,
    user: 'moadamda',
    password: 'MoaDamDa2025!Secure#Analytics',
    database: 'analytics',
    ssl: false // Try without SSL first, or maybe true if needed? Backend doesn't seem to enforce it in database.js
});

async function runMigration() {
    try {
        await client.connect();
        console.log('Connected to database');

        const migrationSql = fs.readFileSync(path.join(__dirname, 'backend/migrations/add_badge_columns.sql'), 'utf8');
        console.log('Running migration...');

        await client.query(migrationSql);
        console.log('Migration completed successfully');

        // Verify columns
        const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'url_mappings'");
        console.log('Columns:', res.rows.map(r => r.column_name));

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
