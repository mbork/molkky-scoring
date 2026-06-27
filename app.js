/* ── state ───────────────────────────────────────────────────── */

const STORAGE_KEY = 'molkky_state';

function emptyState() {
  return { phase: 'setup', players: [], currentIndex: 0, playedThisRound: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      normalizePlayers(parsed.players);
      return parsed;
    }
  } catch (_) {}
  return emptyState();
}

// Backfill fields added after an older save was written.
function normalizePlayers(players) {
  if (!Array.isArray(players)) {
    return;
  }
  players.forEach(p => {
    if (p.position === undefined) {
      p.position = null;
    }
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ── DOM refs ────────────────────────────────────────────────── */

const setupSection      = document.getElementById('setup');
const gameSection       = document.getElementById('game');
const winnerBanner      = document.getElementById('winner-banner');
const standings         = document.getElementById('standings');

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
  state.players.push({ name, score: 0, misses: 0, eliminated: false, position: null });
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
  return state.players.filter(p => !p.eliminated && p.position === null);
}

// The next finishing position: 1 for the first player to reach 50, 2 for the
// next, and so on.
function nextPosition() {
  const finished = state.players.filter(p => p.position !== null);
  return finished.length + 1;
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

    const isFinished = p.position !== null;
    const isNext = !p.eliminated && !isFinished && i === state.currentIndex;
    const hasPlayed = state.playedThisRound.includes(i);

    if (p.eliminated)    card.classList.add('eliminated');
    else if (isFinished) card.classList.add('finished');
    else if (isNext)     card.classList.add('current');
    else if (hasPlayed)  card.classList.add('played');

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
    } else if (isFinished) {
      const tag = document.createElement('span');
      tag.className = 'pos-tag';
      tag.textContent = '#' + p.position;
      card.appendChild(tag);
    } else if (p.misses > 0) {
      // one or two misses in a row (three eliminates, handled above): a yellow
      // "0" or red "00" warning that the player is one bad throw from out
      const tag = document.createElement('span');
      tag.className = 'miss-tag miss-' + p.misses;
      tag.textContent = '0'.repeat(p.misses);
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
  while (state.players[next].eliminated || state.players[next].position !== null) {
    next = (next + 1) % n;
    if (++loops > n) break; // everyone finished or out (shouldn't happen)
  }
  state.currentIndex = next;
}

function submitScore() {
  const raw = scoreInput.value;
  if (raw === '' || isNaN(Number(raw))) return;
  const pts = Math.max(0, Math.floor(Number(raw)));

  const p = state.players[state.currentIndex];
  if (!p || p.eliminated || p.position !== null) return;

  /* apply score */
  if (pts === 0) {
    p.misses += 1;
  } else {
    p.misses = 0;
    p.score += pts;
    if (p.score > 50) p.score = 25;
  }

  /* reaching exactly 50 finishes the game for this player, who takes the next
     position; everyone else keeps playing */
  if (p.score === 50) p.position = nextPosition();

  /* three misses in a row eliminates */
  if (p.misses >= 3) p.eliminated = true;

  /* mark as played this round */
  state.playedThisRound.push(state.currentIndex);

  /* game over once nobody is still active */
  if (activePlayers().length === 0) {
    showResults();
    return;
  }

  /* start a new round once every still-active player has played */
  const roundDone = activePlayers().every(q =>
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

// Keep the roster, drop only the play: scores, misses, elimination and
// finishing positions all go back to their starting values.
function resetGame() {
  state.phase = 'setup';
  state.currentIndex = 0;
  state.playedThisRound = [];
  state.players.forEach(p => {
    p.score = 0;
    p.misses = 0;
    p.eliminated = false;
    p.position = null;
  });
  saveState();
  showSetup();
}

resetBtn.addEventListener('click', resetGame);
newGameBtn.addEventListener('click', resetGame);

/* ── results ─────────────────────────────────────────────────── */

function showResults() {
  state.phase = 'over';
  saveState();
  gameSection.hidden  = true;
  winnerBanner.hidden = false;
  renderStandings();
}

function renderStandings() {
  standings.innerHTML = '';

  const finished = state.players.filter(p => p.position !== null);
  finished.sort((a, b) => a.position - b.position);
  const out = state.players.filter(p => p.eliminated);

  finished.forEach(p => {
    standings.appendChild(standingRow('#' + p.position, p.name));
  });
  out.forEach(p => {
    standings.appendChild(standingRow('-', p.name));
  });
}

function standingRow(rank, name) {
  const li = document.createElement('li');

  const rankEl = document.createElement('span');
  rankEl.className = 'rank';
  rankEl.textContent = rank;

  const nameEl = document.createElement('span');
  nameEl.textContent = name;

  li.appendChild(rankEl);
  li.appendChild(nameEl);
  return li;
}

/* ── init ────────────────────────────────────────────────────── */

if (state.phase === 'setup') {
  showSetup();
} else if (state.phase === 'game') {
  showGame();
} else if (state.phase === 'over') {
  showResults();
}

/* ── service worker ──────────────────────────────────────────── */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
