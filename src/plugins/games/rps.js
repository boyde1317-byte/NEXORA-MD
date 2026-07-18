import { mixedCard } from '../../lib/interactiveKit.js';

export default {
  name: 'rps',
  aliases: ['rockpaperscissors'],
  category: 'games',
  description: 'Play Rock Paper Scissors. Usage: .rps [rock/paper/scissors]',
  cooldown: 3000,
  execute: async ({ sock, m, args, prefix }) => {
    const choices = ['rock', 'paper', 'scissors'];
    const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
    
    if (!args[0] || !choices.includes(args[0].toLowerCase())) {
      return await mixedCard(sock, m.from, {
        text: `✦ *ROCK PAPER SCISSORS* ✦\n\nChoose your weapon:`,
        footer: 'Powered by NEXORA'
      }, [
        { kind: 'action', label: '🪨 Rock', cmd: `${prefix}rps rock` },
        { kind: 'action', label: '📄 Paper', cmd: `${prefix}rps paper` },
        { kind: 'action', label: '✂️ Scissors', cmd: `${prefix}rps scissors` }
      ], { quoted: m });
    }
    
    const userChoice = args[0].toLowerCase();
    const botChoice = choices[Math.floor(Math.random() * choices.length)];
    
    let result = '';
    if (userChoice === botChoice) result = 'It\'s a tie!';
    else if (
      (userChoice === 'rock' && botChoice === 'scissors') ||
      (userChoice === 'paper' && botChoice === 'rock') ||
      (userChoice === 'scissors' && botChoice === 'paper')
    ) {
      result = 'You win! 🎉';
    } else {
      result = 'I win! 😈';
    }
    
    await mixedCard(sock, m.from, {
      text: `✦ *ROCK PAPER SCISSORS* ✦\n\nYou chose: ${emojis[userChoice]}\nI chose: ${emojis[botChoice]}\n\n*${result}*`,
      footer: 'Powered by NEXORA'
    }, [
      { kind: 'action', label: '🔄 Play Again', cmd: `${prefix}rps` }
    ], { quoted: m });
  }
};
