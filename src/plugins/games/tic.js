/**
 * tic.js — .tic / .tictactoe / .ttt — Tic Tac Toe game (solo vs bot, or
 * duo vs a mentioned friend) as an in-chat HTML surface with music.
 *
 * Ported from LUNA MD plugins/tic.js.
 *
 * Differences from the original:
 *   - Rebrand: "MOONSON x LUNA" / "LUNA MD • DEV MOONSON" -> "NEXORA MD".
 *   - `conn` -> `sock`, `m.chat` -> `m.from`, `m.pushName` -> the house
 *     `getDisplayName(sock, m.sender)`; the friend's name comes from
 *     `getDisplayName(sock, mention)` instead of `conn.getName`.
 *   - The relay now follows the house HTML-game pattern from ping3.js:
 *     the STRIPPED-style hardcoded secret is replaced by a fresh
 *     `crypto.randomBytes(32)` messageSecret and a fresh
 *     `crypto.randomUUID()` botResponseId per send, the shared scene
 *     verification blob (same signature constant + certificate chain from
 *     src/assets/htmlgames/certificate.json) is attached, and
 *     trusted_sources / url point at nexora.dev. response_id rebranded to
 *     `nexora-tic-<ts>`. On relay failure it falls back to a plain-text
 *     reply instead of failing silently.
 *   - The game HTML/JS itself is unchanged (menu, 3x3/4x4/8x8 boards,
 *     easy/medium/hard bot, sounds, scores).
 *   - Note: the bot JID in forwardedAiBotMessageInfo is kept as the
 *     house port kept it in ping3.js ('867051314767696@bot').
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDisplayName } from '../../lib/displayName.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scene verification blob, shared with src/lib/htmlGames.js (same value
// every scene bot ships) — see ping3.js.
const VERIFICATION_SIGNATURE =
  'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==';
const CERT_PATH = path.resolve(__dirname, '../../assets/htmlgames/certificate.json');
let certificateChainCache;
function loadCertificateChain() {
  if (certificateChainCache) return certificateChainCache;
  try {
    const raw = fs.readFileSync(CERT_PATH, 'utf-8');
    const chain = JSON.parse(raw);
    certificateChainCache = Array.isArray(chain) ? chain : [];
  } catch (_) {
    certificateChainCache = [];
  }
  return certificateChainCache;
}

const buildHTML = (isDuo, p1, p2) => `
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none}
body{margin:0;background:transparent;color:#fff;font-family:Arial;text-align:center}
.game{max-width:500px;margin:auto;padding:16px}
h1{margin:0;font-size:28px}
.sub{font-size:10px;color:#777;margin:6px 0 12px;letter-spacing:1px}
.bar{display:flex;justify-content:center;align-items:center;gap:10px;background:#13151c;border:1px solid #252833;border-radius:10px;padding:8px;margin-bottom:12px;font-size:11px;color:#aaa}
.dot{width:6px;height:6px;border-radius:50%;background:#67e6a5;box-shadow:0 0 8px #67e6a5}
.menu{display:grid;gap:10px}
select,button{width:100%;border-radius:12px;padding:14px;font-weight:bold;border:0;font-size:14px}
select{background:#171922;color:#fff;border:1px solid #292c38}
.btn{cursor:pointer;background:#5b7cff;color:#fff}
.btn2{background:#171922;color:#fff;border:1px solid #292c38}
.score{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0}
.box{background:#13151c;border:1px solid #252833;border-radius:12px;padding:10px 0}
.box small{display:block;color:#777;font-size:9px}
.box strong{font-size:20px}
.status{height:24px;margin-bottom:8px;font-size:14px}
.status.win{color:#5bff9b}.status.lose{color:#ff5577}
.board{width:90vw;max-width:420px;aspect-ratio:1;margin:auto;display:grid;gap:5px;background:#252833;border-radius:14px;padding:5px}
.cell{background:#11131a;border-radius:8px;font-size:38px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:0;color:#fff}
.cell.x{color:#5b7cff}.cell.o{color:#ff5577}
.cell.w{background:#1e3a2f}
.footer{margin-top:16px;font-size:8px;color:#555}
</style></head><body>
<div class="game">
<h1>TIC TAC TOE</h1>
<div class="sub">${isDuo ? `DUO: ${p1} VS ${p2} - BY NEXORA MD` : 'SOLO VS BOT - BY NEXORA MD'}</div>

<div class="bar"><span class="dot"></span><span id="musicState">MUSIC: ON</span><button id="muteBtn" style="width:auto;padding:4px 12px;font-size:10px;background:#252833;color:#fff;border-radius:8px">MUTE</button></div>

<div id="menuDiv" class="menu">
<select id="modeSel">
${isDuo ? '<option value="friend" selected>VS FRIEND - ONLINE</option>' : '<option value="easy">BOT - EASY</option><option value="medium" selected>BOT - MEDIUM</option><option value="hard">BOT - HARD</option><option value="friend">VS FRIEND - SAME PHONE</option>'}
</select>
<select id="sizeSel"><option value="3" selected>3x3</option><option value="4">4x4</option><option value="8">8x8</option></select>
<button id="startBtn" class="btn">START GAME</button>
</div>

<div id="gameDiv" style="display:none">
<div class="score">
<div class="box"><small id="l1">YOU X</small><strong id="s1">0</strong></div>
<div class="box"><small>DRAW</small><strong id="sD">0</strong></div>
<div class="box"><small id="l2">BOT O</small><strong id="s2">0</strong></div>
</div>
<div id="stat" class="status">Turn X</div>
<div id="board" class="board"></div>
<button id="backBtn" class="btn2" style="margin-top:12px">MENU</button>
</div>
<div class="footer">NEXORA MD</div>
</div>

<script>
var menuDiv=document.getElementById('menuDiv');
var gameDiv=document.getElementById('gameDiv');
var boardEl=document.getElementById('board');
var statEl=document.getElementById('stat');
var modeSel=document.getElementById('modeSel');
var sizeSel=document.getElementById('sizeSel');
var s1=document.getElementById('s1'),s2=document.getElementById('s2'),sD=document.getElementById('sD');
var l1=document.getElementById('l1'),l2=document.getElementById('l2');
var muteBtn=document.getElementById('muteBtn'),musicState=document.getElementById('musicState');

var size=3,board=[],over=false,vsFriend=${isDuo ? 'true' : 'false'},current='X',mode='medium',scores={a:0,b:0,d:0};
var ctx=null,gain=null,oscA=null,oscB=null,musicOn=true,loopTimer=null;

function initAudio(){
  if(!ctx){ ctx=new (window.AudioContext||window.webkitAudioContext)(); }
  if(ctx.state==='suspended') ctx.resume();
}
function playTick(){
  if(!ctx) return;
  var o=ctx.createOscillator(), g=ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.frequency.value=850; g.gain.value=0.12; o.type='square';
  o.start(); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.07); o.stop(ctx.currentTime+0.07);
}
function playWin(){
  if(!ctx) return;
  var o=ctx.createOscillator(), g=ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.frequency.value=500; g.gain.value=0.25; o.start();
  o.frequency.linearRampToValueAtTime(1000, ctx.currentTime+0.4);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.8);
  o.stop(ctx.currentTime+0.8);
}
function playLose(){
  if(!ctx) return;
  var o=ctx.createOscillator(), g=ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.frequency.value=300; g.gain.value=0.2; o.start(); o.frequency.linearRampToValueAtTime(80, ctx.currentTime+0.3); o.stop(ctx.currentTime+0.35);
}
function startBg(){
  if(!musicOn) return;
  initAudio(); stopBg();
  gain=ctx.createGain(); gain.gain.value=0.05; gain.connect(ctx.destination);
  oscA=ctx.createOscillator(); oscB=ctx.createOscillator();
  oscA.type='sine'; oscB.type='triangle';
  oscA.frequency.value=196; oscB.frequency.value=98;
  oscA.connect(gain); oscB.connect(gain); oscA.start(); oscB.start();
  var notes=[196,220,246,261,293,261,246,220];
  var i=0;
  loopTimer=setInterval(function(){
    if(!ctx||!musicOn) return;
    try{ oscA.frequency.linearRampToValueAtTime(notes[i%notes.length], ctx.currentTime+0.5); i++; }catch(e){}
  },700);
  musicState.textContent='MUSIC: ON ♫';
}
function stopBg(){
  if(loopTimer) clearInterval(loopTimer);
  try{oscA&&oscA.stop()}catch(e){} try{oscB&&oscB.stop()}catch(e){}
  oscA=null; oscB=null; loopTimer=null;
}

muteBtn.addEventListener('click', function(){
  initAudio();
  musicOn=!musicOn;
  if(musicOn){ startBg(); muteBtn.textContent='MUTE'; musicState.textContent='MUSIC: ON ♫'; }
  else { stopBg(); muteBtn.textContent='PLAY'; musicState.textContent='MUSIC: OFF'; }
});

function newGame(){
  size=parseInt(sizeSel.value); mode=modeSel.value; vsFriend=(mode==='friend');
  board=Array(size*size).fill(''); over=false; current='X';
  if(vsFriend){ l1.textContent='${p1} X'; l2.textContent='${p2} O'; } else { l1.textContent='YOU X'; l2.textContent='BOT O'; }
  boardEl.style.gridTemplateColumns='repeat('+size+',1fr)';
  statEl.textContent='Turn '+current;
  statEl.className='status';
  draw();
}
function draw(){
  boardEl.innerHTML='';
  for(var i=0;i<board.length;i++){
    var c=document.createElement('button');
    c.className='cell'+(board[i]==='X'?' x':board[i]==='O'?' o':'');
    c.textContent=board[i];
    (function(idx){ c.addEventListener('click', function(){ move(idx); }); })(i);
    boardEl.appendChild(c);
  }
}
function move(idx){
  if(over||board[idx]!=='') return;
  initAudio(); playTick();
  board[idx]=current;
  draw();
  if(boardEl.children[idx]) boardEl.children[idx].style.transform='scale(1.15)';
  setTimeout(function(){ if(boardEl.children[idx]) boardEl.children[idx].style.transform='scale(1)'; },120);
  if(check()) return;
  if(vsFriend){
    current=current==='X'?'O':'X';
    statEl.textContent='Turn '+current+' ('+(current==='X'?'${p1}':'${p2}')+')';
  } else {
    statEl.textContent='Bot is thinking...';
    setTimeout(botMove, 400);
  }
}
function botMove(){
  if(over) return;
  var m;
  if(mode==='easy') m=rndMove();
  else if(mode==='medium'){ m=findWin('O'); if(m===undefined) m=findWin('X'); if(m===undefined) m=strat(); }
  else { m=findWin('O'); if(m===undefined) m=findWin('X'); if(m===undefined) m=strat(); if(m===undefined) m=rndMove(); }
  if(m!==undefined){ board[m]='O'; playTick(); draw(); }
  if(check()) return;
  statEl.textContent='Your turn';
}
function rndMove(){ var e=[]; for(var i=0;i<board.length;i++) if(board[i]==='') e.push(i); return e.length?e[Math.floor(Math.random()*e.length)]:undefined; }
function findWin(s){ for(var i=0;i<board.length;i++){ if(board[i]!=='') continue; board[i]=s; var w=getWin(); board[i]=''; if(w===s) return i; } }
function strat(){ var cen=Math.floor(board.length/2); if(board[cen]==='') return cen; var cor=[0,size-1,size*(size-1),size*size-1].filter(function(i){return board[i]===''}); if(cor.length) return cor[Math.floor(Math.random()*cor.length)]; return rndMove(); }
function getLines(){ var L=[]; for(var r=0;r<size;r++){ var a=[]; for(var c=0;c<size;c++) a.push(r*size+c); L.push(a); } for(var c=0;c<size;c++){ var a=[]; for(var r=0;r<size;r++) a.push(r*size+c); L.push(a); } var d1=[],d2=[]; for(var i=0;i<size;i++){ d1.push(i*size+i); d2.push(i*size+(size-1-i)); } L.push(d1,d2); return L; }
function getWin(){ var Ls=getLines(); for(var k=0;k<Ls.length;k++){ var line=Ls[k], f=board[line[0]]; if(f==='') continue; var ok=true; for(var j=0;j<line.length;j++) if(board[line[j]]!==f) ok=false; if(ok) return f; } if(board.every(function(v){return v!==''})) return 'DRAW'; return null; }
function check(){
  var r=getWin(); if(!r) return false; over=true;
  if(r==='X'){ scores.a++; statEl.textContent=vsFriend?'${p1} WINS! 🎉':'YOU WIN! 🎉'; statEl.className='status win'; playWin(); hi('X'); }
  else if(r==='O'){ scores.b++; statEl.textContent=vsFriend?'${p2} WINS! 🎉':'BOT WINS!'; statEl.className='status lose'; playLose(); hi('O'); }
  else { scores.d++; statEl.textContent='DRAW!'; statEl.className='status'; }
  s1.textContent=scores.a; s2.textContent=scores.b; sD.textContent=scores.d;
  setTimeout(newGame, 2000); return true;
}
function hi(s){ var Ls=getLines(); for(var k=0;k<Ls.length;k++){ var line=Ls[k]; if(line.every(function(i){return board[i]===s})){ for(var j=0;j<line.length;j++){ var cell=boardEl.children[line[j]]; if(cell) cell.classList.add('w'); } break; } } }

document.getElementById('startBtn').addEventListener('click', function(){
  initAudio(); startBg();
  menuDiv.style.display='none'; gameDiv.style.display='block';
  newGame();
});
document.getElementById('backBtn').addEventListener('click', function(){
  gameDiv.style.display='none'; menuDiv.style.display='grid'; stopBg();
});
</script></body></html>
`.trim();

export default {
  name: 'tic',
  aliases: ['tictactoe', 'ttt'],
  category: 'games',
  description: 'Tic Tac Toe — solo vs the bot, or duo vs a mentioned friend. Usage: .tic @friend',
  cooldown: 3000,
  execute: async ({ m, sock }) => {
    const mention = m.mentionedJid?.[0];
    const isDuo = !!mention;
    const p1 = (await getDisplayName(sock, m.sender).catch(() => 'P1')) || 'P1';
    const p2 = isDuo ? ((await getDisplayName(sock, mention).catch(() => 'Friend')) || 'Friend') : 'P2';

    const html = buildHTML(isDuo, p1.replace(/"/g, ''), p2.replace(/"/g, ''));
    const rid = `nexora-tic-${Date.now()}`;
    const responseId = crypto.randomUUID();
    const certificateChain = loadCertificateChain();
    const payload = {
      response_id: rid,
      sections: [{
        view_model: {
          primitive: {
            __typename: 'GenAIaeacdsnwHtmlPrimitive',
            payload: html,
            url: 'https://nexora.dev',
            trusted_sources: ['nexora.dev'],
          },
          __typename: 'GenAISingleLayoutViewModel',
        },
      }],
    };

    try {
      await sock.relayMessage(m.from, {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          messageSecret: crypto.randomBytes(32),
          botMetadata: {
            messageDisclaimerText: `TicTacToe by NEXORA MD${isDuo ? ' DUO' : ''}`,
            botResponseId: responseId,
            ...(certificateChain.length
              ? {
                  verificationMetadata: {
                    proofs: [{
                      version: 1,
                      useCase: 1,
                      signature: VERIFICATION_SIGNATURE,
                      certificateChain,
                    }],
                  },
                }
              : {}),
          },
        },
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              submessages: [{ messageType: 2, messageText: isDuo ? `TIC TAC TOE DUO - ${p1} VS ${p2}` : 'TIC TAC TOE - BY NEXORA MD' }],
              unifiedResponse: { data: Buffer.from(JSON.stringify(payload)).toString('base64') },
              contextInfo: {
                mentionedJid: isDuo ? [m.sender, mention] : [],
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
                forwardOrigin: 4,
              },
            },
          },
        },
      }, {});
    } catch (err) {
      console.warn('[tic] game relay failed, plain fallback:', err?.message);
      await m.reply(
        isDuo
          ? `🎮 *TIC DUO READY*\n\n@${m.sender.split('@')[0]} 🆚 @${mention.split('@')[0]}\n\nThe game board could not be shown on this chat. Try again in a bit.`
          : '🎮 *TIC TAC TOE*\n\nThe game board could not be shown on this chat. Try again in a bit.'
      );
      return;
    }

    if (isDuo) {
      await sock.sendMessage(m.from, {
        text: `🎮 *TIC DUO READY*\n\n@${m.sender.split('@')[0]} 🆚 @${mention.split('@')[0]}\n\nNow both of you can play in the same game above, each on their own turn\nThe game has music ♫ and a win sound\n\nby NEXORA MD`,
        mentions: [m.sender, mention],
      }, { quoted: m });
    }
  },
};
