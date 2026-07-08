export default {
  name: 'tagall',
  aliases: ['everyone', 'all', 'announce'],
  category: 'group',
  description: 'Mentions and tags all participants in the group.',
  permissions: {
    groupOnly: true,
    admin: true
  },
  execute: async ({ sock, m, args }) => {
    const metadata = await m.getGroupMetadata();
    if (!metadata) {
      return await m.reply('❌ Could not retrieve group participant list.');
    }

    const participants = metadata.participants;
    const mentions = participants.map(p => p.id);
    
    const customMessage = args.join(' ') || 'Attention everyone!';
    
    let tagText = `📢 *GROUP ANNOUNCEMENT*\n\n`;
    tagText += `• *Message:* _${customMessage}_\n\n`;
    
    participants.forEach(p => {
      tagText += `@${p.id.split('@')[0]} `;
    });

    tagText += `\n\n_Total Tagged: ${participants.length}_`;

    await sock.sendMessage(m.from, {
      text: tagText,
      mentions
    });
  }
};
