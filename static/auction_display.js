(() => {
  /*
    PUBLIC AUCTION DISPLAY — presentation layer only.

    The auction is conducted manually. This screen never conducts it: there is
    no bidding, no team selection, no sold/unsold workflow and no auctioneer
    control here. It polls the SAME /api/live_data endpoint the existing /live
    spectator screen already uses, and writes those values into the `data-slot`
    elements defined by the display markup. No backend logic is touched.
  */

  const stage = document.querySelector('#stage');
  const playerZone = document.querySelector('#playerZone');
  const teamRows = document.querySelector('#teamRows');
  const debugPanel = document.querySelector('#debugPanel');
  const sportSelect = document.querySelector('#sportSelect');
  const templateSelect = document.querySelector('#templateSelect');
  const bgSelect = document.querySelector('#bgSelect');

  /* Pickleball templates follow the same architecture as the cricket ones:
     player profile card on the LEFT, price floating over the environment in the
     MIDDLE, team purses on the RIGHT. Each has its own environment and vibe. */
  const PB_TEMPLATES = ['pb-hall', 'pb-sunset', 'pb-press'];
  // Older saved template names map onto the current set
  const PB_ALIAS = {
    'pb-glass': 'pb-hall', 'pb-dash': 'pb-hall', 'pb-grid': 'pb-hall',
    'pb-lots': 'pb-hall', 'pb-focus': 'pb-hall', 'pb-board': 'pb-hall',
    'pb-spotlight': 'pb-hall', 'pb-arena': 'pb-hall', 'pb-daylight': 'pb-sunset',
    'pb-neon': 'pb-hall',
  };
  const TEMPLATES = ['arena', 'collector', 'circular', 'broadcast', 'poster', ...PB_TEMPLATES];
  const SPORTS = ['cricket', 'football', 'badminton', 'pickleball', 'multi'];
  // Available templates per sport for random/sequential modes
  const SPORT_TEMPLATES = {
    cricket: ['arena', 'collector', 'circular', 'broadcast', 'poster'],
    football: ['arena', 'broadcast', 'poster'],
    badminton: ['arena', 'broadcast'],
    pickleball: PB_TEMPLATES,
    multi: ['arena', 'collector', 'broadcast'],
  };

  /* Photographic stage backgrounds. 'none' falls back to the CSS-only
     environment. Each sport declares its default; a sport with no photo
     asset yet simply keeps the CSS environment. */
  const BACKGROUNDS = ['none', 'cricket-pitch', 'cricket-arena', 'cricket-stadium', 'cricket-crowd', 'cricket-nets', 'cricket-ground', 'football-stadium'];
  const SPORT_DEFAULT_BG = {
    cricket: 'cricket-stadium',
    football: 'football-stadium',
    badminton: 'none',
    pickleball: 'none',
    multi: 'none',
  };
  // Some templates read best on a specific backdrop. The Circular Spotlight sits
  // over the floodlit pitch plate the way the reference boards do. Only applied
  // for cricket, and only until the operator picks a background by hand.
  const TEMPLATE_DEFAULT_BG = {
    cricket: { circular: 'cricket-pitch' },
  };
  let bgManual = false;
  // Stage settings driven by admin panel via live_data
  let stageTemplateMode = 'fixed'; // 'fixed' | 'random' | 'sequential'
  let stageFixedTemplate = 'arena';
  let stageSport = 'cricket';
  let prevPlayerName = null;
  let seqIndex = 0; // for sequential mode
  const TEAM_FALLBACK_COLORS = ['#3f82ff', '#f0a11b', '#22be88', '#ee5361', '#9a7cff', '#42efc2'];

  /* ───────────── state ───────────── */
  const state = {
    tournament: { name: 'TOURNAMENT NAME', subtitle: 'PLAYER AUCTION • LIVE DISPLAY', progress: '-- / --' },
    player: null,   // null => nothing on the block yet
    auction: { currentPrice: null, basePrice: null, increment: null, status: 'WAITING FOR PLAYER' },
    teams: [],
    // Real auction pool data — drives the progress bar, upcoming lots and sold ticker
    stats: { total: 0, sold: 0, unsold: 0, passed: 0, spent: 0 },
    soldPlayers: [],
    connected: false,
  };

  /* ───────────── helpers ───────────── */
  const DASH = '--';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Backend amounts are already denominated in Lakhs.
  function money(v) {
    if (v == null || v === '' || isNaN(Number(v))) return '₹ --';
    const n = Math.round(Number(v) * 10) / 10;
    return `₹${n}L`;
  }

  // Cricket-Attax style role archetype. A free-text role like
  // "TOP-ORDER BATSMAN" or "LEFT-ARM FAST BOWLER" is classified into one of
  // four card types, each with its own emblem and accent — this is what the
  // collector card badges. Keeps working for any role string the sheet uses.
  function archetype(role) {
    const r = String(role || '').toLowerCase();
    if (!r) return { key: 'player', label: 'PLAYER', icon: '★', color: '#f5b72e' };
    const bat = /(bat|open|order|finish|power|anchor)/.test(r);
    const bowl = /(bowl|pace|spin|seam|medium|fast)/.test(r);
    const keep = /(keeper|wicket-?keeper|glove)/.test(r);
    if (keep) return { key: 'keeper', label: 'WICKET-KEEPER', icon: '🧤', color: '#46e5d1' };
    if (bat && bowl) return { key: 'allrounder', label: 'ALL-ROUNDER', icon: '✦', color: '#f5b72e' };
    if (bowl) return { key: 'bowler', label: 'BOWLER', icon: '◉', color: '#3c8dff' };
    if (bat) return { key: 'batsman', label: 'BATSMAN', icon: '🏏', color: '#35d391' };
    return { key: 'player', label: 'PLAYER', icon: '★', color: '#f5b72e' };
  }

  // Structural fields the upload pipeline duplicates into `attributes` —
  // never surface these as player detail.
  const RESERVED_ATTRS = ['name', 'photo', 'id', 'category', 'base_price', 'photo_url', 'team_id', 'sold_price', 'status', 'sold_at'];
  function attrFind(attrs, re) {
    if (!attrs) return null;
    for (const [k, v] of Object.entries(attrs)) {
      if (RESERVED_ATTRS.includes(k.toLowerCase())) continue;
      if (v == null || String(v).trim() === '') continue;
      if (re.test(k)) return String(v).trim();
    }
    return null;
  }
  // The real display name may live in an attribute column while the row's
  // own `name` is a lot code (e.g. "CPL-004"). Prefer the human name and
  // demote the code to the ID slot.
  function attrName(attrs) {
    if (!attrs) return null;
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || String(v).trim() === '') continue;
      if (/^(player\s*)?(full\s*)?name$/i.test(k.trim())) return String(v).trim();
    }
    return null;
  }

  function setSlot(name, value) {
    document.querySelectorAll(`[data-slot="${name}"]`).forEach(el => { el.textContent = value; });
  }

  /* ───────────── photo engine ─────────────
     Real submissions arrive in any aspect ratio / framing and are never
     background-removed. A blurred, darkened copy of the same image fills
     the frame behind the real crop so odd shapes read as intentional
     rather than letterboxed. No photo => themed silhouette placeholder. */
  function photoShell(extraClass = '') {
    return `<div class="photo-shell ${extraClass}" data-slot="player.photo"></div>`;
  }

  function paintPhoto() {
    const shells = document.querySelectorAll('.photo-shell');
    const url = state.player && state.player.photo;
    const name = (state.player && state.player.name) || '';
    shells.forEach(shell => {
      if (url) {
        shell.classList.remove('is-fallback');
        shell.innerHTML =
          `<img class="photo-blur" src="${esc(url)}" alt="" aria-hidden="true">` +
          `<img class="photo-main" src="${esc(url)}" alt="${esc(name)}">`;
        const main = shell.querySelector('.photo-main');
        main.addEventListener('error', () => {
          shell.classList.add('is-fallback');
          shell.innerHTML = fallbackMarkup();
        }, { once: true });
      } else {
        shell.classList.add('is-fallback');
        shell.innerHTML = fallbackMarkup();
      }
    });
  }

  function fallbackMarkup() {
    return `<div class="photo-placeholder" aria-hidden="true">
              <div class="placeholder-person"></div>
              <div class="photo-placeholder-label">PLAYER PHOTO</div>
            </div>`;
  }

  /* ───────────── player display templates ─────────────
     Only this region changes between templates. Header, price zone,
     team purse panel and the bottom information strip are shared chrome. */
  function renderTemplate(template) {
    let html = '';

    if (template === 'collector') {
      html = `
        <article class="tpl-collector" data-archetype="player">
          <div class="collector-inner">
            <div class="collector-topbar">
              <div class="collector-cat" data-slot="player.category">CATEGORY</div>
              <div class="collector-type"><i class="ct-icon">★</i><span class="ct-label">PLAYER</span></div>
            </div>
            ${photoShell('collector-photo')}
            <div class="collector-rolerail" data-slot="player.role">ROLE</div>
            <div class="collector-nameplate">
              <div class="collector-firstname"></div>
              <div class="collector-title" data-slot="player.name">PLAYER NAME</div>
            </div>
            <div class="collector-data">
              <div class="stat"><span>AGE</span><strong data-slot="player.age">--</strong></div>
              <div class="stat"><span>STYLE</span><strong data-slot="player.style">--</strong></div>
              <div class="stat"><span>BOWLING</span><strong data-slot="player.secondary">--</strong></div>
              <div class="stat"><span>CITY / CLUB</span><strong data-slot="player.city">--</strong></div>
            </div>
            <div class="collector-price"><span>BASE PRICE</span><strong data-slot="player.base-price">₹ --</strong></div>
          </div>
        </article>`;
    } else if (template === 'circular') {
      html = `
        <article class="tpl-circular">
          <div class="circle-orbit">
            ${photoShell('circle-photo')}
            <div class="circle-badge"><span data-slot="player.category">CATEGORY</span></div>
          </div>
          <div class="circle-plate">
            <div class="circle-name" data-slot="player.name">PLAYER NAME</div>
            <div class="circle-sub" data-slot="player.role">ROLE / POSITION</div>
          </div>
          <div class="chip-row">
            <div class="chip"><i>◷</i><div><span>AGE</span><b data-slot="player.age">--</b></div></div>
            <div class="chip"><i>◆</i><div><span>STYLE</span><b data-slot="player.style">--</b></div></div>
            <div class="chip"><i>◉</i><div><span>CITY</span><b data-slot="player.city">--</b></div></div>
            <div class="chip"><i>#</i><div><span>LOT NO.</span><b data-slot="player.id">--</b></div></div>
          </div>
        </article>`;
    } else if (template === 'broadcast') {
      html = `
        <article class="tpl-broadcast">
          ${photoShell('broadcast-photo')}
          <div class="broadcast-copy">
            <div class="broadcast-eyebrow"><span data-slot="player.category">CATEGORY</span> • <span data-slot="player.id">PLAYER ID</span></div>
            <div class="broadcast-name" data-slot="player.name">PLAYER NAME</div>
            <div class="broadcast-role" data-slot="player.role">ROLE / POSITION</div>
            <div class="broadcast-rule"></div>
            <div class="broadcast-stats">
              <div class="broadcast-stat"><span>AGE</span><strong data-slot="player.age">--</strong></div>
              <div class="broadcast-stat"><span>STYLE</span><strong data-slot="player.style">--</strong></div>
              <div class="broadcast-stat"><span>SECONDARY INFO</span><strong data-slot="player.secondary">--</strong></div>
              <div class="broadcast-stat"><span>CITY / CLUB</span><strong data-slot="player.city">--</strong></div>
            </div>
          </div>
        </article>`;
    } else if (template === 'poster') {
      html = `
        <article class="tpl-poster">
          ${photoShell('poster-photo')}
          <div class="poster-copy">
            <div class="poster-kicker"><span data-slot="player.category">CATEGORY</span><span data-slot="player.id">PLAYER ID</span></div>
            <div class="poster-name" data-slot="player.name">PLAYER NAME</div>
            <div class="poster-role"><span data-slot="player.role">ROLE</span> • <span data-slot="player.city">CITY / CLUB</span></div>
          </div>
          <div class="poster-stamp">SPORTS<br>AUCTION<br>LIVE</div>
        </article>`;
    } else if (template === 'pb-sunset') {
      /* SUNSET — golden hour on a resort court. The profile is an instant
         photo print pinned to the board, tilted, caption written beneath. */
      html = `
        <article class="tpl-pb tpl-pb-sun">
          <div class="pbs-clip"><i></i><b></b></div>
          <div class="pbs-print">
            ${photoShell('pbs-photo')}
            <div class="pbs-caption">
              <div class="pbs-name" data-slot="player.name">PLAYER NAME</div>
              <div class="pbs-role" data-slot="player.role">ROLE</div>
              <div class="pbs-line">
                <span data-slot="player.id">LOT</span>
                <i></i><span><b data-slot="player.age">--</b> YRS</span>
                <i></i><span data-slot="player.category">CATEGORY</span>
              </div>
            </div>
          </div>
        </article>`;

    } else if (template === 'pb-press') {
      /* PRESS — a monochrome editorial spread. Oversized price typography,
         the player set small and precise to one side, hairline rules and a
         single volt accent lifted from the ball. */
      html = `
        <article class="tpl-pb tpl-pb-press">
          <div class="pbe-rail"><span data-slot="player.id">LOT</span></div>
          <div class="pbe-body">
            <div class="pbe-shot">${photoShell('pbe-photo')}</div>
            <h2 class="pbe-name" data-slot="player.name">PLAYER NAME</h2>
            <div class="pbe-hair"></div>
            <dl class="pbe-list">
              <div class="pbe-item"><dt>ROLE</dt><dd data-slot="player.role">--</dd></div>
              <div class="pbe-item"><dt>AGE</dt><dd data-slot="player.age">--</dd></div>
              <div class="pbe-item"><dt>CATEGORY</dt><dd data-slot="player.category">--</dd></div>
              <div class="pbe-item"><dt>CITY / CLUB</dt><dd data-slot="player.city">--</dd></div>
            </dl>
          </div>
        </article>`;

    } else if (template === 'pb-hall') {
      /* HALL — a framed portrait hung in an old indoor wooden court, lit by a
         single hanging lamp. Warm brass and cream against dark timber. */
      html = `
        <article class="tpl-pb tpl-pb-hall">
          <div class="pbh-lamp"><i></i><b></b></div>
          <div class="pbh-frame">
            <span class="pbh-corner pbh-tl"></span><span class="pbh-corner pbh-tr"></span>
            <span class="pbh-corner pbh-bl"></span><span class="pbh-corner pbh-br"></span>
            ${photoShell('pbh-photo')}
            <div class="pbh-lot" data-slot="player.id">LOT</div>
          </div>
          <div class="pbh-plaque">
            <div class="pbh-name" data-slot="player.name">PLAYER NAME</div>
            <div class="pbh-rule"><i></i><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><g class="pbh-holes"><circle cx="50" cy="26" r="7"/><circle cx="50" cy="74" r="7"/><circle cx="26" cy="50" r="7"/><circle cx="74" cy="50" r="7"/><circle cx="33" cy="33" r="6"/><circle cx="67" cy="33" r="6"/><circle cx="33" cy="67" r="6"/><circle cx="67" cy="67" r="6"/></g></svg><i></i></div>
            <div class="pbh-role" data-slot="player.role">ROLE</div>
            <div class="pbh-meta">
              <span><b data-slot="player.age">--</b> YRS</span>
              <span data-slot="player.category">CATEGORY</span>
              <span data-slot="player.city">CITY / CLUB</span>
            </div>
          </div>
        </article>`;
    } else {
      html = `
        <article class="tpl-arena">
          ${photoShell('arena-photo')}
          <div class="arena-copy">
            <div class="category-badge" data-slot="player.category">CATEGORY</div>
            <div class="arena-plate">
              <div class="player-name" data-slot="player.name">PLAYER NAME</div>
              <div class="player-subline"><b data-slot="player.id">PLAYER ID</b><span data-slot="player.role">ROLE / POSITION</span></div>
            </div>
          </div>
        </article>`;
    }

    playerZone.innerHTML = html;

    paintPlayer();
  }


  /* ───────────── painting live values into slots ───────────── */
  function paintPlayer() {
    const p = state.player;
    setSlot('player.name', p && p.name ? p.name : 'AWAITING PLAYER');
    setSlot('player.id', p && p.id ? p.id : DASH);
    setSlot('player.category', p && p.category ? p.category : DASH);
    setSlot('player.role', p && p.role ? p.role : DASH);
    setSlot('player.age', p && p.age ? p.age : DASH);
    setSlot('player.style', p && p.style ? p.style : DASH);
    setSlot('player.secondary', p && p.secondary ? p.secondary : DASH);
    setSlot('player.city', p && p.city ? p.city : DASH);
    setSlot('player.base-price', money(state.auction.basePrice));
    setSlot('player.base-price-footer', money(state.auction.basePrice));

    /* Pickleball chips/rails: drop entries with no value, and collapse
       duplicates — many sheets carry the same text in role and category. */
    const seenChip = new Set();
    playerZone.querySelectorAll('.pbh-meta span, .pbd-fact, .pbe-item').forEach(el => {
      const valEl = el.querySelector('strong, dd') || el;
      const val = valEl.textContent.replace(/\s+/g, ' ').replace(/--/g, '').trim();
      const key = val.replace(/[^A-Z0-9]/gi, '');
      if (!key || seenChip.has(key)) { el.style.display = 'none'; return; }
      seenChip.add(key);
      el.style.display = '';
    });

    // Cricket-Attax archetype badge + split nameplate (collector card)
    const arch = archetype(p && p.role);
    const card = playerZone.querySelector('.tpl-collector');
    if (card) {
      card.dataset.archetype = arch.key;
      card.style.setProperty('--arch-color', arch.color);
      const icon = card.querySelector('.ct-icon'); if (icon) icon.textContent = arch.icon;
      const label = card.querySelector('.ct-label'); if (label) label.textContent = arch.label;
      // split "VIRAT SHARMA" → first "VIRAT", surname "SHARMA" (Attax style)
      const nm = (p && p.name ? p.name : '').trim();
      const parts = nm.split(/\s+/);
      const first = card.querySelector('.collector-firstname');
      const title = card.querySelector('.collector-title');
      if (parts.length > 1 && first && title) {
        first.textContent = parts.slice(0, -1).join(' ');
        title.textContent = parts[parts.length - 1];
      } else if (first) {
        first.textContent = '';
      }
    }
    paintPhoto();
  }

  let lastPrice = null;
  function paintAuction() {
    setSlot('auction.status', state.auction.status);
    setSlot('auction.current-price', money(state.auction.currentPrice));
    setSlot('auction.increment', state.auction.increment ? `+ ${money(state.auction.increment)}` : '+ ₹ --');
    setSlot('auction.progress', state.tournament.progress);

    // subtle emphasis when the price actually changes
    if (lastPrice !== null && state.auction.currentPrice !== lastPrice) {
      document.querySelectorAll('[data-slot="auction.current-price"]').forEach(el => {
        el.classList.remove('price-pop');
        void el.offsetWidth;
        el.classList.add('price-pop');
      });
    }
    lastPrice = state.auction.currentPrice;
  }

  function paintTournament() {
    setSlot('tournament.name', state.tournament.name);
    setSlot('tournament.subtitle', state.tournament.subtitle);
    // Organisation name sits small above the event name; empty hides its line.
    const orgEls = document.querySelectorAll('[data-slot="tournament.org"]');
    orgEls.forEach(el => {
      el.textContent = state.tournament.org || '';
      el.style.display = state.tournament.org ? '' : 'none';
    });
    // Organisation logo replaces the placeholder mark on every screen.
    const markEls = document.querySelectorAll('[data-slot="tournament.logo"]');
    markEls.forEach(el => {
      if (state.tournament.logo) {
        el.innerHTML = '<img src="' + state.tournament.logo + '" alt="" style="width:100%;height:100%;object-fit:contain">';
        el.classList.add('has-logo');
      } else if (el.classList.contains('has-logo')) {
        el.innerHTML = '◉';
        el.classList.remove('has-logo');
      }
    });
    // 'presented by ORG' credit on the public stage.
    const credit = document.getElementById('presentedBy');
    if (credit) {
      if (state.tournament.org) {
        credit.innerHTML = 'presented by <b>' + state.tournament.org + '</b>';
        credit.style.display = '';
      } else { credit.style.display = 'none'; }
    }
  }

  /* ── Welcome intro overlay (both screens, dismissed once) ──────────────
     Triggered by Go Live setting auction_state.show_intro='1'. Both the
     admin stage and the public projector read the flag by polling, so a
     single dismissal (or the safety timeout) clears it everywhere. */
  let introVisible = false;
  let introTimer = null;
  const introOverlay = document.getElementById('introOverlay');
  async function clearIntroFlag() {
    try {
      await fetch('/api/auction/state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_intro: '' })
      });
    } catch (e) { /* non-fatal */ }
  }
  function hideIntro(alsoClearServer) {
    if (!introOverlay) return;
    introOverlay.classList.remove('is-visible');
    setTimeout(() => { introOverlay.style.display = 'none'; }, 600);
    introVisible = false;
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    if (alsoClearServer) clearIntroFlag();
  }
  function showIntro() {
    if (!introOverlay || introVisible) return;
    const ev = document.getElementById('introEvent');
    const org = document.getElementById('introOrg');
    const logo = document.getElementById('introLogo');
    if (ev)  ev.textContent = state.tournament.name || 'LIVE AUCTION';
    if (org) org.textContent = state.tournament.org ? ('presented by ' + state.tournament.org) : '';
    if (logo) logo.innerHTML = state.tournament.logo
      ? '<img src="' + state.tournament.logo + '" alt="">'
      : '';
    introOverlay.style.display = 'flex';
    void introOverlay.offsetWidth;
    introOverlay.classList.add('is-visible');
    introVisible = true;
    // Safety auto-dismiss so the public screen never gets stuck on the intro.
    introTimer = setTimeout(() => hideIntro(true), 9000);
  }
  function updateIntro() {
    if (state.showIntro && !introVisible) showIntro();
    else if (!state.showIntro && introVisible) hideIntro(false);
  }
  if (introOverlay) {
    // A click or any key dismisses for everyone.
    introOverlay.addEventListener('click', () => hideIntro(true));
    document.addEventListener('keydown', (e) => {
      if (introVisible && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault(); hideIntro(true);
      }
    });
  }

  const prevPurse = new Map();
  function paintTeams() {
    if (!state.teams.length) {
      teamRows.innerHTML = `<div class="team-empty">NO TEAMS CONFIGURED</div>`;
      return;
    }
    teamRows.innerHTML = state.teams.map((t, i) => {
      const color = t.color || TEAM_FALLBACK_COLORS[i % TEAM_FALLBACK_COLORS.length];
      const initials = String(t.name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'T';
      const logo = t.logo_url
        ? `<img src="${esc(t.logo_url)}" alt="${esc(t.name)}">`
        : esc(initials);
      // purse bar — how much of the original budget is still unspent
      const total = Number(t.total_budget) || 0;
      const rem = Number(t.remaining_budget) || 0;
      const pct = total > 0 ? Math.max(0, Math.min(100, (rem / total) * 100)) : 100;
      return `
        <div class="team-row" style="--team-color:${esc(color)}" data-team-id="${esc(t.id)}">
          <div class="team-logo">${logo}</div>
          <div class="team-copy"><strong>${esc(t.name)}</strong><span>remaining purse</span></div>
          <div class="team-purse">${money(t.remaining_budget)}</div>
          <div class="team-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        </div>`;
    }).join('');

    // brief highlight on any purse that changed
    state.teams.forEach(t => {
      const before = prevPurse.get(t.id);
      if (before !== undefined && before !== t.remaining_budget) {
        const row = teamRows.querySelector(`[data-team-id="${CSS.escape(String(t.id))}"]`);
        if (row) { row.classList.add('team-flash'); setTimeout(() => row.classList.remove('team-flash'), 500); }
      }
      prevPurse.set(t.id, t.remaining_budget);
    });
  }

  function paintAll() {
    paintTournament();
    updateIntro();
    paintAuction();
    paintTeams();
    paintPlayer();

  }

  /* ───────────── result overlay (SOLD / UNSOLD) ───────────── */
  const resultOverlay = document.getElementById('resultOverlay');
  const resultBadge   = document.getElementById('resultBadge');
  const resultPlayer  = document.getElementById('resultPlayer');
  const resultDetail  = document.getElementById('resultDetail');
  const resultPrice   = document.getElementById('resultPrice');
  const resultPhoto   = document.getElementById('resultPhoto');
  let prevAuctionStatus = '';
  let resultAutoHide = null;
  const RESULT_OVERLAY_MS = 6000;   // how long SOLD / UNSOLD stays up

  function showResultOverlay(status, info) {
    if (!resultOverlay) return;
    resultOverlay.dataset.status = status;
    if (status === 'sold') {
      resultBadge.textContent  = 'SOLD';
      resultPlayer.textContent = info.player || '';
      resultDetail.textContent = info.teamName ? `TO   ${info.teamName.toUpperCase()}` : '';
      resultPrice.textContent  = info.price ? money(info.price) : '';
      resultOverlay.style.setProperty('--overlay-team-color', info.teamColor || '#10b981');
    } else {
      resultBadge.textContent  = 'UNSOLD';
      resultPlayer.textContent = info.player || '';
      resultDetail.textContent = '';
      resultPrice.textContent  = '';
      resultOverlay.style.removeProperty('--overlay-team-color');
    }
    if (info.photo) {
      resultPhoto.style.backgroundImage = `url('${info.photo}')`;
      resultPhoto.style.display = '';
    } else {
      resultPhoto.style.backgroundImage = '';
      resultPhoto.style.display = 'none';
    }
    // The celebration plays, then clears itself so the board stays readable
    // while the operator lines up the next lot.
    clearTimeout(resultAutoHide);
    resultAutoHide = setTimeout(hideResultOverlay, RESULT_OVERLAY_MS);
    resultOverlay.style.display = 'flex';
    resultOverlay.removeAttribute('hidden');
    void resultOverlay.offsetWidth; // reflow for animation
    resultOverlay.classList.add('result-overlay--visible');
  }

  function hideResultOverlay() {
    if (!resultOverlay) return;
    clearTimeout(resultAutoHide);
    if (resultOverlay.style.display === 'none') return;
    resultOverlay.classList.remove('result-overlay--visible');
    // Fall back to a timer — transitionend never fires if the element is
    // already transparent or the transition is interrupted.
    const done = () => {
      resultOverlay.style.display = 'none';
      resultOverlay.setAttribute('hidden', '');
    };
    let settled = false;
    const once = () => { if (!settled) { settled = true; done(); } };
    resultOverlay.addEventListener('transitionend', once, { once: true });
    setTimeout(once, 600);
  }

  /* ───────────── live data ─────────────
     Same endpoint the existing /live spectator screen uses. Read-only. */
  function ingest(data) {
    const cfg = data.config || {};
    const st = data.auction_state || {};
    const stats = data.stats || null;

    state.tournament.name = (cfg.event_name || 'LIVE AUCTION').toUpperCase();
    state.tournament.org = (cfg.organisation_name || '').toUpperCase();
    state.tournament.logo = cfg.org_logo || '';
    state.showIntro = (st.show_intro === '1' || st.show_intro === 1);
    state.tournament.progress = stats && stats.total ? `${stats.sold} / ${stats.total}` : '-- / --';

    let attrs = {};
    if (st.attributes) {
      try { attrs = typeof st.attributes === 'string' ? JSON.parse(st.attributes) : st.attributes; }
      catch (_) { attrs = {}; }
    }

    const rowName = (st.current_player || '').trim();
    if (rowName) {
      const realName = attrName(attrs);
      state.player = {
        name: (realName || rowName).toUpperCase(),
        id: realName ? rowName : (attrFind(attrs, /lot|^id$|player\s*id|code|s\.?\s*no|serial/i) || ''),
        category: (st.category || '').toUpperCase(),
        photo: st.photo_url || '',
        role: (attrFind(attrs, /role|position/i) || '').toUpperCase(),
        age: attrFind(attrs, /age/i) || '',
        style: (attrFind(attrs, /batting|\bbat\b|style/i) || '').toUpperCase(),
        secondary: (attrFind(attrs, /bowling|\bbowl\b/i) || '').toUpperCase(),
        city: (attrFind(attrs, /city|town|location|state|country|club/i) || '').toUpperCase(),
        // Everything else the sheet carried, so templates can show real columns
        // instead of hard-coded fields the file may not have.
        attrs: attrs,
      };
      state.auction.status = 'CURRENT PLAYER';
    } else {
      state.player = null;
      state.auction.status = 'WAITING FOR PLAYER';
    }

    state.auction.currentPrice = rowName ? (parseFloat(st.current_bid) || 0) : null;
    state.auction.basePrice = rowName ? (parseFloat(st.base_price) || 0) : null;
    state.auction.increment = parseFloat(cfg.bid_increment) || null;

    state.teams = (data.teams || []).map(t => ({
      id: t.id, name: String(t.name || '').toUpperCase(),
      color: t.color, logo_url: t.logo_url,
      remaining_budget: t.remaining_budget,
      total_budget: t.total_budget,
      squad: Array.isArray(t.players) ? t.players.length : 0,
    }));

    // Pool data for the progress bar, "up next" lots and the sold ticker
    if (stats) {
      state.stats = {
        total: stats.total || 0, sold: stats.sold || 0,
        unsold: stats.unsold || 0, passed: stats.passed || 0, spent: stats.spent || 0,
      };
    }
    // sold_players already carries team_name / team_color from the JOIN
    state.soldPlayers = (data.sold_players || []).slice(0, 6).map(p => ({
      name: String(p.name || ''),
      price: p.sold_price,
      team: String(p.team_name || ''),
      color: p.team_color || '#64748b',
    }));

    // Apply stage settings from admin panel
    const newSport = (st.auction_sport || '').toLowerCase();
    const newMode = st.auction_template_mode || 'fixed';
    const rawFixed = st.auction_template || 'arena';
    const newFixed = PB_ALIAS[rawFixed] || rawFixed;   // map retired template names

    if (newSport && SPORTS.includes(newSport) && newSport !== stageSport) {
      stageSport = newSport;
      setSport(newSport, { applyDefaultBg: !bgManual });
    }
    stageTemplateMode = newMode;
    stageFixedTemplate = newFixed;

    // Resolve which template to show based on mode and player change
    const currentPlayerName = state.player ? state.player.name : null;
    const playerJustChanged = currentPlayerName !== null && currentPlayerName !== prevPlayerName;
    if (playerJustChanged) {
      prevPlayerName = currentPlayerName;
      const pool = SPORT_TEMPLATES[stageSport] || TEMPLATES;
      if (stageTemplateMode === 'random') {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        setTemplate(pick);
      } else if (stageTemplateMode === 'sequential') {
        const pick = pool[seqIndex % pool.length];
        seqIndex++;
        setTemplate(pick);
      } else {
        if (TEMPLATES.includes(stageFixedTemplate)) setTemplate(stageFixedTemplate);
      }
    } else if (currentPlayerName && stageTemplateMode === 'fixed' && stageFixedTemplate !== stage.dataset.template) {
      // Same player on block but admin changed the fixed template — apply within next poll cycle
      if (TEMPLATES.includes(stageFixedTemplate)) setTemplate(stageFixedTemplate);
    } else if (!currentPlayerName && prevPlayerName !== null) {
      prevPlayerName = null;
    } else if (!currentPlayerName && stageTemplateMode === 'fixed' && stageFixedTemplate !== stage.dataset.template) {
      if (TEMPLATES.includes(stageFixedTemplate)) setTemplate(stageFixedTemplate);
    }

    // SOLD / UNSOLD overlay
    const auctionStatus = st.auction_status || '';
    if (auctionStatus !== prevAuctionStatus) {
      prevAuctionStatus = auctionStatus;
      if (auctionStatus === 'sold') {
        showResultOverlay('sold', {
          player:    st.last_sold_player    || '',
          price:     parseFloat(st.last_sold_price) || 0,
          teamName:  st.last_sold_team_name  || '',
          teamColor: st.last_sold_team_color || '#10b981',
          photo:     st.last_sold_photo      || '',
        });
      } else if (auctionStatus === 'passed') {
        showResultOverlay('passed', {
          player: st.last_passed_player || '',
          photo:  st.last_passed_photo  || '',
        });
      } else if (auctionStatus === '') {
        hideResultOverlay();
      }
    }
  }

  /* Preview-only sample values from the real sample_players_with_photos_25
     sheet (real photos + real roles). NEVER active unless the URL says
     ?demo=1 — nothing is written to the database and no auction state is
     touched. `?demo=1&p=N` shows player N; `?demo=1&cycle=1` rotates through
     them every few seconds for a hands-off showcase. */
  const DEMO_PLAYERS = [{"id":"PL-001","name":"Virat Sharma","age":28,"role":"Top-Order Batsman","basePrice":100,"photo":"https://randomuser.me/api/portraits/men/32.jpg"},{"id":"PL-002","name":"Rohit Verma","age":34,"role":"Opening Batsman","basePrice":90,"photo":"https://randomuser.me/api/portraits/men/44.jpg"},{"id":"PL-003","name":"Jasprit Patel","age":26,"role":"Fast Bowler","basePrice":95,"photo":"https://randomuser.me/api/portraits/men/67.jpg"},{"id":"PL-004","name":"Hardik Mehta","age":27,"role":"All-Rounder","basePrice":85,"photo":"https://randomuser.me/api/portraits/men/75.jpg"},{"id":"PL-005","name":"Rishabh Singh","age":23,"role":"Wicketkeeper-Batsman","basePrice":80,"photo":"https://randomuser.me/api/portraits/men/86.jpg"},{"id":"PL-006","name":"Shubman Kumar","age":22,"role":"Top-Order Batsman","basePrice":75,"photo":"https://randomuser.me/api/portraits/men/22.jpg"},{"id":"PL-007","name":"Ravindra Joshi","age":32,"role":"Spin All-Rounder","basePrice":85,"photo":"https://randomuser.me/api/portraits/men/15.jpg"},{"id":"PL-008","name":"Kuldeep Shah","age":25,"role":"Spin Bowler","basePrice":60,"photo":"https://randomuser.me/api/portraits/men/51.jpg"},{"id":"PL-009","name":"Mohammed Rao","age":29,"role":"Pace Bowler","basePrice":70,"photo":"https://randomuser.me/api/portraits/men/61.jpg"},{"id":"PL-010","name":"Suryakumar Reddy","age":31,"role":"Middle-Order Batsman","basePrice":90,"photo":"https://randomuser.me/api/portraits/men/71.jpg"},{"id":"PL-011","name":"Yashasvi Nair","age":19,"role":"Opening Batsman","basePrice":50,"photo":"https://randomuser.me/api/portraits/men/11.jpg"},{"id":"PL-012","name":"Sanju Das","age":28,"role":"Wicketkeeper-Batsman","basePrice":65,"photo":"https://randomuser.me/api/portraits/men/29.jpg"},{"id":"PL-013","name":"Arshdeep Sen","age":24,"role":"Left-Arm Fast Bowler","basePrice":65,"photo":"https://randomuser.me/api/portraits/men/41.jpg"},{"id":"PL-014","name":"Rinku Roy","age":25,"role":"Finisher / Batsman","basePrice":55,"photo":"https://randomuser.me/api/portraits/men/58.jpg"},{"id":"PL-015","name":"Smriti Banerjee","age":26,"role":"Opening Batsman","basePrice":95,"photo":"https://randomuser.me/api/portraits/women/44.jpg"},{"id":"PL-016","name":"Harmanpreet Mukherjee","age":33,"role":"All-Rounder","basePrice":95,"photo":"https://randomuser.me/api/portraits/women/65.jpg"},{"id":"PL-017","name":"Shafali Chatterjee","age":18,"role":"Power Batsman","basePrice":70,"photo":"https://randomuser.me/api/portraits/women/28.jpg"},{"id":"PL-018","name":"Jemimah Iyer","age":22,"role":"Top-Order Batsman","basePrice":75,"photo":"https://randomuser.me/api/portraits/women/79.jpg"},{"id":"PL-019","name":"Deepti Iyengar","age":25,"role":"Spin All-Rounder","basePrice":80,"photo":"https://randomuser.me/api/portraits/women/12.jpg"},{"id":"PL-020","name":"Renuka Pillai","age":27,"role":"Pace Bowler","basePrice":70,"photo":"https://randomuser.me/api/portraits/women/33.jpg"},{"id":"PL-021","name":"Richa Menon","age":20,"role":"Wicketkeeper-Finisher","basePrice":65,"photo":"https://randomuser.me/api/portraits/women/48.jpg"},{"id":"PL-022","name":"Radha Nambiar","age":23,"role":"Spin Bowler","basePrice":60,"photo":"https://randomuser.me/api/portraits/women/59.jpg"},{"id":"PL-023","name":"Pooja Kulkarni","age":24,"role":"Medium Pacer","basePrice":55,"photo":"https://randomuser.me/api/portraits/women/68.jpg"},{"id":"PL-024","name":"Yastika Deshmukh","age":22,"role":"Wicketkeeper-Batsman","basePrice":50,"photo":"https://randomuser.me/api/portraits/women/76.jpg"},{"id":"PL-025","name":"Harleen Patil","age":25,"role":"All-Rounder","basePrice":60,"photo":"https://randomuser.me/api/portraits/women/89.jpg"}];
  const DEMO_TEAMS = [
    { id: 1, name: 'Blue Titans',    color: '#3f82ff', total_budget: 1000, remaining_budget: 720 },
    { id: 2, name: 'Red Warriors',   color: '#ee5361', total_budget: 1000, remaining_budget: 540 },
    { id: 3, name: 'Green Strikers', color: '#22be88', total_budget: 1000, remaining_budget: 875 },
    { id: 4, name: 'Golden XI',      color: '#f0a11b', total_budget: 1000, remaining_budget: 640 },
  ];
  const CITY_POOL = ['Mumbai','Delhi','Pune','Bengaluru','Chennai','Kolkata','Hyderabad','Jaipur'];
  const BAT_POOL = ['Right Handed','Left Handed'];

  function demoPayload(i) {
    const p = DEMO_PLAYERS[((i % DEMO_PLAYERS.length) + DEMO_PLAYERS.length) % DEMO_PLAYERS.length];
    const arch = archetype(p.role);
    const bowling = arch.key === 'batsman' || arch.key === 'keeper' ? '—'
      : (/spin/i.test(p.role) ? 'Right-arm Off Spin' : /left/i.test(p.role) ? 'Left-arm Fast' : 'Right-arm Medium');
    return {
      config: { event_name: 'Society Auction 2026', bid_increment: 5 },
      auction_state: {
        current_player: p.id, current_bid: p.basePrice, base_price: p.basePrice,
        category: p.age <= 19 ? 'Under-19' : (p.age >= 30 ? 'Senior Pro' : 'Open'),
        photo_url: p.photo,
        attributes: {
          Name: p.name, Age: String(p.age), Role: p.role,
          Batting: BAT_POOL[i % 2], Bowling: bowling, City: CITY_POOL[i % CITY_POOL.length],
        },
      },
      teams: DEMO_TEAMS,
      stats: { sold: (i % DEMO_PLAYERS.length), total: DEMO_PLAYERS.length },
    };
  }

  const _dp = new URLSearchParams(location.search);
  const demoMode = _dp.get('demo') === '1';
  const demoCycle = _dp.get('cycle') === '1';
  let demoIndex = Math.max(0, (parseInt(_dp.get('p'), 10) || 1) - 1);

  async function poll() {
    if (demoMode) {
      ingest(demoPayload(demoIndex));
      if (demoCycle) demoIndex++;
      state.connected = true; stage.dataset.connected = '1'; paintAll();
      return;
    }
    try {
      const res = await fetch('/api/live_data', { cache: 'no-store' });
      if (!res.ok) throw new Error('bad status');
      ingest(await res.json());
      state.connected = true;
    } catch (_) {
      state.connected = false;
    }
    stage.dataset.connected = state.connected ? '1' : '0';
    paintAll();
  }

  /* ───────────── controls (preview only — never on the public screen) ───────────── */
  function setTemplate(template) {
    if (!TEMPLATES.includes(template)) return;
    stage.dataset.template = template;
    if (templateSelect) templateSelect.value = template;
    renderTemplate(template);
    // template-preferred backdrop (cricket only, and only if the operator
    // hasn't overridden the background by hand)
    if (!bgManual) {
      const sport = stage.dataset.sport || 'cricket';
      const pref = (TEMPLATE_DEFAULT_BG[sport] || {})[template];
      if (pref) setBackground(pref);
      else setBackground(SPORT_DEFAULT_BG[sport] || 'none');
    }
  }

  function setSport(sport, { applyDefaultBg = true } = {}) {
    if (!SPORTS.includes(sport)) return;
    stage.dataset.sport = sport;
    if (sportSelect) sportSelect.value = sport;
    if (applyDefaultBg) setBackground(SPORT_DEFAULT_BG[sport] || 'none');
  }

  function setBackground(bg) {
    if (!BACKGROUNDS.includes(bg)) return;
    if (bg === 'none') delete stage.dataset.bg;
    else stage.dataset.bg = bg;
    if (bgSelect) bgSelect.value = bg;
  }

  function fitStage() {
    // The admin bar lives outside the stage at native size, so the canvas gets
    // the space above it. Centre explicitly so it can never drift off-screen.
    const panel = document.getElementById('adminPanel');
    const reserved = (panel && panel.style.display !== 'none') ? panel.offsetHeight : 0;
    const availH = Math.max(200, window.innerHeight - reserved);
    const scale = Math.min(window.innerWidth / 1920, availH / 1080);
    stage.style.top = (availH / 2) + 'px';
    stage.style.transform = `translate(-50%,-50%) scale(${scale})`;
    document.documentElement.style.setProperty('--admin-h', reserved + 'px');
  }
  // Expose so the admin panel can re-fit after it becomes visible / changes height
  window.__fitStage = fitStage;

  window.addEventListener('resize', fitStage);
  if (sportSelect) sportSelect.addEventListener('change', e => setSport(e.target.value));
  if (templateSelect) templateSelect.addEventListener('change', e => setTemplate(e.target.value));
  if (bgSelect) bgSelect.addEventListener('change', e => { bgManual = true; setBackground(e.target.value); });

  document.addEventListener('keydown', async (e) => {
    const k = e.key.toLowerCase();
    if (k === 'd') debugPanel.hidden = !debugPanel.hidden;
    if (k === 'f') {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (_) {}
    }
    const n = Number(e.key);
    if (n >= 1 && n <= 5) setTemplate(TEMPLATES[n - 1]);
  });

  /* URL configuration so an operator can bookmark a specific display:
     ?template=collector&sport=cricket  (?preview=1 reveals the panel) */
  const params = new URLSearchParams(location.search);
  if (params.get('preview') === '1') debugPanel.hidden = false;

  fitStage();
  setSport(params.get('sport') || 'cricket');
  if (params.get('bg')) setBackground(params.get('bg'));   // explicit override wins
  setTemplate(params.get('template') || 'arena');
  paintAll();
  poll();
  // Demo cycle advances slowly for a hands-off showcase; live mode polls at 2s.
  setInterval(poll, (demoMode && demoCycle) ? 5000 : 2000);

  // ═══════════════════════════════════════════════════════════
  // ADMIN CONTROL PANEL — only active when ?admin=1 is in URL
  // Full auction management: player select, bid, sell, pass, undo
  // ═══════════════════════════════════════════════════════════
  if (params.get('admin') === '1') {
    const $ = id => document.getElementById(id);
    const adminPanel      = $('adminPanel');
    const adminIdle       = $('adminIdle');
    const adminActive     = $('adminActive');
    const adminPlayerCat  = $('adminPlayerCat');
    const adminPlayerName = $('adminPlayerName');
    const adminBidDisplay = $('adminBidDisplay');
    const adminBidDec     = $('adminBidDec');
    const adminBidInc     = $('adminBidInc');
    const adminBidMinus10 = $('adminBidMinus10');
    const adminBidPlus10  = $('adminBidPlus10');
    const adminBidPlus25  = $('adminBidPlus25');
    const adminTeamSel    = $('adminTeamSel');
    const adminPassBtn    = $('adminPassBtn');
    const adminSoldBtn    = $('adminSoldBtn');
    const adminNextBtn    = $('adminNextBtn');
    const adminRandomBtn  = $('adminRandomBtn');
    const adminPickBtn    = $('adminPickBtn');
    const adminUndoBtn    = $('adminUndoBtn');
    const adminUndoBtn2   = $('adminUndoBtn2');
    const adminSportSel   = $('adminSportSel');
    const adminTemplateSel= $('adminTemplateSel');
    const adminStats      = $('adminStats');
    const playerPickModal = $('playerPickModal');
    const playerPickList  = $('playerPickList');
    const playerPickSearch= $('playerPickSearch');
    const playerPickClose = $('playerPickClose');
    const modalRandomBtn  = $('modalRandomBtn');
    const adminSpinBtn    = $('adminSpinBtn');
    const adminUnsoldSpin = $('adminUnsoldSpinBtn');
    const adminMuteBtn    = $('adminMuteBtn');
    const confettiLayer   = $('confettiLayer');
    const spinModal       = $('spinModal');
    const spinWheel       = $('spinWheel');
    const spinList        = $('spinList');
    const spinTitle       = $('spinTitle');
    const spinSideTitle   = $('spinSideTitle');
    const spinAll         = $('spinAll');
    const spinGo          = $('spinGo');
    const spinConfirm     = $('spinConfirm');
    const spinClose       = $('spinClose');
    const spinResult      = $('spinResult');

    if (!adminPanel) { console.warn('Admin panel elements not found'); return; }
    adminPanel.style.display = 'block';
    // Re-fit the stage now that the native-size admin bar occupies the bottom
    fitStage();
    // The bar changes height when swapping idle <-> active; keep the stage in sync
    if (window.ResizeObserver) new ResizeObserver(() => fitStage()).observe(adminPanel);

    let adminBid = 0;
    let adminIncrement = 2.5;
    let adminPlayer = null;
    let adminTeams = [];
    let adminUnsoldPlayers = [];
    let adminTotalPlayers = 0;
    let adminSoldCount = 0;
    let adminCatRules = [];

    /* ═══════════ SOUND ENGINE ═══════════
       Synthesized with the Web Audio API — no sound files. Frequencies and
       waveforms match the documented behaviour: rising beep on a bid change,
       a four-note arpeggio on a sale, an anticipation sweep on a draw, a tick
       on clicks and a falling sawtooth on undo. */
    let audioOn = localStorage.getItem('pbAudioOn') !== '0';
    let audioCtx = null;
    function ac() {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }
    function tone(freq, endFreq, dur, type, gain, delay) {
      if (!audioOn) return;
      const c = ac(); if (!c) return;
      try {
        const t0 = c.currentTime + (delay || 0);
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t0);
        if (endFreq && endFreq !== freq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
        g.gain.setValueAtTime(gain == null ? 0.2 : gain, t0);
        g.gain.exponentialRampToValueAtTime(0.01, t0 + dur);
        o.start(t0); o.stop(t0 + dur);
      } catch (e) { /* audio is a nicety — never break the auction for it */ }
    }
    const SFX = {
      bid:   () => tone(600, 1000, 0.12, 'sine', 0.2),
      draw:  () => tone(300, 800, 0.35, 'sine', 0.25),
      click: () => tone(1200, null, 0.05, 'sine', 0.1),
      undo:  () => tone(500, 200, 0.2, 'sawtooth', 0.1),
      sold:  () => [523, 659, 784, 1047].forEach((f, i) =>
                     tone(f, null, 0.4, i < 3 ? 'sine' : 'triangle', 0.2, i * 0.1)),
    };
    function say(text) {
      if (!audioOn || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05; u.pitch = 1.0;
        window.speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
    }
    function renderMute() {
      if (!adminMuteBtn) return;
      adminMuteBtn.textContent = audioOn ? 'SOUND ON' : 'SOUND OFF';
      adminMuteBtn.classList.toggle('is-muted', !audioOn);
    }
    if (adminMuteBtn) {
      renderMute();
      adminMuteBtn.onclick = () => {
        audioOn = !audioOn;
        localStorage.setItem('pbAudioOn', audioOn ? '1' : '0');
        if (!audioOn && window.speechSynthesis) window.speechSynthesis.cancel();
        renderMute();
        if (audioOn) SFX.click();
      };
    }

    /* ═══════════ CONFETTI ═══════════ */
    const CONFETTI_COLORS = ['#f5b72e','#10b981','#3b82f6','#ef4444','#a855f7','#f97316','#facc15','#22d3ee'];
    function confetti() {
      if (!confettiLayer) return;
      confettiLayer.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 90; i++) {
        const d = document.createElement('i');
        const size = 6 + Math.random() * 8;
        d.style.cssText =
          `left:${Math.random() * 100}%;width:${size}px;height:${size}px;` +
          `background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};` +
          `border-radius:${Math.random() > 0.5 ? '50%' : '2px'};` +
          `animation-duration:${1.4 + Math.random()}s;animation-delay:${Math.random() * 0.5}s;`;
        frag.appendChild(d);
      }
      confettiLayer.appendChild(frag);
      setTimeout(() => { confettiLayer.innerHTML = ''; }, 2500);
    }

    /* ── toast notifications (no alert/confirm — blocked in popups) ── */
    let toastEl = null, toastTimer = null;
    function toast(msg, type) {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.style.cssText = 'position:fixed;bottom:140px;left:50%;transform:translateX(-50%);color:#fff;padding:12px 28px;border-radius:10px;font:700 15px/1.3 Inter,sans-serif;z-index:9999;pointer-events:none;transition:opacity .3s;box-shadow:0 8px 30px #0008;letter-spacing:.04em;text-align:center';
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.style.background = type === 'err' ? '#991b1b' : type === 'ok' ? '#166534' : '#1e293b';
      toastEl.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, 2800);
    }

    const fmt = v => '₹ ' + (v % 1 === 0 ? v : v.toFixed(1)) + 'L';

    function showIdle() {
      adminIdle.style.display = '';
      adminActive.style.display = 'none';
      adminPlayer = null;
    }

    function showActive(player, bid) {
      adminPlayer = player;
      adminBid = bid;
      adminPlayerCat.textContent  = (player.category || '').toUpperCase();
      adminPlayerName.textContent = (player.name || '').toUpperCase();
      adminBidDisplay.value = adminBid;
      adminIdle.style.display = 'none';
      adminActive.style.display = '';
    }

    function renderBidButtons() {
      const label = adminIncrement % 1 === 0 ? adminIncrement : adminIncrement.toFixed(1);
      if (adminBidDec) adminBidDec.textContent = '-' + label;
      if (adminBidInc) adminBidInc.textContent = '+' + label;
    }

    let bidPostTimer = null;
    /* Push the current bid to the server (debounced) and refresh the stage. */
    function pushBid() {
      adminBidDisplay.value = adminBid;
      adminBidDisplay.classList.remove('bid-pulse');
      void adminBidDisplay.offsetWidth;
      adminBidDisplay.classList.add('bid-pulse');
      updateTeamDropdown();          // affordability labels track the new bid
      clearTimeout(bidPostTimer);
      bidPostTimer = setTimeout(async () => {
        try {
          await fetch('/api/auction/state', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ current_bid: adminBid })
          });
          poll();
        } catch(e) { console.error('bid update failed', e); }
      }, 120);
    }
    function changeBid(delta) {
      adminBid = Math.max(0, Math.round((adminBid + delta) * 10) / 10);
      SFX.bid();
      pushBid();
    }
    /* Direct entry — type an exact amount, commit on Enter or blur */
    function commitTypedBid() {
      const v = parseFloat(adminBidDisplay.value);
      if (isNaN(v) || v < 0) { adminBidDisplay.value = adminBid; return; }
      adminBid = Math.round(v * 10) / 10;
      SFX.bid();
      pushBid();
    }
    if (adminBidDisplay) {
      adminBidDisplay.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commitTypedBid(); adminBidDisplay.blur(); }
      });
      adminBidDisplay.addEventListener('blur', commitTypedBid);
    }

    /* How many players of the current player's category a team already holds,
       and the rule cap for that category. Drives both the dropdown warnings
       and the confirmation prompts on SOLD. */
    function quotaFor(team) {
      const cat = adminPlayer && adminPlayer.category;
      if (!cat) return null;
      const rule = adminCatRules.find(r => r.category === cat);
      if (!rule) return null;
      const have = (team.players || []).filter(p => (p.category || '') === cat).length;
      return { have: have, max: rule.max_per_team, min: rule.min_per_team, atMax: have >= rule.max_per_team };
    }

    function updateTeamDropdown() {
      const prev = adminTeamSel.value;
      adminTeamSel.innerHTML = '<option value="">Select Team...</option>' +
        adminTeams.map(t => {
          const purse = t.remaining_budget !== undefined ? t.remaining_budget : '?';
          const affordable = !adminPlayer || t.remaining_budget >= adminBid;
          const q = quotaFor(t);
          let flag = '';
          if (!affordable) flag = ' [Low Purse]';
          else if (q && q.atMax) flag = ' [Max Limit Reached]';
          const blocked = !affordable || (q && q.atMax);
          const label = t.name + ' (₹' + purse + 'L)' + flag;
          // Flagged teams stay selectable — the admin can override with a confirm
          return '<option value="' + t.id + '"' + (blocked ? ' style="color:#ef4444"' : '') + '>' + label + '</option>';
        }).join('');
      if (prev) adminTeamSel.value = prev;
    }

    function updateStats() {
      if (!adminStats) return;
      adminStats.innerHTML = '<span style="color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px">' +
        adminSoldCount + ' SOLD / ' + adminUnsoldPlayers.length + ' LEFT / ' + adminTotalPlayers + ' TOTAL</span>';
    }

    /* ── load all data from server ── */
    async function loadAdminMeta() {
      try {
        const r = await fetch('/api/live_data');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();

        const cfg = data.config || {};
        adminIncrement = parseFloat(cfg.bid_increment) || 2.5;
        renderBidButtons();

        adminTeams = data.teams || [];
        adminCatRules = data.category_rules || [];
        adminUnsoldPlayers = (data.unsold_players || []).filter(p => p.status === 'unsold');
        const stats = data.stats || {};
        adminTotalPlayers = stats.total || 0;
        adminSoldCount = stats.sold || 0;
        updateTeamDropdown();
        updateStats();

        const st = data.auction_state || {};
        if (adminSportSel && st.auction_sport) adminSportSel.value = st.auction_sport;
        buildTemplateOptions(st.auction_template);

        if (st.current_player && !adminPlayer) {
          const full = adminUnsoldPlayers.find(p => p.name === st.current_player);
          const fallback = {
            id: null, name: st.current_player, category: st.category || '',
            base_price: parseFloat(st.base_price) || 0, photo_url: st.photo_url || ''
          };
          showActive(full || fallback, parseFloat(st.current_bid) || 0);
        } else if (!st.current_player && !adminPlayer) {
          showIdle();
        }
      } catch(e) {
        console.error('loadAdminMeta:', e);
      }
    }

    /* ── put a player on the block ── */
    async function putOnBlock(player) {
      try {
        const res = await fetch('/api/auction/state', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            current_player: player.name,
            current_bid:    player.base_price || 0,
            category:       player.category || '',
            base_price:     player.base_price || 0,
            photo_url:      player.photo_url || ''
          })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        showActive(player, player.base_price || 0);
        playerPickModal.style.display = 'none';
        SFX.draw();
        say('Now up for auction: ' + player.name +
            (player.category ? ', ' + player.category : '') +
            ', base price ' + (player.base_price || 0) + ' Lakhs');
        poll();
      } catch(e) {
        console.error('putOnBlock:', e);
        toast('Failed to put player on block', 'err');
      }
    }

    /* ── refresh player list ── */
    async function refreshPlayers() {
      try {
        const r = await fetch('/api/live_data');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        adminUnsoldPlayers = (data.unsold_players || []).filter(p => p.status === 'unsold');
        adminTeams = data.teams || [];
        updateTeamDropdown();
        updateStats();
      } catch(e) {
        console.error('refreshPlayers:', e);
        toast('Could not load players', 'err');
      }
    }

    /* ── random draw ── */
    async function randomDraw() {
      await refreshPlayers();
      if (!adminUnsoldPlayers.length) { toast('No unsold players remaining!', 'err'); return; }
      const pick = adminUnsoldPlayers[Math.floor(Math.random() * adminUnsoldPlayers.length)];
      playerPickModal.style.display = 'none';
      await putOnBlock(pick);
    }

    /* ── player pick modal ── */
    function buildPlayerList(filter) {
      const q = (filter || '').toLowerCase();
      const matches = adminUnsoldPlayers.filter(p =>
        p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
      );
      if (!matches.length) {
        playerPickList.innerHTML = '<div class="pick-empty">' +
          (adminUnsoldPlayers.length ? 'No match for "' + filter + '"' : 'No unsold players found') + '</div>';
        return;
      }
      playerPickList.innerHTML = matches.map(p => {
        const photo = p.photo_url
          ? '<img src="' + p.photo_url + '" class="pick-photo" />'
          : '<div class="pick-photo pick-photo-init">' + (p.name[0] || '?') + '</div>';
        const cat = p.category ? '<span class="pick-cat">' + p.category + '</span>' : '';
        return '<div class="pick-row" data-id="' + p.id + '">' +
          photo + '<div class="pick-info"><span class="pick-name">' + p.name + '</span>' + cat +
          '</div><span class="pick-price">₹' + (p.base_price || 0) + 'L</span></div>';
      }).join('');
      playerPickList.querySelectorAll('.pick-row').forEach(row => {
        row.onclick = () => {
          const p = adminUnsoldPlayers.find(x => String(x.id) === String(row.dataset.id));
          if (p) putOnBlock(p);
        };
      });
    }

    async function openPickModal() {
      playerPickSearch.value = '';
      playerPickList.innerHTML = '<div class="pick-empty">Loading players...</div>';
      playerPickModal.style.display = 'flex';
      await refreshPlayers();
      buildPlayerList('');
    }

    /* ── undo last action ── */
    async function undoLast() {
      try {
        SFX.undo();
        const r = await fetch('/api/undo', { method: 'POST' });
        const d = await r.json();
        if (d.success) {
          toast('Undid: ' + (d.player_name || 'last action'), 'ok');
          showIdle();
          poll();
          await loadAdminMeta();
        } else {
          toast(d.error || 'Nothing to undo', 'err');
        }
      } catch(e) {
        toast('Undo failed', 'err');
      }
    }

    /* ── sport / template selectors ── */
    // Only templates that actually exist for a sport are offered
    const TEMPLATE_LABELS = {
      arena: 'Arena Portrait', collector: 'Collector Card', circular: 'Circular Spotlight',
      broadcast: 'Broadcast Panel', poster: 'Photo Poster',
      'pb-focus': 'PB — Focus', 'pb-board': 'PB — Board', 'pb-spotlight': 'PB — Spotlight',
    };
    const SPORT_VALID_TEMPLATES = {
      cricket: ['arena','collector','circular','broadcast','poster'],
      pickleball: PB_TEMPLATES,
      football: ['arena','broadcast','poster'],
      badminton: ['arena','broadcast'],
      multi: ['arena','collector','broadcast']
    };
    const defaultTemplateFor = sport => (SPORT_VALID_TEMPLATES[sport] || ['arena'])[0];

    /* Rebuild the template dropdown for the selected sport. Previously every
       template was listed for every sport, so picking a cricket layout while on
       pickleball silently snapped back and looked like nothing happened. */
    function buildTemplateOptions(preferred) {
      if (!adminTemplateSel) return;
      const sport = adminSportSel ? adminSportSel.value : 'cricket';
      const valid = SPORT_VALID_TEMPLATES[sport] || ['arena'];
      const want = PB_ALIAS[preferred] || preferred;
      const chosen = valid.includes(want) ? want : defaultTemplateFor(sport);
      adminTemplateSel.innerHTML = valid
        .map(id => `<option value="${id}">${TEMPLATE_LABELS[id] || id}</option>`).join('');
      adminTemplateSel.value = chosen;
      return chosen;
    }

    function applyStageSettings() {
      const sport = adminSportSel ? adminSportSel.value : 'cricket';
      const tpl = buildTemplateOptions(adminTemplateSel ? adminTemplateSel.value : null);
      setSport(sport);
      setTemplate(tpl);
      fetch('/api/auction/state', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ auction_sport: sport, auction_template_mode: 'fixed', auction_template: tpl })
      });
    }
    // Switching sport rebuilds the list and lands on that sport's first template
    function onSportChange() {
      buildTemplateOptions(defaultTemplateFor(adminSportSel.value));
      applyStageSettings();
    }

    /* ── wire up all event handlers ── */

    // Player selection
    if (adminPickBtn)   adminPickBtn.onclick = openPickModal;
    if (adminRandomBtn) adminRandomBtn.onclick = () => randomDraw();
    if (modalRandomBtn) modalRandomBtn.onclick = () => randomDraw();
    if (playerPickClose) playerPickClose.onclick = () => { playerPickModal.style.display = 'none'; };
    if (playerPickSearch) playerPickSearch.addEventListener('input', () => buildPlayerList(playerPickSearch.value));

    // Sport/template
    if (adminSportSel)    adminSportSel.addEventListener('change', onSportChange);
    if (adminTemplateSel) adminTemplateSel.addEventListener('change', applyStageSettings);

    // Bid controls
    if (adminBidMinus10) adminBidMinus10.onclick = () => changeBid(-10);
    if (adminBidDec)     adminBidDec.onclick     = () => changeBid(-adminIncrement);
    if (adminBidInc)     adminBidInc.onclick     = () => changeBid(adminIncrement);
    if (adminBidPlus10)  adminBidPlus10.onclick  = () => changeBid(10);
    if (adminBidPlus25)  adminBidPlus25.onclick  = () => changeBid(25);

    // Arrow keys for bid
    document.addEventListener('keydown', e => {
      if (!adminPlayer) return;
      if (e.key === 'ArrowUp')   { e.preventDefault(); changeBid(adminIncrement); }
      if (e.key === 'ArrowDown') { e.preventDefault(); changeBid(-adminIncrement); }
    });

    // Undo
    if (adminUndoBtn)  adminUndoBtn.onclick  = undoLast;
    if (adminUndoBtn2) adminUndoBtn2.onclick = undoLast;

    // PASS
    if (adminPassBtn) adminPassBtn.onclick = async () => {
      if (!adminPlayer) return;
      if (!adminPlayer.id) { toast('Cannot pass — player ID unknown', 'err'); return; }
      try {
        const res = await fetch('/api/action/pass', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ player_id: adminPlayer.id })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        showIdle();
        poll();
        await loadAdminMeta();
        toast('Marked as UNSOLD', 'ok');
      } catch(e) {
        toast('Pass failed: ' + e.message, 'err');
      }
    };

    // SOLD
    if (adminSoldBtn) adminSoldBtn.onclick = async () => {
      if (!adminPlayer) return;
      const teamId = adminTeamSel.value;
      if (!teamId) { toast('Select a team first!', 'err'); return; }
      if (!adminPlayer.id) { toast('Cannot sell — player ID unknown', 'err'); return; }
      const team = adminTeams.find(t => String(t.id) === String(teamId));
      const soldName = adminPlayer.name, soldPrice = adminBid;

      /* Both guards are warnings the admin can override, as documented —
         the hammer has already fallen in the room, so the software should
         not refuse the sale outright. */
      if (team && team.remaining_budget < adminBid) {
        if (!confirm('WARNING: ' + team.name + ' has only ₹' + team.remaining_budget +
                     'L remaining, which is less than ₹' + adminBid + 'L.\n\nProceed anyway?')) return;
      }
      const q = team ? quotaFor(team) : null;
      if (q && q.atMax) {
        if (!confirm('WARNING: ' + team.name + ' has already reached the max limit of ' +
                     q.max + ' for ' + adminPlayer.category + '.\n\nProceed anyway?')) return;
      }

      try {
        const res = await fetch('/api/sell_player', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ player_id: adminPlayer.id, team_id: parseInt(teamId), sold_price: adminBid })
        });
        if (!res.ok) { const j = await res.json().catch(()=>({})); throw new Error(j.error || ('HTTP ' + res.status)); }
        SFX.sold();
        confetti();
        say('Sold! ' + soldName + ' goes to ' + (team ? team.name : 'team') +
            ' for ' + soldPrice + ' Lakhs!');
        showIdle();
        poll();
        await loadAdminMeta();
        toast('SOLD to ' + (team ? team.name : 'team') + '!', 'ok');
      } catch(e) {
        toast('Sell failed: ' + e.message, 'err');
      }
    };

    // Next Player
    if (adminNextBtn) adminNextBtn.onclick = async () => {
      showIdle();
      await fetch('/api/auction/state', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ current_player: '', current_bid: 0, category: '', base_price: 0, photo_url: '' })
      });
      poll();
      openPickModal();
    };

    /* ═══════════ SPIN WHEEL ═══════════
       Two modes, both documented:
         'player' — draw a player from the unsold pool with a checklist of who
                    is eligible, a 3.5s eased spin, then Confirm Selection.
         'team'   — for a player nobody bid on: spin the eligible franchises
                    and award the player at base price to whoever it lands on. */
    const WHEEL_COLORS = ['#f5b72e','#10b981','#3b82f6','#ef4444','#a855f7','#f97316','#22d3ee','#84cc16'];
    let spinMode = 'player';
    let spinItems = [];        // [{id, label, color}]
    let spinExcluded = new Set();
    let spinning = false;
    let spinWinner = null;
    let spinAngle = 0;

    const spinPool = () => spinItems.filter(it => !spinExcluded.has(String(it.id)));

    function paintWheel() {
      const pool = spinPool();
      if (!pool.length) {
        spinWheel.style.background = 'conic-gradient(#1e293b 0turn 1turn)';
        spinWheel.innerHTML = '<div class="spin-empty">NOTHING TO SPIN</div>';
        return;
      }
      const slice = 360 / pool.length;
      const stops = pool.map((it, i) =>
        `${it.color} ${i * slice}deg ${(i + 1) * slice}deg`).join(', ');
      spinWheel.style.background = `conic-gradient(${stops})`;
      // Labels only stay legible up to a point; past that the colours carry it
      spinWheel.innerHTML = pool.length <= 16 ? pool.map((it, i) => {
        const mid = i * slice + slice / 2;
        return `<span class="spin-label" style="transform:rotate(${mid}deg) translateY(-118px) rotate(${-mid}deg)">${esc(
          it.label.length > 13 ? it.label.slice(0, 12) + '…' : it.label)}</span>`;
      }).join('') : '';
    }

    function paintSpinList() {
      spinList.innerHTML = spinItems.map(it => {
        const on = !spinExcluded.has(String(it.id));
        return `<label class="spin-item"><input type="checkbox" data-id="${esc(it.id)}"${on ? ' checked' : ''} />` +
               `<i style="background:${it.color}"></i><span>${esc(it.label)}</span></label>`;
      }).join('') || '<div class="pick-empty">Nothing available</div>';
      spinList.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.onchange = () => {
          const id = String(cb.dataset.id);
          if (cb.checked) spinExcluded.delete(id); else spinExcluded.add(id);
          paintWheel();
        };
      });
    }

    async function openSpin(mode) {
      spinMode = mode;
      spinning = false; spinWinner = null; spinAngle = 0;
      spinExcluded = new Set();
      spinWheel.style.transition = 'none';
      spinWheel.style.transform = 'rotate(0deg)';
      spinResult.innerHTML = '&nbsp;';
      spinGo.style.display = '';
      spinConfirm.style.display = 'none';

      if (mode === 'player') {
        spinTitle.textContent = 'DRAW PLAYER';
        spinSideTitle.textContent = 'INCLUDE IN DRAW';
        await refreshPlayers();
        spinItems = adminUnsoldPlayers.map((p, i) => ({
          id: p.id, label: p.name, color: WHEEL_COLORS[i % WHEEL_COLORS.length], raw: p
        }));
      } else {
        spinTitle.textContent = 'PICK TEAM';
        spinSideTitle.textContent = 'ELIGIBLE FRANCHISES';
        // Only teams that can actually afford this player's base price
        const base = (adminPlayer && adminPlayer.base_price) || 0;
        spinItems = adminTeams.map((t, i) => ({
          id: t.id, label: t.name, color: t.color || WHEEL_COLORS[i % WHEEL_COLORS.length], raw: t
        }));
        adminTeams.forEach(t => {
          if (t.remaining_budget < base) spinExcluded.add(String(t.id));
        });
      }
      spinAll.checked = spinExcluded.size === 0;
      paintSpinList();
      paintWheel();
      spinModal.style.display = 'flex';
    }

    function doSpin() {
      const pool = spinPool();
      if (spinning || !pool.length) {
        if (!pool.length) toast('Nothing available to spin', 'err');
        return;
      }
      spinning = true;
      spinGo.disabled = true;
      spinConfirm.style.display = 'none';
      spinResult.innerHTML = '&nbsp;';
      SFX.draw();

      const idx = Math.floor(Math.random() * pool.length);
      spinWinner = pool[idx];
      const slice = 360 / pool.length;
      // Land the winner's slice centre under the pointer at the top
      const target = 360 * 6 + (360 - (idx * slice + slice / 2));
      spinAngle = target;
      spinWheel.style.transition = 'transform 3.5s cubic-bezier(.15,.9,.2,1)';
      spinWheel.style.transform = `rotate(${target}deg)`;

      setTimeout(() => {
        spinning = false;
        spinGo.disabled = false;
        spinWheel.classList.add('spin-hit');
        setTimeout(() => spinWheel.classList.remove('spin-hit'), 900);
        spinResult.textContent = spinWinner.label;
        spinConfirm.style.display = '';
        spinConfirm.textContent = spinMode === 'player'
          ? 'Confirm Selection'
          : 'Award at ₹' + ((adminPlayer && adminPlayer.base_price) || 0) + 'L';
      }, 3550);
    }

    async function confirmSpin() {
      if (!spinWinner) return;
      if (spinMode === 'player') {
        spinModal.style.display = 'none';
        await putOnBlock(spinWinner.raw);
      } else {
        // Award the current player to the drawn team at base price
        const team = spinWinner.raw;
        const price = (adminPlayer && adminPlayer.base_price) || 0;
        const name = adminPlayer && adminPlayer.name;
        if (!adminPlayer || !adminPlayer.id) { toast('No player on the block', 'err'); return; }
        try {
          const res = await fetch('/api/sell_player', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ player_id: adminPlayer.id, team_id: parseInt(team.id), sold_price: price })
          });
          if (!res.ok) { const j = await res.json().catch(()=>({})); throw new Error(j.error || ('HTTP ' + res.status)); }
          spinModal.style.display = 'none';
          SFX.sold();
          confetti();
          say('Sold! ' + name + ' goes to ' + team.name + ' for ' + price + ' Lakhs!');
          showIdle();
          poll();
          await loadAdminMeta();
          toast('Awarded to ' + team.name, 'ok');
        } catch(e) {
          toast('Award failed: ' + e.message, 'err');
        }
      }
    }

    if (spinGo)      spinGo.onclick = doSpin;
    if (spinConfirm) spinConfirm.onclick = confirmSpin;
    if (spinClose)   spinClose.onclick = () => { spinModal.style.display = 'none'; };
    if (spinAll) spinAll.onchange = () => {
      spinExcluded = spinAll.checked ? new Set() : new Set(spinItems.map(i => String(i.id)));
      paintSpinList(); paintWheel();
    };
    if (adminSpinBtn)    adminSpinBtn.onclick    = () => openSpin('player');
    if (adminUnsoldSpin) adminUnsoldSpin.onclick = () => {
      if (!adminPlayer) { toast('No player on the block', 'err'); return; }
      openSpin('team');
    };

    /* ── initial load + periodic refresh ── */
    loadAdminMeta();
    setInterval(loadAdminMeta, 4000);
  }
})();
