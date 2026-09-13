const socket = io();
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');
const toast = msg => { $('toast').textContent = msg; $('toast').classList.add('show'); clearTimeout(window._toast); window._toast=setTimeout(()=>$('toast').classList.remove('show'),2800); };
let pin=''; let timerInterval=null;
$('createForm').addEventListener('submit', e => { e.preventDefault(); $('setupError').textContent=''; socket.emit('quiz:create',{hostName:$('hostName').value,category:$('category').value}); });
$('startBtn').addEventListener('click',()=>socket.emit('quiz:start',{pin}));
socket.on('quiz:created', data => { pin=data.pin; $('pin').textContent=pin; $('pinBig').textContent=pin; hide('setup'); show('lobby'); });
socket.on('lobby:update', data => { if(data.pin) pin=data.pin; $('playerCount').textContent=data.players.length; $('emptyPlayers').classList.toggle('hidden',data.players.length>0); $('players').innerHTML=data.players.map((p,i)=>`<div class="player-row"><div class="avatar">${escapeHtml(p.name.slice(0,1).toUpperCase())}</div><b>${escapeHtml(p.name)}</b><small>${p.score} pts</small></div>`).join(''); });
socket.on('question:start', q => { hide('lobby'); show('game'); $('questionCounter').textContent=`QUESTION ${String(q.questionIndex).padStart(2,'0')} / ${String(q.totalQuestions).padStart(2,'0')}`; $('questionText').textContent=q.question; $('hostOptions').innerHTML=q.options.map((o,i)=>`<div class="host-option"><span>${String.fromCharCode(65+i)}</span>${escapeHtml(o)}</div>`).join(''); runTimer(q.startedAt,q.timeLimitSeconds); });
socket.on('player:answered', d => $('answeredPill').textContent=`${d.answeredCount}/${d.totalPlayers} ANSWERED`);
socket.on('leaderboard:update', ({leaderboard}) => { $('leaderboard').innerHTML=leaderboard.map(p=>`<div class="rank-row"><span class="rank-num">#${p.rank}</span><b>${escapeHtml(p.name)}</b><strong>${p.score}</strong></div>`).join(''); });
socket.on('question:time_up', d => { clearInterval(timerInterval); $('timer').textContent='0'; $('progressBar').style.width='0%'; toast(`Answer revealed · Correct: ${String.fromCharCode(65+d.correctOption)}`); });
socket.on('quiz:ended', d => { clearInterval(timerInterval); hide('game'); show('end'); $('winnerName').textContent=d.winner?.name||'No winner'; $('winnerScore').textContent=d.winner?`${d.winner.score} points`:'No scores recorded'; $('finalRanks').innerHTML=d.finalRanks.map(p=>`<div class="rank-row"><span class="rank-num">#${p.rank}</span><b>${escapeHtml(p.name)}</b><strong>${p.score}</strong></div>`).join(''); });
socket.on('quiz:error', d => { $('setupError').textContent=d.message; toast(d.message); });
function runTimer(startedAt, seconds){ clearInterval(timerInterval); const total=seconds*1000; const tick=()=>{const left=Math.max(0,total-(Date.now()-startedAt)); $('timer').textContent=Math.ceil(left/1000); $('progressBar').style.width=`${left/total*100}%`; if(left<=0)clearInterval(timerInterval)}; tick(); timerInterval=setInterval(tick,80); }
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
