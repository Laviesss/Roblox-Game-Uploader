import puppeteer from 'puppeteer';
import { decrypt, serializeBigInt, logger } from '@rgu/shared';

export class AccountPoolExhaustedError extends Error {
  constructor() {
    super('AccountPoolExhaustedError: No active accounts available in the pool.');
    this.name = 'AccountPoolExhaustedError';
  }
}

export class RobloxAuthService {
  /**
   * @param {import('@prisma/client').PrismaClient} prisma
   * @param {string} encryptionKey
   */
  constructor(prisma, encryptionKey) {
    this.prisma = prisma;
    this.encryptionKey = encryptionKey;
    this.cooldownMinutes = 5;
  }

  /**
   * Retrieves a verified-live Puppeteer Page from an active account in the pool.
   * Handles autonomous rotation and real-time database updates for dead accounts.
   * @param {string} userId - The ID of the user who owns the account pool.
   * @returns {Promise<import('puppeteer').Page>} A ready-to-use Puppeteer Page.
   * @throws {AccountPoolExhaustedError} If no active accounts are available.
   */
  async getAuthenticatedPage(userId) {
    // 1. Fetch the oldest ACTIVE account in the pool
    const account = await this.prisma.robloxAccount.findFirst({
      where: {
        userId: userId,
        status: 'ACTIVE',
      },
      orderBy: {
        lastUsed: 'asc',
      },
    });

    if (!account) {
      logger.error('Authentication failed: Account pool is exhausted.', { userId });
      throw new AccountPoolExhaustedError();
    }

    // 2. Cooldown check (5-minute minimum rest)
    if (account.lastUsed) {
      const now = new Date();
      const diffMinutes = (now - new Date(account.lastUsed)) / (1000 * 60);
      if (diffMinutes < this.cooldownMinutes) {
        const waitTime = Math.ceil(this.cooldownMinutes - diffMinutes);
        logger.warn(`RateLimitRest: Oldest account ${account.username} is resting.`, {
          username: account.username,
          waitTimeMinutes: waitTime
        });
        throw new Error(`RateLimitRest: Account ${account.username} is on cooldown for another ${waitTime} minutes.`);
      }
    }

    let browser;
    try {
      // 3. Initialize Puppeteer with realistic fingerprinting strategy
      browser = await puppeteer.launch({
        headless: 'new',
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
      await page.setViewport({ width: 1440, height: 900 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

      // 4. Inject Roblox Session Cookie
      const rawCookie = decrypt(account.cookie, this.encryptionKey);
      await page.setCookie({
        name: '.ROBLOSECURITY',
        value: rawCookie,
        domain: '.roblox.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      });

      // 5. Navigate and Perform Hybrid Validation (API + DOM)
      await page.goto('https://www.roblox.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });

      const validation = await page.evaluate(async () => {
        const result = { apiStatus: 'UNKNOWN', domStatus: 'OK' };

        // In-page API check to avoid server-side flagging
        try {
          const res = await fetch('https://users.roblox.com/v1/users/authenticated');
          if (res.status === 200) result.apiStatus = 'OK';
          else if (res.status === 401) result.apiStatus = 'EXPIRED';
          else if (res.status === 403) result.apiStatus = 'BANNED';
          else result.apiStatus = `ERROR_${res.status}`;
        } catch (e) {
          result.apiStatus = 'NETWORK_ERROR';
        }

        // Secondary DOM Check
        const bodyText = document.body.innerText;
        if (bodyText.includes('Account Terminated') || bodyText.includes('Banned') || bodyText.includes('Deleted')) {
          result.domStatus = 'BANNED';
        } else if (bodyText.includes('Challenge') || bodyText.includes('Captcha') || bodyText.includes('Verify your email')) {
          result.domStatus = 'LOCKED';
        } else if (window.location.href.includes('/login')) {
          result.domStatus = 'EXPIRED';
        }

        return result;
      });

      // Determine final status based on multi-stage feedback
      let finalStatus = 'OK';
      if (validation.apiStatus === 'BANNED' || validation.domStatus === 'BANNED') finalStatus = 'BANNED';
      else if (validation.domStatus === 'LOCKED') finalStatus = 'LOCKED';
      else if (validation.apiStatus === 'EXPIRED' || validation.domStatus === 'EXPIRED') finalStatus = 'EXPIRED';
      else if (validation.apiStatus !== 'OK') finalStatus = 'EXPIRED'; // Fallback for edge cases

      if (finalStatus === 'OK') {
        // 6. Success: Update Rotation Metadata
        await this.prisma.robloxAccount.update({
          where: { id: account.id },
          data: {
            lastUsed: new Date(),
            useCount: { increment: 1 }
          }
        });

        logger.info(`Session verified for account: ${account.username}`, serializeBigInt({
          username: account.username,
          useCount: account.useCount + 1,
          lastUsed: new Date()
        }));

        return page;
      } else {
        // 7. Failure: Flag Account, Cleanup, and Pivot (Recurse)
        logger.warn(`Account ${account.username} failed validation: ${finalStatus}. Rotating...`, {
          username: account.username,
          status: finalStatus
        });

        await this.prisma.robloxAccount.update({
          where: { id: account.id },
          data: { status: finalStatus }
        });

        await browser.close();
        return this.getAuthenticatedPage(userId);
      }
    } catch (error) {
      if (browser) await browser.close();

      // If it's a technical/timeout error, don't necessarily ban the account, but log it
      logger.error(`Critical error in RobloxAuthService for ${account.username}: ${error.message}`, {
        error: error.stack
      });
      throw error;
    }
  }
}
