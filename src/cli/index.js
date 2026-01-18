#!/usr/bin/env node
const { Command } = require('commander');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config();

const program = new Command();
const API_URL = process.env.BACKEND_URL || 'http://localhost:3000';

program
  .name('roblox-uploader')
  .description('CLI to automate Roblox game publishing')
  .version('1.0.0');

program.command('publish')
  .description('Publish a new or existing place')
  .option('-f, --file <path>', 'Path to the .rbxl or .rbxlx file')
  .option('-u, --universe <id>', 'Universe ID (if updating)')
  .option('-p, --place <id>', 'Place ID (if updating)')
  .option('-g, --group <id>', 'Group ID (if creating new)')
  .option('-t, --token <token>', 'CLI API Token')
  .action(async (options) => {
    const token = options.token || process.env.ROBLOX_CLI_TOKEN;
    if (!token) {
        console.error('Error: CLI token is required.');
        process.exit(1);
    }
    if (!options.file) {
        console.error('Error: File path is required.');
        process.exit(1);
    }

    const filePath = path.resolve(options.file);
    const form = new FormData();
    form.append('placeFile', fs.createReadStream(filePath));

    let endpoint = '/api/publish/new';
    if (options.universe && options.place) {
        endpoint = '/api/publish/update';
        form.append('universeId', options.universe);
        form.append('placeId', options.place);
    } else if (options.group) {
        form.append('groupId', options.group);
    }

    try {
        const response = await axios.post(`${API_URL}${endpoint}`, form, {
            headers: { ...form.getHeaders(), 'x-api-token': token }
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data?.error || error.message);
    }
  });

program.parse();
