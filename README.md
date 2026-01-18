# Roblox Publishing Platform

A fully automated, production-grade Roblox publishing platform featuring a Web Dashboard, Discord Bot, and CLI.

## 🚀 Deployment Guide

This project is designed to be deployed using the following free-tier services:
- **Database:** [Neon](https://neon.tech/) (PostgreSQL)
- **Backend:** [Render](https://render.com/) or Railway
- **Frontend:** [Vercel](https://vercel.com/)
- **Storage:** [Cloudflare R2](https://www.cloudflare.com/products/orchestrator/r2/)

### 1. Database Setup (Neon)
1. Create a project on Neon.
2. Copy the **Connection String**.
3. Add `?sslmode=require` to the end of the string if it's not there.
4. Set this as `DATABASE_URL` in your environment variables.

### 2. Storage Setup (Cloudflare R2)
1. Create a Bucket in Cloudflare R2.
2. Generate an **API Token** with Edit permissions.
3. Capture the `Access Key ID`, `Secret Access Key`, and `S3 Endpoint`.
4. Set these in your `.env` (see `.env.example`).

### 3. Backend Deployment (Render)
1. Connect your GitHub repo to Render.
2. Select **Web Service** and use `packages/backend/Dockerfile`.
3. Add all environment variables from `.env.example`.
4. **Important:** Render free tier spins down after inactivity. Use a service like [Cron-job.org](https://cron-job.org/) to ping your backend URL every 14 minutes to keep it alive.

### 4. Frontend Deployment (Vercel)
1. Connect your repo to Vercel.
2. Set the **Root Directory** to `packages/web`.
3. Add `NEXT_PUBLIC_BACKEND_URL` and `BACKEND_URL` pointing to your Render service.
4. Add `NEXTAUTH_SECRET` and `NEXTAUTH_URL` (your Vercel URL).

---

## 🛠 Local Development

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Setup Environment:**
   Copy `.env.example` to `.env` and fill in the values.

3. **Database Initialization:**
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

4. **Run Services:**
   - Backend: `npm run dev:backend`
   - Web: `npm run dev:web`
   - Discord: `npm run dev:discord`

5. **Install CLI:**
   ```bash
   npm run install:cli
   ```

---

## 🔒 Security & Concurrency
- **Encryption:** All Roblox cookies are encrypted with AES-256-GCM before being stored in the database.
- **Batching:** Default concurrency for uploads is set to 3 to prevent Roblox rate limits.
- **MFA:** The WebView login supports 2FA challenges. The backend streams the browser frame, allowing you to enter codes manually.


