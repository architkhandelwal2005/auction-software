/* Stream overlay (templates/overlay.html). A lower third with the player on
   the block, the bid, the leading team and the bid timer; SOLD or UNSOLD for
   a few seconds after each result; the event's progress between players.

   ?bg=green | blue | magenta | black | a hex colour   solid background to key out
   ?purses=1                                           team purses down the right
   ?bug=0                                              no event name, top left */
(function () {
  const q = new URLSearchParams(location.search);
  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  const lower = $('lower');

  const CHROMA = { green: '#00b140', blue: '#0047bb', magenta: '#ff00ff', black: '#000000' };
  const bg = (q.get('bg') || '').toLowerCase().replace('#', '');
  const chroma = CHROMA[bg] || (/^[0-9a-f]{6}$/.test(bg) ? '#' + bg : '');
  if (chroma) {
    document.body.style.setProperty('--chroma', chroma);
    document.body.classList.add('solid-bg');
  }
  if (q.get('bug') === '0') $('bug').hidden = true;
  const showPurses = q.get('purses') === '1';

  // The graphic is drawn at 1920×1080 and scaled to the browser source.
  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    canvas.style.transform = 'translate(' + (innerWidth - 1920 * s) / 2 + 'px,' +
      (innerHeight - 1080 * s) / 2 + 'px) scale(' + s + ')';
  }
  addEventListener('resize', fit);
  fit();

  const GOLD = '#f5b72e';
  const RESULT_MS = 7000;   // how long SOLD / UNSOLD stays up
  const RING = 2 * Math.PI * 52;

  const money = v => window.fmtL(v);
  const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  function photo(img, letters, src, name) {
    if (src) {
      if (img.getAttribute('src') !== src) img.src = src;
      img.hidden = false;
      letters.textContent = '';
    } else {
      img.hidden = true;
      letters.textContent = initials(name);
    }
  }
  function logo(img, src) {
    if (src) { if (img.getAttribute('src') !== src) img.src = src; img.hidden = false; }
    else img.hidden = true;
  }
  function deep(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#5a3b00';
    const n = parseInt(m[1], 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * 0.55));
    return 'rgb(' + c.join(',') + ')';
  }
  function accent(color) {
    const c = /^#[0-9a-f]{6}$/i.test(color || '') ? color : GOLD;
    canvas.style.setProperty('--accent', c);
    canvas.style.setProperty('--accent-deep', deep(c));
  }
  // The sheet's own "Player Name" column when the row's name is a code.
  function displayName(st) {
    const attrs = st.attributes || {};
    for (const k in attrs) {
      if (/^(player\s*)?(full\s*)?name$/i.test(k.trim()) && String(attrs[k]).trim()) return String(attrs[k]).trim();
    }
    return st.current_player || '';
  }

  let state = {};
  let result = null;          // {status, until, ...} after a sale or a pass
  let resultKey = null;
  let lastBid = null;

  function render(d) {
    state = d.auction_state || {};
    const st = state;
    const cfg = d.config || {};
    const stats = d.stats || {};

    $('bugName').textContent = cfg.event_name || 'Live Auction';
    logo($('bugLogo'), cfg.org_logo || '');

    // A sale or a pass shows once, when it happens, not on opening the page.
    const status = st.auction_status || '';
    const key = status + '|' + (st.last_sold_player || st.last_passed_player || '') + '|' + (st.last_sold_price || '');
    if (key !== resultKey) {
      if (resultKey !== null && (status === 'sold' || status === 'passed')) {
        result = { status: status, until: Date.now() + RESULT_MS };
      }
      resultKey = key;
    }
    const showing = result && Date.now() < result.until && !st.current_player;
    const mode = showing ? result.status : (st.current_player ? 'bidding' : 'idle');
    lower.dataset.mode = mode;

    if (mode === 'bidding') {
      const name = displayName(st);
      $('cat').textContent = st.category || '';
      $('name').textContent = name;
      photo($('photoImg'), $('photoInitials'), st.photo_url || '', name);
      let chosen = [];
      try { chosen = JSON.parse(cfg.display_fields || '[]'); } catch (e) { /* none chosen */ }
      $('details').innerHTML = '';
      window.playerDetails(st.attributes || {}, chosen, 4, st.category).forEach(x => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        const label = document.createElement('i');
        label.textContent = x.label;
        chip.append(label, x.value);
        $('details').append(chip);
      });
      const bid = parseFloat(st.current_bid) || 0;
      $('bidAmount').textContent = money(bid);
      if (lastBid !== null && bid !== lastBid) {
        $('bidAmount').classList.remove('bump');
        void $('bidAmount').offsetWidth;
        $('bidAmount').classList.add('bump');
      }
      lastBid = bid;
      $('bidBase').textContent = 'Base ' + money(st.base_price);
      const leading = st.bidder_team_name || '';
      $('leader').classList.toggle('none', !leading);
      $('leaderName').textContent = leading || 'No bid yet';
      logo($('leaderLogo'), leading ? st.bidder_team_logo : '');
      accent(leading ? st.bidder_team_color : GOLD);
    } else {
      lastBid = null;
    }

    if (mode === 'sold' || mode === 'passed') {
      const sold = mode === 'sold';
      const name = sold ? st.last_sold_player : st.last_passed_player;
      $('resultBadge').textContent = sold ? 'SOLD' : 'UNSOLD';
      $('resultName').textContent = name || '';
      photo($('resultImg'), $('resultInitials'), (sold ? st.last_sold_photo : st.last_passed_photo) || '', name);
      $('resultTo').innerHTML = '';
      if (sold) {
        const team = document.createElement('b');
        team.textContent = st.last_sold_team_name || '';
        $('resultTo').append('to ', team);
      } else {
        $('resultTo').textContent = 'No bid. May come back later.';
      }
      $('resultPrice').textContent = sold ? money(st.last_sold_price) : '';
      logo($('resultLogo'), sold ? st.last_sold_team_logo : '');
      accent(sold ? st.last_sold_team_color : '#64748b');
    }

    if (mode === 'idle') {
      accent(GOLD);
      const done = stats.total && stats.sold >= stats.total;
      $('idleText').textContent = done ? 'That is the whole player pool' : 'The next player is coming up';
      const top = (stats.top_buys || [])[0];
      const tiles = [
        ['PLAYERS SOLD', (stats.sold || 0) + ' / ' + (stats.total || 0), ''],
        ['TOTAL SPENT', money(stats.spent || 0), ''],
      ];
      if (top) tiles.push(['TOP BUY', money(top.sold_price), top.name + ' · ' + top.team_name]);
      $('idleStats').innerHTML = '';
      tiles.forEach(([label, value, note]) => {
        const tile = document.createElement('div');
        tile.className = 'stat';
        const i = document.createElement('i'); i.textContent = label;
        const b = document.createElement('b'); b.textContent = value;
        tile.append(i, b);
        if (note) { const s = document.createElement('small'); s.textContent = note; tile.append(s); }
        $('idleStats').append(tile);
      });
    }

    if (showPurses) {
      $('purses').hidden = false;
      const rows = $('purseRows');
      rows.innerHTML = '';
      (d.teams || []).slice().sort((a, b) => b.remaining_budget - a.remaining_budget).forEach(t => {
        const row = document.createElement('div');
        row.className = 'purse-row' + (st.current_player && String(t.id) === String(st.bidder_team_id) ? ' leading' : '');
        let mark;
        if (t.logo_url) { mark = document.createElement('img'); mark.className = 'purse-logo'; mark.src = t.logo_url; }
        else { mark = document.createElement('span'); mark.className = 'purse-dot'; mark.style.background = t.color || '#3b82f6'; }
        const name = document.createElement('span'); name.className = 'purse-name'; name.textContent = t.name;
        const left = document.createElement('b'); left.className = 'purse-left'; left.textContent = money(t.remaining_budget);
        const squad = document.createElement('span'); squad.className = 'purse-squad'; squad.textContent = (t.player_count || 0) + ' pl';
        row.append(mark, name, left, squad);
        rows.append(row);
      });
    }
  }

  // The timer moves between polls, ten times a second. A timer rather than
  // animation frames, which a streaming PC may throttle for an unseen source.
  function frame() {
    const left = lower.dataset.mode === 'bidding' ? window.LiveFeed.timerLeft(state) : null;
    const total = Number(state.timer_seconds) || 0;
    const on = left !== null && total > 0;
    $('clock').hidden = !on;
    $('timerBar').classList.toggle('on', on);
    if (on) {
      const share = Math.max(0, Math.min(1, left / total));
      const urgent = left <= 5;
      $('clockRing').style.strokeDashoffset = String(RING * (1 - share));
      $('clockSecs').textContent = String(Math.ceil(left));
      $('clockLabel').textContent = left > 0 ? 'SECONDS' : 'TIME UP';
      $('clock').classList.toggle('urgent', urgent);
      $('timerBar').classList.toggle('urgent', urgent);
      $('timerBar').firstElementChild.style.transform = 'scaleX(' + share + ')';
    }
  }
  setInterval(frame, 100);

  async function refresh() {
    try { render(await window.LiveFeed.get()); } catch (e) { /* keep the last picture; retry */ }
  }
  async function poll() {
    await refresh();
    setTimeout(poll, 1000);
  }
  poll();
  window.addEventListener('livefeed', refresh);   // a change the server pushed
})();
