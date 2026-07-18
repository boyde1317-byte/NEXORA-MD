
export default {
  name: 'eval',
  aliases: ['>'],
  category: 'owner',
  description: 'Executes JavaScript expressions directly on the node process.',
  permissions: {
    owner: true
  },
  execute: async ({ sock, m, args, db }) => {
    const code = args.join(' ');
    if (!code) {
      return await m.reply.error('No code provided.');
    }

    try {
      let result = eval(code);
      if (result instanceof Promise) result = await result;
      
      const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
      await m.reply(`✦ *Result:*\n\`\`\`javascript\n${output}\n\`\`\``);
    } catch (err) {
      await m.reply.error(`${err.stack || err.message}`);
    }
  }
};
