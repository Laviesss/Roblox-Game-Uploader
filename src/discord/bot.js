const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const AuthManager = require('../auth/manager');
const AutomationPipeline = require('../automation/pipeline');
const { setupDb } = require('../utils/db');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent] });

const commands = [
    new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Roblox account to Discord')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check your linked Roblox account status')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('create-universe')
        .setDescription('Create a new Roblox universe and upload a place file')
        .addAttachmentOption(option => option.setName('file').setDescription('The .rbxl or .rbxlx file').setRequired(true))
        .addGroupOption(option => option.setName('group').setDescription('Group ID (optional)'))
        .toJSON(),
    new SlashCommandBuilder()
        .setName('publish')
        .setDescription('Update an existing Roblox place')
        .addIntegerOption(option => option.setName('universe').setDescription('Universe ID').setRequired(true))
        .addIntegerOption(option => option.setName('place').setDescription('Place ID').setRequired(true))
        .addAttachmentOption(option => option.setName('file').setDescription('The .rbxl or .rbxlx file').setRequired(true))
        .toJSON()
];

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const user = await AuthManager.getUserByDiscordId(interaction.user.id);

    if (interaction.commandName === 'link') {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const db = await setupDb();
        await db.run(
            'INSERT INTO discord_links (code, discord_id, expires_at) VALUES (?, ?, ?)',
            [code, interaction.user.id, Date.now() + 600000]
        );
        await interaction.reply({
            content: `To link your account, go to the dashboard and enter this code: **${code}**`,
            ephemeral: true
        });
        return;
    }

    if (interaction.commandName === 'status') {
        if (user) {
            await interaction.reply(`Linked to Roblox user: **${user.roblox_username}** (${user.roblox_id})`);
        } else {
            await interaction.reply('You haven\'t linked your Roblox account yet. Use `/link` to start.');
        }
        return;
    }

    if (!user) {
        return interaction.reply({ content: 'You must link your Roblox account first! Use `/link`.', ephemeral: true });
    }

    if (interaction.commandName === 'create-universe') {
        await interaction.deferReply();
        try {
            const attachment = interaction.options.getAttachment('file');
            const groupId = interaction.options.getInteger('group');
            const fileRes = await axios.get(attachment.url, { responseType: 'arraybuffer' });

            const result = await AutomationPipeline.createAndPublish(user.roblox_id, fileRes.data, { groupId });
            await interaction.editReply(`Successfully created universe! ID: **${result.universeId}**, Place ID: **${result.placeId}**`);
        } catch (error) {
            await interaction.editReply(`Error: ${error.message}`);
        }
    }

    if (interaction.commandName === 'publish') {
        await interaction.deferReply();
        try {
            const universeId = interaction.options.getInteger('universe');
            const placeId = interaction.options.getInteger('place');
            const attachment = interaction.options.getAttachment('file');
            const fileRes = await axios.get(attachment.url, { responseType: 'arraybuffer' });

            await AutomationPipeline.updateAndPublish(user.roblox_id, universeId, placeId, fileRes.data);
            await interaction.editReply(`Successfully updated place **${placeId}** in universe **${universeId}**!`);
        } catch (error) {
            await interaction.editReply(`Error: ${error.message}`);
        }
    }
});

async function startDiscordBot() {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
        console.warn('DISCORD_TOKEN not set. Discord bot disabled.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Registering Discord commands...');
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands }
        );
        await client.login(token);
        console.log('Discord bot online.');
    } catch (error) {
        console.error('Failed to start Discord bot:', error);
    }
}

module.exports = { startDiscordBot };
