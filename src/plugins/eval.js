export default {
  name: 'eval',
  aliases: ['>'],
  category: 'owner',
  description: 'Executes JavaScript expressions directly on the node process (restricted to owner).',
  permissions: {
    owner: true
  },
  execute: async ({ sock, m, args, db }) => {
    const code = args.join(' ');
    if (!code) {
      return await m.reply('❌ No code provided. Usage: `> code` or `!eval code`.');
    }

    try {
      // Execute the JavaScript string
      let result = eval(code);
      
      // Resolve promise if result is asynchronous
      if (result instanceof Promise) {
        result = await result;
      }

      // Format output nicely
      const output = typeof result === 'object' 
        ? JSON.stringify(result, null, 2) 
        : String(result);

      await m.reply(`✅ *Result:*\n\`\`\`javascript\n${output}\n\`\`\``);
    } catch (err) {
      await m.reply(`❌ *Evaluation Error:*\n\`\`\`\n${err.stack || err.message}\n\`\`\``);
    }
  }
};
