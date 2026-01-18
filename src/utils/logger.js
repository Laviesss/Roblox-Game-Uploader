const { setupDb } = require('./db');

class Logger {
    static async log(userId, action, status, message) {
        try {
            const db = await setupDb();
            await db.run(
                'INSERT INTO logs (user_id, action, status, message) VALUES (?, ?, ?, ?)',
                [userId, action, status, message]
            );
            console.log(`[${status}] User ${userId}: ${action} - ${message}`);
        } catch (error) {
            console.error('Failed to write log to DB:', error);
        }
    }
}

module.exports = Logger;
