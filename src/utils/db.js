const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function setupDb() {
    const db = await open({
        filename: path.join(__dirname, '../../database.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roblox_id TEXT UNIQUE,
            roblox_username TEXT,
            encrypted_cookie TEXT,
            discord_id TEXT UNIQUE,
            cli_token TEXT UNIQUE
        );

        CREATE TABLE IF NOT EXISTS discord_links (
            code TEXT PRIMARY KEY,
            discord_id TEXT,
            expires_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT,
            status TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    return db;
}

module.exports = { setupDb };
