import newsletterManager from '../newsletter/newsletterManager.js';

export default {
  name: 'channel',
  aliases: ['newsletter', 'ch'],
  category: 'general',
  description: 'Manages or views WhatsApp newsletters and channels (Special fork capability).',
  cooldown: 4000,
  execute: async ({ sock, m, args }) => {
    const action = args[0]?.toLowerCase();

    if (!action) {
      await m.reply('⏳ _Generating and sending channel invitation card..._');
      try {
        await newsletterManager.sendNewsletterInvite(sock, m.from, { forwardingEnabled: true }, { quoted: m });
      } catch (err) {
        console.error('Failed to send newsletter invite:', err);
        let helpText = `📢 *WHATSAPP CHANNEL MANAGER*\n\n`;
        helpText += `• *Create a Channel:*\n  \`!channel create MyChannelName | Description\`\n`;
        helpText += `• *Get Channel Info:*\n  \`!channel info https://whatsapp.com/channel/... or JID\`\n`;
        helpText += `• *Subscribe/Follow:*\n  \`!channel follow ChannelJID\`\n`;
        helpText += `• *Unsubscribe/Unfollow:*\n  \`!channel unfollow ChannelJID\`\n`;
        await m.reply(helpText.trim());
      }
      return;
    }

    // Verify if socket possesses the custom newsletter properties
    if (typeof sock.newsletterCreate !== 'function') {
      return await m.reply('❌ The active socket layer does not support native newsletter operations.');
    }

    try {
      if (action === 'create') {
        const remainingArgs = args.slice(1).join(' ');
        if (!remainingArgs) {
          return await m.reply('❌ Usage: `!channel create Channel Name | Description`');
        }

        const parts = remainingArgs.split('|').map(p => p.trim());
        const name = parts[0];
        const description = parts[1] || 'No description provided.';

        if (!name) {
          return await m.reply('❌ Please provide a valid non-empty channel name.');
        }

        await m.reply('⏳ _Sending creation request to WhatsApp MEX servers..._');
        const metadata = await sock.newsletterCreate(name, description);
        
        let successMsg = `✅ *Channel Created Successfully!*\n\n`;
        successMsg += `• *Name:* ${metadata.name}\n`;
        successMsg += `• *JID:* \`${metadata.id}\`\n`;
        successMsg += `• *Subscribers:* ${metadata.subscribers || 0}\n`;
        successMsg += `• *Invite Code:* ${metadata.invite || 'None'}\n`;
        await m.reply(successMsg.trim());

      } else if (action === 'info') {
        const targetKey = args[1];
        if (!targetKey) {
          return await m.reply('❌ Usage: `!channel info <Channel Link or JID>`');
        }

        await m.reply('⏳ _Querying channel metadata..._');
        let info = null;

        if (targetKey.includes('whatsapp.com/channel/')) {
          // Resolve URL to JID first
          const resolved = await sock.newsletterId(targetKey);
          if (!resolved) {
            return await m.reply('❌ Failed to resolve the channel URL to a valid ID.');
          }
          info = await sock.newsletterMetadata('jid', resolved.id);
        } else {
          info = await sock.newsletterMetadata('jid', targetKey);
        }

        if (!info) {
          return await m.reply('❌ Could not retrieve metadata for this channel.');
        }

        let infoMsg = `📢 *CHANNEL METADATA RESULT*\n\n`;
        infoMsg += `• *Name:* ${info.name}\n`;
        infoMsg += `• *JID:* \`${info.id}\`\n`;
        infoMsg += `• *Subscribers:* ${info.subscribers || 0}\n`;
        infoMsg += `• *Creation:* ${new Date(info.creation_time * 1000).toLocaleString()}\n`;
        infoMsg += `• *Muted:* ${info.mute_state ? 'Yes' : 'No'}\n`;
        infoMsg += `• *Description:* _${info.description || 'None'}_\n`;
        await m.reply(infoMsg.trim());

      } else if (action === 'follow') {
        const jid = args[1];
        if (!jid) {
          return await m.reply('❌ Usage: `!channel follow <Channel JID>`');
        }

        await m.reply('⏳ _Sending follow request..._');
        await sock.newsletterFollow(jid);
        await m.reply('✅ Successfully subscribed/followed channel!');

      } else if (action === 'unfollow') {
        const jid = args[1];
        if (!jid) {
          return await m.reply('❌ Usage: `!channel unfollow <Channel JID>`');
        }

        await m.reply('⏳ _Sending unfollow request..._');
        await sock.newsletterUnfollow(jid);
        await m.reply('✅ Successfully unsubscribed/unfollowed channel.');
      } else {
        await m.reply('❌ Invalid action. Choose: `create`, `info`, `follow`, or `unfollow`.');
      }
    } catch (err) {
      console.error('Channel operation failed:', err);
      await m.reply(`❌ Operation failed: ${err.message}`);
    }
  }
};
