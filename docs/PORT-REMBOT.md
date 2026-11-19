# Rem Bot port ledger

Source: the two backups of YONO DEV's Rem Bot (169 plugins) dropped on 18-19 Nov 2026.
Rules for this port, from Skyler: never ship Indonesian or Arabic strings — translate first;
only rewrite an existing command when ours is broken or demonstrably weaker; where a command
is not worth taking whole, take its technique or its richness.

Counts: 110 plugins with no equivalent here, 48 that overlap something we already ship.

## Already ported

| item | what it was | where it landed |
|---|---|---|
| `pool` | 8 Ball Pool, wide arena (Arabic UI) | `assets/htmlgames/pool.html`, `.game pool` |
| `piano` | Piano Composer, builds a track as you play | `assets/htmlgames/piano.html`, `.game piano` |
| `doom` | Doom Strike, top-down wave shooter | `assets/htmlgames/doom.html`, `.game doom` |
| `gd` | Geometry Dash wide view | `assets/htmlgames/dashwide.html`, `.game dashwide` |
| `owner-dfp` | delete a plugin file | `src/plugins/owner/dfp.js` |
| `group-totag` | forward a message, mention everyone | `src/plugins/group/totag.js` |
| `cmd-lock` | lock a sticker command binding | `src/plugins/utility/lockcmd.js` |
| `cmd-del` | delete a sticker command binding | `src/plugins/utility/delcmd.js` |

All four games had their visible strings translated (pool's were Arabic, piano's Indonesian) and
the YONO branding replaced with NEXORA. Every payload is pinned in `SOURCES.json` with a local
hash and no remote fetch.

## New plugins (110)

| plugin | category | commands | size | verdict |
|---|---|---|---|---|
| `doom` | ? | doom,megumin,doomstrike | 35.2 KB | PORTED |
| `piano` | ? | piano,pianogame,composer | 15.3 KB | PORTED |
| `cmd-del` | database | delcmd | 0.4 KB | PORTED |
| `cmd-lock` | database | un)?lockcmd | 0.5 KB | PORTED |
| `group-totag` | group | totag,tag | 0.4 KB | PORTED |
| `owner-dfp` | owner | dfp | 0.7 KB | PORTED |
| `phsearch` | +18 | phsearch,pornhubsearch | 2.0 KB | SKIP — adult |
| `pornhubdl` | +18 | ph,pornhub,pornhubsearch,phsearch,phub,porn,pornsear | 1.7 KB | SKIP — adult |
| `phimage` | adult | phimage,pornhubimage,phimg | 5.1 KB | SKIP — adult |
| `pornhub` | adult | phsearch,pornhubsearch,ph,pornhub | 9.1 KB | SKIP — adult |
| `faketag` | owner | faketag,ftag | 3.6 KB | SKIP — dangerous |
| `owner-exec` | owner | ?: | 3.7 KB | SKIP — dangerous |
| `owner-simulate` | owner | simulate,simulasi | 1.0 KB | SKIP — dangerous |
| `ptvchan` | owner | ptvchan,ptvch,ptvchanel | 1.9 KB | SKIP — dangerous |
| `tesbtn` | owner | tesbtn,testbtn,btnnoxm,tesbtnflow | 6.3 KB | SKIP — dangerous |
| `tesbug` | owner | tesbug,bugtes | 3.2 KB | SKIP — dangerous |
| `nixel` | test | nixel,testnixel | 1.1 KB | SKIP — dangerous |
| `allSCommands` | tools | ...allSCommands,ุฎุฑุง,ุงุถูุณ | 12.4 KB | SKIP — dangerous |
| `@` | group | @ | 0.5 KB | SKIP — duplicate/trivial |
| `info-totalfitur` | info | totalfitur | 0.3 KB | SKIP — duplicate/trivial |
| `o` | main | o,boos | 4.7 KB | SKIP — duplicate/trivial |
| `ping2` | main | ping2 | 2.2 KB | SKIP — duplicate/trivial |
| `gp` | owner | getplugin,gp | 7.2 KB | SKIP — duplicate/trivial |
| `gpairich` | owner | gpairich | 0.9 KB | SKIP — duplicate/trivial |
| `ocrm` | owner | ocrm,ocrm2,oinsp,oadn,orelay,olastchat | 5.1 KB | SKIP — duplicate/trivial |
| `owner-gp` | owner | getplugin,gp | 0.8 KB | SKIP — duplicate/trivial |
| `╪¿┘ê╪▒┘å` | +18 | ph | 1.5 KB | TODO |
| `chess` | ? | chess,chess3d,neonchess,catur | 27.7 KB | TODO |
| `yono2` | ? | yono2 | 1.1 KB | TODO |
| `╪│` | N O U R | س,س1,س\.1,مسح | 7.3 KB | TODO |
| `ai-deepseek` | ai | deepseek,depseek,deepsek,dipsek | 1.5 KB | TODO |
| `gemini` | ai | gemini | 6.6 KB | TODO |
| `xnxxsearch` | buscador | xnxxsearch,xnxxs | 2.8 KB | TODO |
| `fakecall` | canvas | fakecall,fakecall-android,fakecall-ios,fakecallwa | 3.0 KB | TODO |
| `cmd-list` | database | listcmd | 0.5 KB | TODO |
| `douyinsearch` | download | douyinsearch,douyin,searchdouyin | 4.1 KB | TODO |
| `down-dafont` | downloader | dafont | 2.6 KB | TODO |
| `down-mediafire` | downloader | mediafire,mf | 2.3 KB | TODO |
| `down-sfile` | downloader | sfile | 4.3 KB | TODO |
| `play2` | downloader | play2,ytm,ytmusic | 29.9 KB | TODO |
| `play3` | downloader | ytmp6,ytmp32,yta2,play3,ytmp5,ytmp42,ytv2 | 19.5 KB | TODO |
| `fakethink` | fun | think,mikir,fakethink | 1.5 KB | TODO |
| `fun-angka` | fun | angka | 0.9 KB | TODO |
| `fun-cekkhodam` | fun | cek(khodam,kodam),kodam,khodam | 5.8 KB | TODO |
| `fun-ceksifat` | fun | ceksifat | 1.1 KB | TODO |
| `fun-gantengcek` | fun | cekganteng,gantengcek | 1.5 KB | TODO |
| `game-akinator` | game | akinator,aki | 3.7 KB | TODO |
| `rpg-hunt` | game | hunter | 3.7 KB | TODO |
| `tic` | game | tic,tictactoe,ttt | 12.0 KB | TODO |
| `pptag` | group | pptag,ppprivate,privatepp | 3.6 KB | TODO |
| `┘é╪¿┘ê┘ä` | group | قبول,acceptall,terima | 2.3 KB | TODO |
| `info-listprem` | info | listprem(ium,iums)? | 1.2 KB | TODO |
| `info-totaluser` | info | pengguna,(jumlah)?database,totaluser | 0.5 KB | TODO |
| `test` | info | test,tes | 1.8 KB | TODO |
| `totalfitur` | info | totalfitur | 2.6 KB | TODO |
| `internet-shinigami` | internet | shinigami | 4.9 KB | TODO |
| `allmenu` | main | allmenu | 5.1 KB | TODO |
| `main-donate` | main | donate,donasi,traktir | 2.9 KB | TODO |
| `main-enable` | main | (en,dis)able,(true,false),(turn)?(on,off),[01] | 2.1 KB | TODO |
| `╪º┘ê╪º┘à╪▒` | main | اوامر,المهام | 2.0 KB | TODO |
| `╪¼┘à┘è╪╣_╪º┘ä╪º┘ê╪º┘à╪▒` | main | جميع_الاوامر | 1.5 KB | TODO |
| `tgprofile` | maker | tgprofile,teleprofile,tgp,mysetting | 7.8 KB | TODO |
| `notify` | owner | notify | 1.2 KB | TODO |
| `owner-banchat` | owner | banchat,bnc | 0.3 KB | TODO |
| `owner-banuser` | owner | ban(user)? | 0.4 KB | TODO |
| `owner-delprem` | owner | delprem(user)? | 0.7 KB | TODO |
| `owner-restart` | owner | res(tart)? | 0.4 KB | TODO |
| `owner-unbanchat` | owner | unbanchat,ubnc | 0.3 KB | TODO |
| `owner-unbanuser` | owner | unban(user)? | 0.4 KB | TODO |
| `runcrm` | owner | runcrm | 2.9 KB | TODO |
| `test2` | owner | test2,allbutton,semuatombol | 7.6 KB | TODO |
| `╪»┘ä╪╣` | owner | دلع | 3.9 KB | TODO |
| `dino` | permainan | dino,dinosaurus,pelaridino,dinorun | 11.5 KB | TODO |
| `rpg-adventure` | rpg | petualang,adventure | 3.3 KB | TODO |
| `rpg-bansos` | rpg | korupsi | 1.6 KB | TODO |
| `rpg-berburu` | rpg | berburu | 2.0 KB | TODO |
| `rpg-berdagang` | rpg | berdagang | 1.8 KB | TODO |
| `rpg-berkebon` | rpg | berkebun | 2.1 KB | TODO |
| `rpg-buah` | rpg | (list)?(buah,fruits?) | 0.5 KB | TODO |
| `rpg-cooldown` | rpg | cd,cooldown | 0.9 KB | TODO |
| `rpg-craft` | rpg | craft | 3.0 KB | TODO |
| `rpg-kandang` | rpg | kandang | 1.1 KB | TODO |
| `rpg-mancing` | rpg | fishing,mancing | 2.2 KB | TODO |
| `rpg-mentransfer` | rpg | transfer,tf | 9.2 KB | TODO |
| `rpg-mining` | rpg | mining | 1.7 KB | TODO |
| `rpg-mulung` | rpg | mulung | 1.2 KB | TODO |
| `rpg-nebang` | rpg | nebang,menebang | 2.1 KB | TODO |
| `rpg-nguli` | rpg | nguli | 0.4 KB | TODO |
| `asiabox` | search | asiabox,drakor,drama,abox | 9.2 KB | TODO |
| `cekjarak` | search | cekjarak,jarak,rute,maps | 14.7 KB | TODO |
| `githubsearch` | search | githubsearch,gbsearch | 1.3 KB | TODO |
| `google` | search | google,gnews | 3.8 KB | TODO |
| `yts` | search | yts,ytsearch,youtubesearch | 7.7 KB | TODO |
| `iqc` | sticker | iqc,qc2 | 13.6 KB | TODO |
| `rsticker` | sticker | reactsticker,rsticker,reactimg,rimg | 2.7 KB | TODO |
| `sticker-brat` | sticker | brat | 0.4 KB | TODO |
| `sticker-stickers` | sticker | s(tic?ker)?(gif)? | 0.7 KB | TODO |
| `ad` | tools | pengumuman,ad,umumkan | 2.5 KB | TODO |
| `aicheck` | tools | aicheck,cekai,aidetect | 4.4 KB | TODO |
| `iklan` | tools | iklan,ad,siaran | 3.0 KB | TODO |
| `sig` | tools | sig,cekig,lookupig | 4.6 KB | TODO |
| `tolink` | tools | tolink,catbox | 6.0 KB | TODO |
| `tools-cekresi` | tools | cekresi | 3.8 KB | TODO |
| `tools-qrcode` | tools | qr(code)? | 0.4 KB | TODO |
| `tools-readviewonce` | tools | rvo,read | 0.6 KB | TODO |
| `tools-sendquoted` | tools | quoted,q | 0.3 KB | TODO |
| `umur` | tools | umur,age | 4.7 KB | TODO |
| `xp-ceksn` | xp | ceksn | 0.3 KB | TODO |
| `xp-register` | xp | daftar,verify,reg(ister)? | 1.4 KB | TODO |
| `xp-unregister` | xp | unreg(ister)? | 0.5 KB | TODO |

## Overlaps (48) — rewrite only where theirs is stronger

| plugin | category | commands | size | verdict |
|---|---|---|---|---|
| `gd` | ? | gd,geometry,dash,gdash | 18.8 KB | PORTED |
| `pool` | ? | pool,billiard,biliar,8ball,wide | 17.5 KB | PORTED |
| `main-creator` | main | owner,creator | 0.3 KB | SKIP — duplicate/trivial |
| `sk` | owner | backup,sk,sc,getsc | 1.7 KB | SKIP — duplicate/trivial |
| `crm` | ? | crm,crm2,insp,adn,relay,lastchat | 35.2 KB | TODO |
| `cmd-set` | database | setcmd | 0.7 KB | TODO |
| `aio` | downloader | aio,alldl,ig,igdl,instagram,tiktok,tt,ttdl,fb,fbdl,f | 14.0 KB | TODO |
| `down-instagram` | downloader | igdl,instagdramdl | 1.6 KB | TODO |
| `down-tiktok` | downloader | ttdl,tiktok,tt,tiktokdl | 3.0 KB | TODO |
| `down-ytmp3` | downloader | yta,ytmp3,ytaudio | 2.1 KB | TODO |
| `down-ytmp4` | downloader | ytv,ytmp4,ytvideo | 0.9 KB | TODO |
| `play` | downloader | play,ytmp3,ytaudio,ytmp4,ytvideo,yt | 9.3 KB | TODO |
| `fun-dare` | fun | dare | 0.3 KB | TODO |
| `fun-truth` | fun | truth | 0.3 KB | TODO |
| `slot` | game | slot,slot777 | 7.9 KB | TODO |
| `menu` | general | menu,help,\? | 2.7 KB | TODO |
| `group-hidetag` | group | hidetag | 0.3 KB | TODO |
| `group-link-revoke` | group | linkgc,revoke | 0.5 KB | TODO |
| `group-manage` | group | add,kick,promote,demote,mute,unmute,opengc,closegc | 2.7 KB | TODO |
| `group-setcostum` | group | setwelcome,setbye,setpromote,setdemote | 0.9 KB | TODO |
| `welcome` | group | one,welcome,testwelcome | 2.8 KB | TODO |
| `╪¬╪▒╪¡┘è╪¿` | group | welcome,one,testwelcome | 3.5 KB | TODO |
| `info-dashboard` | info | dashboard,dash | 1.8 KB | TODO |
| `server` | info | server,m,status,stats,stat,infobot | 2.3 KB | TODO |
| `internet-fetch` | internet | fetch,get | 2.0 KB | TODO |
| `main-afk` | main | afk | 0.3 KB | TODO |
| `main-menu` | main | menu,help,\? | 8.8 KB | TODO |
| `ping` | main | ping,speed | 36.4 KB | TODO |
| `owner-crm` | owner | crm,crm2 | 8.2 KB | TODO |
| `owner-premium` | owner | add,tambah,\+,del,hapus,-)p(rem)? | 2.3 KB | TODO |
| `owner-sfp` | owner | sfp | 0.8 KB | TODO |
| `rpg-bet` | rpg | judi,bet | 2.3 KB | TODO |
| `rpg-casino` | rpg | casino,csn | 2.1 KB | TODO |
| `rpg-cook` | rpg | masak,cook | 2.0 KB | TODO |
| `rpg-eat` | rpg | eat,makan | 5.5 KB | TODO |
| `rpg-leaderboard` | rpg | leaderboard,lb | 2.9 KB | TODO |
| `rpg-open` | rpg | open,buka,gacha | 4.0 KB | TODO |
| `rpg-reward` | rpg | harian,claim,mingguan,weekly,monthly,bulanan | 1.7 KB | TODO |
| `pinterest` | search | pinterest,pin,pindl,unduh,download | 9.3 KB | TODO |
| `stickerpack` | sticker | stickerpack,sp,stickersearch | 2.7 KB | TODO |
| `order` | store | order,pay,tagih,invoice,payment | 2.2 KB | TODO |
| `sc` | store | sc,script,buy | 3.6 KB | TODO |
| `airich` | tools | rich,airich | 19.7 KB | TODO |
| `rich` | tools | rich,airich | 7.1 KB | TODO |
| `tools-delete` | tools | del,delete,hapus? | 0.7 KB | TODO |
| `tools-hd` | tools | upscale,hd,hdr | 1.5 KB | TODO |
| `tools-ssweb` | tools | ssweb | 2.4 KB | TODO |
| `xp-levelup` | xp | levelup | 0.8 KB | TODO |

## Techniques worth taking even when the command is not

- **Location-header menu** (`allmenu`): a `buttonsMessage` whose header is a `locationMessage`
  (name + address + thumbnail) instead of an image. Never tried here; the address slot can carry
  "287 commands".
- **Progressive jackpot** (`slot`): the pool grows by every bet and pays a weighted jackpot
  (~4% at 777x). Our 777 is near-neutral; the pool is the part worth borrowing.
- **Fake typing card** (`fakethink`): `extendedTextMessage` with `businessMessageForwardInfo` plus a
  newsletter forward header, so the bubble reads as an AI "Thinking…" state that edits into the answer.
- **Data-URI gallery** (`pinterest`): already shipped as `src/lib/galleryCard.js`.
- **`crm` forensics** (`crm`, `ocrm`): already shipped as `src/lib/crmStore.js`.
- **AI detection** (`aicheck`): scores text as human/AI before replying.

## Still TODO — 84 plugins

The table above is the worklist. Each entry needs: API adaptation (`handler(m, {conn})` →
`execute({ sock, m, args, prefix })`, `global.db` → our `db`), string translation, and a release
check if it touches money, moderation or files.
