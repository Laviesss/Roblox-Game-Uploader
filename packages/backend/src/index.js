import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PuppeteerService } from './services/puppeteerService.js';
import { BatchService } from './services/batchService.js';
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt, validateCookie, createUniverse, uploadPlace, logger, getR2Client } from '@rgu/shared';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import r2Routes from './routes/r2.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const puppeteerService = new PuppeteerService(io, prisma, ENCRYPTION_KEY);
const batchService = new BatchService(prisma, ENCRYPTION_KEY);

app.use(cors());
app.use(express.json());
app.use('/api/r2', r2Routes);


// Middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await prisma.user.findUnique({ where: { id: decoded.id } });
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { email, password: hashedPassword }
    });
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(400).json({ error: 'User already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id }, JWT_SECRET);
  res.json({ token, user: { id: user.id, email: user.email } });
});

// Roblox Routes
app.post('/api/roblox/import-cookie', authenticate, async (req, res) => {
  const { cookie } = req.body;
  try {
    await validateCookie(cookie);
    const encrypted = encrypt(cookie, ENCRYPTION_KEY);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { robloxCookie: encrypted }
    });
    res.json({ message: 'Cookie imported successfully' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid Roblox cookie' });
  }
});

app.post('/api/roblox/create-universe', authenticate, async (req, res) => {
  if (!req.user.robloxCookie) return res.status(400).json({ error: 'Roblox cookie not set' });
  const cookie = decrypt(req.user.robloxCookie, ENCRYPTION_KEY);
  const { name, description } = req.body;
  try {
    const data = await createUniverse(cookie, name, description);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cli/token', authenticate, async (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: req.user.id },
    data: { cliToken: token }
  });
  res.json({ token });
});

app.get('/api/roblox/universes', authenticate, async (req, res) => {
  if (!req.user.robloxCookie) return res.status(400).json({ error: 'Cookie not set' });
  const cookie = decrypt(req.user.robloxCookie, ENCRYPTION_KEY);
  try {
    const response = await axios.get('https://develop.roblox.com/v1/user/universes?sortOrder=Desc&limit=10', {
      headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
    });
    res.json(response.data.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/roblox/batch-upload', authenticate, async (req, res) => {
  const { universeId, placeId, files, concurrency } = req.body;
  try {
    const job = await batchService.processBatch(req.user.id, universeId, placeId, files, concurrency);
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/roblox/publish', authenticate, async (req, res) => {
  if (!req.user.robloxCookie) return res.status(400).json({ error: 'Roblox cookie not set' });
  const { key, universeId, placeId } = req.body;
  const cookie = decrypt(req.user.robloxCookie, ENCRYPTION_KEY);

  try {
    const r2Client = getR2Client({
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    });

    const file = await r2Client.getObject({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key
    }).promise();

    const data = await uploadPlace(cookie, universeId, placeId, file.Body);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs', authenticate, async (req, res) => {
  const jobs = await prisma.job.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  res.json(jobs);
});

app.get('/api/logs', authenticate, async (req, res) => {
  const logs = await prisma.log.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json(logs);
});

app.get('/api/discord/status/:discordId', async (req, res) => {
  const { discordId } = req.params;
  const user = await prisma.user.findUnique({ where: { discordId } });
  if (!user) return res.status(404).json({ error: 'User not linked' });

  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  const logs = await prisma.log.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  res.json({ jobs, logs });
});

app.get('/api/discord/link-code', authenticate, async (req, res) => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  await prisma.user.update({
    where: { id: req.user.id },
    data: { discordCode: code }
  });
  res.json({ code });
});

app.post('/api/roblox/create-universe-discord', async (req, res) => {
  const { discordId, name } = req.body;
  const user = await prisma.user.findUnique({ where: { discordId } });
  if (!user || !user.robloxCookie) return res.status(400).json({ error: 'User not linked or cookie missing' });

  const cookie = decrypt(user.robloxCookie, ENCRYPTION_KEY);
  try {
    const data = await createUniverse(cookie, name);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/discord/verify-link', async (req, res) => {
  const { code, discordId } = req.body;
  const user = await prisma.user.findFirst({ where: { discordCode: code } });
  if (!user) return res.status(400).json({ error: 'Invalid code' });

  await prisma.user.update({
    where: { id: user.id },
    data: { discordId, discordCode: null }
  });
  res.json({ message: 'Linked successfully', userId: user.id });
});

// Socket.io for WebView Login
io.on('connection', (socket) => {
  socket.on('start-login', async ({ userId }) => {
    await puppeteerService.startLogin(userId, socket.id);
  });

  socket.on('browser-input', async ({ userId, type, data }) => {
    await puppeteerService.handleInput(userId, type, data);
  });

  socket.on('disconnect', () => {
    // Handle cleanup
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
