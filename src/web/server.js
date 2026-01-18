const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const AuthManager = require('../auth/manager');
const AutomationPipeline = require('../automation/pipeline');
const RobloxAuth = require('../roblox/auth');
const { setupDb } = require('../utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cookieParser());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

const apiAuth = async (req, res, next) => {
    const token = req.headers['x-api-token'];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const user = await AuthManager.getUserByCliToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    next();
};

app.post('/auth/login', async (req, res) => {
    const { robloxId, username, cookie } = req.body;
    if (!robloxId || !cookie) return res.status(400).json({ error: 'Missing data' });
    try {
        await AuthManager.saveCookie(robloxId, username, cookie);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/auth/login-programmatic', async (req, res) => {
    const { username, password, captchaToken, captchaId } = req.body;
    try {
        const result = await RobloxAuth.login(username, password, captchaToken, captchaId);
        if (result.success) {
            await AuthManager.saveCookie(result.user.id, result.user.name, result.cookie);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/discord-link', async (req, res) => {
    const { code, robloxId } = req.body;
    try {
        const db = await setupDb();
        const link = await db.get('SELECT * FROM discord_links WHERE code = ? AND expires_at > ?', [code, Date.now()]);
        if (!link) return res.status(400).json({ error: 'Invalid or expired code' });
        await db.run('UPDATE users SET discord_id = ? WHERE roblox_id = ?', [link.discord_id, robloxId]);
        await db.run('DELETE FROM discord_links WHERE code = ?', [code]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/logs', async (req, res) => {
    const { robloxId } = req.query;
    try {
        const db = await setupDb();
        const logs = await db.all('SELECT * FROM logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50', [robloxId]);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/token', async (req, res) => {
    const { robloxId } = req.body;
    try {
        const token = await AuthManager.generateCliToken(robloxId);
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/publish/new', apiAuth, async (req, res) => {
    if (!req.files || !req.files.placeFile) return res.status(400).json({ error: 'No file uploaded' });
    try {
        const result = await AutomationPipeline.createAndPublish(req.user.roblox_id, req.files.placeFile.data, req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/publish/update', apiAuth, async (req, res) => {
    const { universeId, placeId } = req.body;
    if (!universeId || !placeId || !req.files || !req.files.placeFile) return res.status(400).json({ error: 'Missing data or file' });
    try {
        const result = await AutomationPipeline.updateAndPublish(req.user.roblox_id, universeId, placeId, req.files.placeFile.data);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function startWebServer() {
    app.listen(PORT, () => console.log(`Web server running on http://localhost:${PORT}`));
}

module.exports = { startWebServer };
