import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder().setName('link').setDescription('Link your Discord account to RGU Platform')
    .addStringOption(option => option.setName('code').setDescription('The linking code from the website').setRequired(true)),
  new SlashCommandBuilder().setName('create-universe').setDescription('Create a new Roblox universe')
    .addStringOption(option => option.setName('name').setDescription('Universe name').setRequired(true)),
  new SlashCommandBuilder().setName('upload').setDescription('Upload a place file')
    .addAttachmentOption(option => option.setName('file').setDescription('The .rbxl file').setRequired(true)),
  new SlashCommandBuilder().setName('status').setDescription('Check status of jobs'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  if (commandName === 'link') {
    const code = interaction.options.getString('code');
    try {
      await axios.post(`${backendUrl}/api/discord/verify-link`, {
        code,
        discordId: interaction.user.id
      });
      await interaction.reply('Account linked successfully!');
    } catch (err) {
      await interaction.reply('Invalid or expired code.');
    }
  }

  if (commandName === 'create-universe') {
    const name = interaction.options.getString('name');
    await interaction.deferReply();
    try {
      const res = await axios.post(`${backendUrl}/api/roblox/create-universe-discord`, {
        discordId: interaction.user.id,
        name
      });
      await interaction.editReply(`Universe created: ${res.data.universeId}`);
    } catch (err) {
      await interaction.editReply(`Error: ${err.response?.data?.error || err.message}`);
    }
  }

  if (commandName === 'upload') {
    const attachment = interaction.options.getAttachment('file');
    await interaction.deferReply();
    try {
      // 1. Get pre-signed URL from backend
      const { data: presigned } = await axios.post(`${backendUrl}/api/r2/presigned-url`, {
        fileName: attachment.name,
        contentType: 'application/octet-stream'
      });

      // 2. Download from Discord and upload to R2
      const fileRes = await axios.get(attachment.url, { responseType: 'arraybuffer' });
      await axios.put(presigned.url, fileRes.data, {
        headers: { 'Content-Type': 'application/octet-stream' }
      });

      await interaction.editReply(`Uploaded to Cloud! Key: ${presigned.key}`);
    } catch (err) {
      await interaction.editReply(`Upload failed: ${err.message}`);
    }
  }

  if (commandName === 'status') {
    await interaction.deferReply();
    try {
      const { data } = await axios.get(`${backendUrl}/api/discord/status/${interaction.user.id}`);
      let reply = '**Recent Jobs:**\n';
      data.jobs.forEach(j => {
        reply += `\`${j.id.substring(0, 8)}\` | ${j.status} | ${j.details?.completed}/${j.details?.total}\n`;
      });
      reply += '\n**Recent Logs:**\n';
      data.logs.forEach(l => {
        reply += `[${new Date(l.createdAt).toLocaleTimeString()}] ${l.message}\n`;
      });
      await interaction.editReply(reply);
    } catch (err) {
      await interaction.editReply('User not linked or error fetching status.');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
