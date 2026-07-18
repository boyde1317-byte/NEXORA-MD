export const asciiBuilder = {
  box(title, lines = []) {
    const formattedLines = [];
    if (title) {
      formattedLines.push(`✦ *${title.toUpperCase()}* ✦\n`);
    }
    
    lines.forEach(line => {
      formattedLines.push(`${line}`);
    });

    return formattedLines.join('\n');
  },

  list(title, items = []) {
    const formattedLines = [];
    const bulletIcon = '✦';

    if (title) {
      formattedLines.push(`✦ *${title.toUpperCase()}* ✦\n`);
    }

    items.forEach(item => {
      formattedLines.push(`${bulletIcon} ${item}`);
    });

    return formattedLines.join('\n');
  },

  card(title, entries = []) {
    const formattedLines = [];
    if (title) {
      formattedLines.push(`✦ *${title.toUpperCase()}* ✦\n`);
    }

    entries.forEach(entry => {
      formattedLines.push(`☕ ${entry}`);
    });

    return formattedLines.join('\n');
  }
};

export default asciiBuilder;
