const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    host: '49.50.139.223',
    port: 5432,
    user: 'moadamda',
    password: 'MoaDamDa2025!Secure#Analytics',
    database: 'analytics',
    ssl: false
});

async function runMigration() {
    try {
        await client.connect();
        console.log('Connected to database');

        // 경로 수정: backend 폴더 내에서 실행되므로 ../backend/migrations 가 아니라 ./migrations
        const dashboardMigrationSql = fs.readFileSync(path.join(__dirname, 'migrations/create_dashboards.sql'), 'utf8');
        console.log('Running create_dashboards migration...');
        await client.query(dashboardMigrationSql);
        console.log('Dashboards tables created successfully');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();

