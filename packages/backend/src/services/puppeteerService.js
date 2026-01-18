import puppeteer from 'puppeteer';
import { logger, encrypt } from '@rgu/shared';

export class PuppeteerService {
  constructor(io, prisma, encryptionKey) {
    this.io = io;
    this.prisma = prisma;
    this.encryptionKey = encryptionKey;
    this.browsers = new Map(); // userId -> browser
  }

  async startLogin(userId, socketId) {
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    this.browsers.set(userId, { browser, page });

    await page.goto('https://www.roblox.com/login');

    // Stream frames
    const interval = setInterval(async () => {
      try {
        if (page.isClosed()) {
          clearInterval(interval);
          return;
        }
        const screenshot = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });
        this.io.to(socketId).emit('browser-frame', screenshot);
      } catch (err) {
        clearInterval(interval);
      }
    }, 200);

    // Monitor for successful login
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        const url = page.url();
        if (url.includes('/login/two-step') || url.includes('/login/verification')) {
          this.io.to(socketId).emit('mfa-required');
        }
        if (url.includes('roblox.com/home') || url.includes('roblox.com/dashboard')) {
          const cookies = await page.cookies();
          const robloxSecurity = cookies.find(c => c.name === '.ROBLOSECURITY')?.value;
          if (robloxSecurity) {
            const encrypted = encrypt(robloxSecurity, this.encryptionKey);
            await this.prisma.user.update({
              where: { id: userId },
              data: { robloxCookie: encrypted }
            });
            this.io.to(socketId).emit('login-success');
            await this.stopLogin(userId);
          }
        }
      }
    });

    return page;
  }

  async handleInput(userId, type, data) {
    const session = this.browsers.get(userId);
    if (!session) return;

    const { page } = session;
    if (type === 'mouse-click') {
      await page.mouse.click(data.x, data.y);
    } else if (type === 'key-down') {
      await page.keyboard.press(data.key);
    } else if (type === 'type') {
      await page.keyboard.type(data.text);
    }
  }

  async stopLogin(userId) {
    const session = this.browsers.get(userId);
    if (session) {
      await session.browser.close();
      this.browsers.delete(userId);
    }
  }
}
