const { encrypt, decrypt } = require('../utils/crypto');
const { setupDb } = require('../utils/db');

class AuthManager {
    static async saveCookie(robloxId, username, cookie) {
        const db = await setupDb();
        const encryptedCookie = encrypt(cookie);
        await db.run(
            `INSERT INTO users (roblox_id, roblox_username, encrypted_cookie)
             VALUES (?, ?, ?)
             ON CONFLICT(roblox_id) DO UPDATE SET
             roblox_username = excluded.roblox_username,
             encrypted_cookie = excluded.encrypted_cookie`,
            [robloxId, username, encryptedCookie]
        );
    }

    static async getCookie(robloxId) {
        const db = await setupDb();
        const user = await db.get('SELECT encrypted_cookie FROM users WHERE roblox_id = ?', [robloxId]);
        if (!user) return null;
        return decrypt(user.encrypted_cookie);
    }

    static async getUserByCliToken(token) {
        const db = await setupDb();
        return await db.get('SELECT * FROM users WHERE cli_token = ?', [token]);
    }

    static async getUserByDiscordId(discordId) {
        const db = await setupDb();
        return await db.get('SELECT * FROM users WHERE discord_id = ?', [discordId]);
    }

    static async generateCliToken(robloxId) {
        const db = await setupDb();
        const token = require('crypto').randomBytes(32).toString('hex');
        await db.run('UPDATE users SET cli_token = ? WHERE roblox_id = ?', [token, robloxId]);
        return token;
    }
}

module.exports = AuthManager;
