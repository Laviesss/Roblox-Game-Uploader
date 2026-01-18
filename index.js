require('dotenv').config();
const { setupDb } = require('./src/utils/db');
const { startWebServer } = require('./src/web/server');
const { startDiscordBot } = require('./src/discord/bot');

async function main() {
    console.log('Starting Roblox Game Uploader...');

    // Initialize DB
    await setupDb();
    console.log('Database initialized.');

    // Start Web Server
    startWebServer();

    // Start Discord Bot
    startDiscordBot();
}

main().catch(err => {
    console.error('Failed to start application:', err);
});
