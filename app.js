/* ── state ───────────────────────────────────────────────────── */

const STORAGE_KEY = 'molkky_state';

function emptyState() {
  return { phase: 'setup', players: [], currentIndex: 0, playedThisRound: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return emptyState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ── DOM refs ────────────────────────────────────────────────── */

const setupSection      = document.getElementById('setup');
const gameSection       = document.getElementById('game');
const winnerBanner      = document.getElementById('winner-banner');
const winnerText        = document.getElementById('winner-text');

const playerList        = document.getElementById('player-list');
const playerNameInput   = document.getElementById('player-name-input');
const addPlayerBtn      = document.getElementById('add-player-btn');
const startBtn          = document.getElementById('start-btn');

const scoreboard        = document.getElementById('scoreboard');
const turnLabel         = document.getElementById('turn-label');
const scoreInput        = document.getElementById('score-input');
const submitScoreBtn    = document.getElementById('submit-score-btn');
const resetBtn          = document.getElementById('reset-btn');
const newGameBtn        = document.getElementById('new-game-btn');

/* ── setup screen ────────────────────────────────────────────── */

function renderSetupList() {
  playerList.innerHTML = '';
  state.players.forEach((p, i) => {
    const li = document.createElement('li');
    li.textContent = p.name;
    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.setAttribute('aria-label', 'Remove ' + p.name);
    rm.addEventListener('click', () => {
      state.players.splice(i, 1);
      saveState();
      renderSetupList();
    });
    li.appendChild(rm);
    playerList.appendChild(li);
  });
  startBtn.disabled = state.players.length < 2;
}

function addPlayer() {
  const name = playerNameInput.value.trim();
  if (!name) return;
  if (state.players.some(p => p.name === name)) {
    playerNameInput.select();
    return;
  }
  state.players.push({ name, score: 0, misses: 0, eliminated: false });
  playerNameInput.value = '';
  saveState();
  renderSetupList();
  playerNameInput.focus();
}

addPlayerBtn.addEventListener('click', addPlayer);
playerNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') addPlayer(); });

startBtn.addEventListener('click', () => {
  state.phase = 'game';
  state.currentIndex = 0;
  state.playedThisRound = [];
  saveState();
  showGame();
});

/* ── game screen ─────────────────────────────────────────────── */

function activePlayers() {
  return state.players.filter(p => !p.eliminated);
}

function showSetup() {
  setupSection.hidden = false;
  gameSection.hidden  = true;
  winnerBanner.hidden = true;
  renderSetupList();
}

function showGame() {
  setupSection.hidden = true;
  gameSection.hidden  = false;
  winnerBanner.hidden = true;
  renderGame();
}

function renderGame() {
  /* scoreboard */
  scoreboard.innerHTML = '';
  state.players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'player-card';

    const active = activePlayers();
    const isNext = !p.eliminated && i === state.currentIndex;
    const hasPlayed = state.playedThisRound.includes(i);

    if (p.eliminated)  card.classList.add('eliminated');
    else if (isNext)   card.classList.add('current');
    else if (hasPlayed) card.classList.add('played');

    const nameEl = document.createElement('span');
    nameEl.className = 'player-name';
    nameEl.textContent = p.name;

    const scoreEl = document.createElement('span');
    scoreEl.className = 'player-score';
    scoreEl.textContent = p.score;

    card.appendChild(nameEl);
    card.appendChild(scoreEl);

    if (p.eliminated) {
      const tag = document.createElement('span');
      tag.className = 'elim-tag';
      tag.textContent = 'out';
      card.appendChild(tag);
    }

    scoreboard.appendChild(card);
  });

  /* turn label */
  const active = activePlayers();
  if (active.length === 0) return; // shouldn't happen
  const cur = state.players[state.currentIndex];
  turnLabel.textContent = cur ? cur.name : '';

  scoreInput.value = '';
  scoreInput.focus();
}

function advanceCurrentIndex() {
  const n = state.players.length;
  let next = (state.currentIndex + 1) % n;
  let loops = 0;
  while (state.players[next].eliminated) {
    next = (next + 1) % n;
    if (++loops > n) break; // all eliminated (shouldn't happen)
  }
  state.currentIndex = next;
}

function submitScore() {
  const raw = scoreInput.value;
  if (raw === '' || isNaN(Number(raw))) return;
  const pts = Math.max(0, Math.floor(Number(raw)));

  const p = state.players[state.currentIndex];
  if (!p || p.eliminated) return;

  /* apply score */
  if (pts === 0) {
    p.misses += 1;
  } else {
    p.misses = 0;
    p.score += pts;
    if (p.score > 50) p.score = 25;
  }

  /* check elimination */
  if (p.misses >= 3) p.eliminated = true;

  /* mark as played this round */
  state.playedThisRound.push(state.currentIndex);

  /* check win */
  if (p.score === 50) {
    saveState();
    showWinner(p.name);
    return;
  }

  /* check if all active players have played → new round */
  const stillActive = state.players.filter(q => !q.eliminated);

  if (stillActive.length === 0) {
    saveState();
    renderGame();
    return;
  }

  const roundDone = stillActive.every(q =>
    state.playedThisRound.includes(state.players.indexOf(q))
  );

  if (roundDone) state.playedThisRound = [];

  advanceCurrentIndex();
  saveState();
  renderGame();
}

submitScoreBtn.addEventListener('click', submitScore);
scoreInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitScore(); });

/* ── reset ───────────────────────────────────────────────────── */

function resetGame() {
  state = emptyState();
  saveState();
  showSetup();
}

resetBtn.addEventListener('click', resetGame);
newGameBtn.addEventListener('click', resetGame);

/* ── winner ──────────────────────────────────────────────────── */

function showWinner(name) {
  gameSection.hidden  = true;
  winnerBanner.hidden = false;
  winnerText.textContent = name + ' wins!';
}

/* ── init ────────────────────────────────────────────────────── */

if (state.phase === 'game') {
  showGame();
} else {
  showSetup();
}

/* ── service worker ──────────────────────────────────────────── */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
