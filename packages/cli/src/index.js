#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const CONFIG_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.rgu-config.json');

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  return {};
}

const api = axios.create({ baseURL: BACKEND_URL });
api.interceptors.request.use(config => {
  const { token } = loadConfig();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

program
  .name('rgu-cli')
  .description('Roblox Publishing Platform CLI')
  .version('1.0.0');

program
  .command('login')
  .description('Authenticate with the backend')
  .argument('<token>', 'Backend issued CLI token')
  .action((token) => {
    saveConfig({ token });
    console.log(chalk.green('Token saved successfully!'));
  });

program
  .command('create-universe')
  .description('Create a new Roblox universe')
  .argument('<name>', 'Universe name')
  .action(async (name) => {
    try {
      const res = await api.post('/api/roblox/create-universe', { name });
      console.log(chalk.green(`Universe created: ${res.data.universeId} (Root Place: ${res.data.rootPlaceId})`));
    } catch (err) {
      console.error(chalk.red(`Error: ${err.response?.data?.error || err.message}`));
    }
  });

program
  .command('upload')
  .description('Upload a file or directory of files to R2')
  .argument('<path>', 'Path to .rbxl file or directory')
  .option('-c, --concurrency <number>', 'Concurrency limit', '3')
  .option('-u, --universe <id>', 'Universe ID for immediate batch processing', '0')
  .option('-p, --place <id>', 'Place ID for immediate batch processing', '0')
  .action(async (uploadPath, options) => {
    const resolvedPath = path.resolve(uploadPath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(chalk.red('Path not found'));
      return;
    }

    const files = fs.statSync(resolvedPath).isDirectory()
      ? fs.readdirSync(resolvedPath).filter(f => f.endsWith('.rbxl') || f.endsWith('.rbxlx')).map(f => path.join(resolvedPath, f))
      : [resolvedPath];

    if (files.length === 0) {
      console.error(chalk.red('No valid files found'));
      return;
    }

    console.log(chalk.blue(`Found ${files.length} files. Starting upload...`));

    try {
      const uploadedKeys = [];
      for (const file of files) {
        console.log(`Uploading ${path.basename(file)}...`);
        const { data } = await api.post('/api/r2/presigned-url', {
          fileName: path.basename(file),
          contentType: 'application/octet-stream'
        });

        const fileBuffer = fs.readFileSync(file);
        await axios.put(data.url, fileBuffer, {
          headers: { 'Content-Type': 'application/octet-stream' }
        });
        uploadedKeys.push(data.key);
      }

      console.log(chalk.green(`All files uploaded to Cloud.`));

      if (options.universe !== '0') {
        console.log(chalk.blue('Starting batch upload job on Roblox...'));
        const { data: job } = await api.post('/api/roblox/batch-upload', {
          universeId: parseInt(options.universe),
          placeId: parseInt(options.place),
          files: uploadedKeys,
          concurrency: parseInt(options.concurrency)
        });
        console.log(chalk.green(`Batch job started! ID: ${job.id}`));
      }
    } catch (err) {
      console.error(chalk.red(`Upload failed: ${err.response?.data?.error || err.message}`));
    }
  });

program
  .command('publish')
  .description('Publish an uploaded file to Roblox')
  .argument('<key>', 'R2 file key')
  .argument('<universeId>', 'Roblox Universe ID')
  .argument('<placeId>', 'Roblox Place ID')
  .action(async (key, universeId, placeId) => {
    try {
      const res = await api.post('/api/roblox/publish', { key, universeId, placeId });
      console.log(chalk.green(`Published successfully: ${JSON.stringify(res.data)}`));
    } catch (err) {
      console.error(chalk.red(`Publish failed: ${err.response?.data?.error || err.message}`));
    }
  });

program
  .command('status')
  .description('Check status of recent jobs and logs')
  .action(async () => {
    try {
      const { data: jobs } = await api.get('/api/jobs');
      const { data: logs } = await api.get('/api/logs');

      console.log(chalk.bold('\nRecent Jobs:'));
      jobs.slice(0, 5).forEach(j => {
        console.log(`${j.id.substring(0, 8)} | ${j.type} | ${j.status} | ${j.details?.completed}/${j.details?.total}`);
      });

      console.log(chalk.bold('\nRecent Logs:'));
      logs.slice(0, 10).forEach(l => {
        console.log(`[${new Date(l.createdAt).toLocaleTimeString()}] ${l.level}: ${l.message}`);
      });
    } catch (err) {
      console.error(chalk.red(`Failed to fetch status: ${err.message}`));
    }
  });

program.parse();
