const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Logger = require('../logger');

const logger = new Logger('HelpCommand');

module.exports = {
  name: 'help',
  description: 'View bot features and commands',

  async execute(message, args, client) {
    try {
      // Main embed
      const mainEmbed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📖 Epic Bot Help Center')
        .setDescription('Complete guide to all bot features and commands')
        .setThumbnail(client.user.avatarURL())
        .addFields(
          {
            name: '🎮 MAIN FEATURES',
            value: 'Core auto-detection features that monitor EPIC RPG events',
            inline: false,
          },
          {
            name: '🌧️ Coin Rain Detection',
            value:
              '• Auto-detects coin rain events\n• Mentions @Catch role for 1Q+ coins\n• Shows max reward amount\n• Real-time notifications',
            inline: false,
          },
          {
            name: '🎁 Lootbox Summoning',
            value:
              '• Auto-detects lootbox events\n• Mentions @Summon role\n• Changes bot name to EPIC BOT\n• Instant announcements',
            inline: false,
          },
          {
            name: '🎯 UTILITY COMMANDS',
            value: 'Essential commands to manage and monitor the bot',
            inline: false,
          },
          {
            name: '📊 Bot Management',
            value:
              '`eb status` - Complete bot statistics\n`eb help` - This help menu\n`eb about` - Bot information',
            inline: false,
          },
          {
            name: '🎲 FUN & ACTION COMMANDS',
            value: 'Interactive commands for server entertainment',
            inline: false,
          },
          {
            name: '🎭 Action Commands',
            value:
              '`eb boo @user` - Scare someone 👻\n`eb hug @user` - Give a warm hug 🤗\n`eb slap @user` - Playful slap 👋\n`eb bonk @user` - Send to horny jail 🔨\n`eb poke @user` - Annoying poke 👉',
            inline: false,
          },
          {
            name: '🔔 MENTION SYSTEM',
            value: 'Automatic responses when you are mentioned',
            inline: false,
          },
          {
            name: '📌 Mention Features',
            value:
              '• Auto-sends random stickers when mentioned\n• Responds instantly\n• Multiple sticker variations\n• Supports all mention formats',
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: 'Epic Bot | Type eb [command] to use',
          iconURL: client.user.avatarURL(),
        });

      // Buttons
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('help_features')
            .setLabel('All Features')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('help_commands')
            .setLabel('All Commands')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('help_prefix')
            .setLabel('Prefix Info')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('help_about')
            .setLabel('About Bot')
            .setStyle(ButtonStyle.Danger)
        );

      const reply = await message.channel.send({ 
        embeds: [mainEmbed],
        components: [buttons]
      });

      // Button interaction handler
      const collector = reply.createMessageComponentCollector({ 
        time: 60000 
      });

      collector.on('collect', async (interaction) => {
        // Only allow the person who used the command
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({ 
            content: '❌ Only the command user can use these buttons!', 
            ephemeral: true 
          });
          return;
        }

        if (interaction.customId === 'help_features') {
          const featuresEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✨ Complete Feature List')
            .addFields(
              {
                name: '🌧️ Auto Event Detection',
                value: 'Monitors EPIC RPG messages in real-time',
              },
              {
                name: '🎁 Dual Event System',
                value: 'Detects both coin rain and lootbox events',
              },
              {
                name: '📢 Role Mentions',
                value: 'Mentions appropriate roles for events',
              },
              {
                name: '🎭 Action Commands',
                value: '6 interactive action commands available',
              },
              {
                name: '🔔 Mention System',
                value: 'Auto-responds with stickers when mentioned',
              },
              {
                name: '🤖 Smart Bot',
                value: 'Learns and adapts to server needs',
              },
              {
                name: '⚡ Instant Response',
                value: 'Responds within milliseconds',
              }
            )
            .setTimestamp();

          await interaction.update({ embeds: [featuresEmbed] });
        }

        else if (interaction.customId === 'help_commands') {
          const commandsEmbed = new EmbedBuilder()
            .setColor('#FF9900')
            .setTitle('⌨️ Complete Command List')
            .addFields(
              {
                name: '📊 Status & Info',
                value: '`eb status` - Bot status\n`eb help` - Help menu\n`eb about` - About bot',
                inline: true,
              },
              {
                name: '📝 Usage Tips',
                value: 'All commands work with prefix: **eb**\nExample: `eb status` or `EB STATUS`\nPrefix is case-insensitive',
                inline: false,
              }
            )
            .setTimestamp();

          await interaction.update({ embeds: [commandsEmbed] });
        }

        else if (interaction.customId === 'help_prefix') {
          const prefixEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🔤 Prefix Information')
            .addFields(
              {
                name: 'Current Prefix',
                value: '`eb`',
                inline: true,
              },
              {
                name: 'Case Sensitive?',
                value: 'No - Works with EB, Eb, eB',
                inline: true,
              },
              {
                name: 'Examples',
                value: '`eb status` ✅\n`EB status` ✅\n`Eb STATUS` ✅\n`eB StAtUs` ✅',
                inline: false,
              },
              {
                name: 'Auto Features',
                value: 'Coin Rain & Lootbox detection work WITHOUT prefix',
                inline: false,
              }
            )
            .setTimestamp();

          await interaction.update({ embeds: [prefixEmbed] });
        }

        else if (interaction.customId === 'help_about') {
          const aboutEmbed = new EmbedBuilder()
            .setColor('#FF1493')
            .setTitle('ℹ️ About Epic Bot')
            .addFields(
              {
                name: '🎮 Purpose',
                value: 'Epic Bot is your ultimate EPIC RPG companion. Monitors in-game events and provides instant notifications.',
                inline: false,
              },
              {
                name: '👨‍💻 Developer',
                value: '<@782630678389981244>',
                inline: true,
              },
              {
                name: '📅 Version',
                value: 'v1.0.0',
                inline: true,
              },
              {
                name: '🚀 Uptime',
                value: `${client.uptime ? Math.floor(client.uptime / 1000 / 60 / 60) + 'h' : 'Just started'}`,
                inline: true,
              },
              {
                name: '📊 Serving',
                value: `${client.guilds.cache.size} guilds`,
                inline: true,
              },
              {
                name: '⚡ Performance',
                value: `${client.ws.ping}ms ping`,
                inline: true,
              },
              {
                name: '🌟 Features',
                value: '✅ 6+ Action Commands\n✅ Real-time Event Detection\n✅ Auto Role Mentions\n✅ Smart Mention System\n✅ Always Improving',
                inline: false,
              },
              {
                name: '📈 Future Updates',
                value: 'More commands and features added regularly! Check back soon for updates.',
                inline: false,
              }
            )
            .setThumbnail(client.user.avatarURL())
            .setTimestamp();

          await interaction.update({ embeds: [aboutEmbed] });
        }
      });

      // Cleanup after 60 seconds
      collector.on('end', () => {
        reply.edit({ components: [] }).catch(() => {});
      });

      logger.info(`Help command used by ${message.author.tag}`);
    } catch (error) {
      logger.error('Error in help command:', error.message);
      await message.channel.send('❌ An error occurred!');
    }
  },
};