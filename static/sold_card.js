/* A sold player's share card, drawn on a canvas: the event, the player's
   photo, a SOLD stamp, the buying team and the price, in the team's colour.
   'post' is 1080×1350 (Instagram, WhatsApp), 'story' 1080×1920.

   SoldCard.draw(canvas, card, format) → Promise, card being /api/card/<id>. */
window.SoldCard = (function () {
  const W = 1080;
  const PAD = 70;
  const GOLD = '#ffd166';

  function rgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const n = m ? parseInt(m[1], 16) : 0xf5b72e;
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  const css = (c, a) => 'rgba(' + c.join(',') + ',' + (a == null ? 1 : a) + ')';
  const scale = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));

  // Images from this server draw cleanly; one from elsewhere without CORS
  // would make the canvas unexportable, so it is left out.
  function load(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      if (!src.startsWith('/') && !src.startsWith(location.origin)) img.crossOrigin = 'anonymous';
      const done = ok => { clearTimeout(timer); resolve(ok ? img : null); };
      const timer = setTimeout(() => done(false), 8000);
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = src;
    });
  }

  function roundRect(x, l, t, w, h, r) {
    x.beginPath();
    x.moveTo(l + r, t);
    x.arcTo(l + w, t, l + w, t + h, r);
    x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r);
    x.arcTo(l, t, l + w, t, r);
    x.closePath();
  }
  // The image covering the box, cropped from its centre (faces sit a little
  // above the middle of most portraits, so the crop leans upward).
  function cover(x, img, l, t, w, h) {
    const s = Math.max(w / img.width, h / img.height);
    const sw = w / s, sh = h / s;
    const sx = (img.width - sw) / 2;
    const sy = Math.max(0, (img.height - sh) * 0.3);
    x.drawImage(img, sx, sy, sw, sh, l, t, w, h);
  }
  function contain(x, img, l, t, w, h) {
    const s = Math.min(w / img.width, h / img.height);
    x.drawImage(img, l + (w - img.width * s) / 2, t + (h - img.height * s) / 2, img.width * s, img.height * s);
  }
  // The largest size, up to max, at which the text fits the width.
  function fit(x, text, weight, family, max, min, width) {
    let size = max;
    do {
      x.font = weight + ' ' + size + 'px ' + family;
      if (x.measureText(text).width <= width) break;
      size -= 4;
    } while (size > min);
    return size;
  }
  const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  async function draw(canvas, card, format) {
    const story = format === 'story';
    const H = story ? 1920 : 1350;
    // A story keeps clear of the bars Instagram and WhatsApp draw over its
    // top and bottom, so everything sits lower.
    const off = story ? 140 : 0;
    canvas.width = W;
    canvas.height = H;
    const x = canvas.getContext('2d');
    const p = card.player, ev = card.event || {};
    const team = rgb(p.team_color);
    const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
    const BODY = 'Inter, Arial, sans-serif';
    await Promise.all([document.fonts.load('900 100px "Barlow Condensed"'), document.fonts.load('800 40px "Barlow Condensed"'),
                       document.fonts.load('700 30px Inter')]).catch(() => {});
    const [photo, teamLogo, eventLogo] = await Promise.all([load(p.photo_url), load(p.team_logo), load(ev.org_logo)]);

    // Background: the team's colour, deepening to near black.
    const bg = x.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, css(scale(team, 0.62)));
    bg.addColorStop(0.55, css(scale(team, 0.22)));
    bg.addColorStop(1, '#05070d');
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);
    // Light streaks across it.
    x.save();
    x.globalCompositeOperation = 'lighter';
    [[-200, 0.06], [180, 0.04], [560, 0.05]].forEach(([at, a]) => {
      const g = x.createLinearGradient(at, 0, at + 520, H);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,' + a + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(at, 0); x.lineTo(at + 160, 0); x.lineTo(at + 680, H); x.lineTo(at + 520, H);
      x.closePath(); x.fill();
    });
    x.restore();

    // Header: the event.
    let left = PAD;
    if (eventLogo) {
      x.save(); roundRect(x, PAD, off + 64, 92, 92, 20); x.fillStyle = 'rgba(255,255,255,0.1)'; x.fill(); x.clip();
      contain(x, eventLogo, PAD + 8, off + 72, 76, 76); x.restore();
      left = PAD + 116;
    }
    x.fillStyle = '#fff';
    x.textBaseline = 'alphabetic';
    fit(x, (ev.event_name || 'Player Auction').toUpperCase(), '800', DISPLAY, 50, 26, W - PAD - left);
    x.fillText((ev.event_name || 'Player Auction').toUpperCase(), left, off + 112);
    x.font = '700 22px ' + BODY;
    x.fillStyle = 'rgba(255,255,255,0.62)';
    x.fillText((ev.organisation_name ? ev.organisation_name.toUpperCase() + '  ·  ' : '') + 'PLAYER AUCTION', left, off + 148);

    // The photo.
    const top = off + 196, photoH = story ? 1000 : 720, photoW = W - PAD * 2;
    x.save();
    roundRect(x, PAD, top, photoW, photoH, 40);
    x.clip();
    if (photo) {
      cover(x, photo, PAD, top, photoW, photoH);
    } else {
      const g = x.createLinearGradient(0, top, 0, top + photoH);
      g.addColorStop(0, css(scale(team, 0.9)));
      g.addColorStop(1, css(scale(team, 0.35)));
      x.fillStyle = g;
      x.fillRect(PAD, top, photoW, photoH);
      x.fillStyle = 'rgba(255,255,255,0.85)';
      x.font = '900 300px ' + DISPLAY;
      x.textAlign = 'center';
      x.fillText(initials(p.name), W / 2, top + photoH / 2 + 105);
      x.textAlign = 'left';
    }
    const shade = x.createLinearGradient(0, top + photoH * 0.55, 0, top + photoH);
    shade.addColorStop(0, 'rgba(5,7,13,0)');
    shade.addColorStop(1, 'rgba(5,7,13,0.85)');
    x.fillStyle = shade;
    x.fillRect(PAD, top, photoW, photoH);
    x.restore();
    x.lineWidth = 8;
    x.strokeStyle = css(team);
    roundRect(x, PAD, top, photoW, photoH, 40);
    x.stroke();

    // SOLD, stamped across the top corner of the photo.
    x.save();
    x.translate(W - PAD - 190, top + 120);
    x.rotate(-0.12);
    roundRect(x, -170, -78, 340, 156, 24);
    x.fillStyle = '#fff';
    x.shadowColor = 'rgba(0,0,0,0.35)';
    x.shadowBlur = 30;
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = css(scale(team, 0.75));
    x.font = '900 128px ' + DISPLAY;
    x.textAlign = 'center';
    x.fillText('SOLD', 0, 46);
    x.restore();

    // The player, over the bottom of the photo.
    const nameY = top + photoH - 112;
    x.fillStyle = '#fff';
    const nameSize = fit(x, p.name.toUpperCase(), '900', DISPLAY, 116, 56, photoW - 80);
    x.fillText(p.name.toUpperCase(), PAD + 40, nameY + nameSize * 0.35);
    const facts = [p.category, p.team_role].filter(Boolean);
    let chosen = [];
    try { chosen = JSON.parse(ev.display_fields || '[]'); } catch (e) { /* none chosen */ }
    (window.playerDetails ? window.playerDetails(p.attributes || {}, chosen, 2, p.category) : [])
      .forEach(d => facts.push(/^\d+(\.\d+)?$/.test(d.value) ? d.label + ' ' + d.value : d.value));   // "AGE 27", not "27"
    x.font = '700 30px ' + BODY;
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.fillText(facts.join('   ·   ').toUpperCase(), PAD + 42, nameY + nameSize * 0.35 + 54);

    // The team and the price.
    const panelT = top + photoH + 40, panelH = story ? 300 : 250;
    roundRect(x, PAD, panelT, photoW, panelH, 34);
    x.fillStyle = 'rgba(5,7,13,0.55)';
    x.fill();
    x.lineWidth = 2;
    x.strokeStyle = 'rgba(255,255,255,0.12)';
    x.stroke();
    let teamLeft = PAD + 44;
    const logoSize = panelH - 80;
    if (teamLogo) {
      contain(x, teamLogo, teamLeft, panelT + 40, logoSize, logoSize);
      teamLeft += logoSize + 34;
    }
    const priceText = window.fmtL ? window.fmtL(p.sold_price) : '₹' + p.sold_price + 'L';
    x.font = '900 ' + (story ? 150 : 132) + 'px ' + DISPLAY;
    const priceW = x.measureText(priceText).width;
    x.textAlign = 'right';
    x.fillStyle = GOLD;
    x.fillText(priceText, W - PAD - 44, panelT + panelH / 2 + (story ? 52 : 46));
    x.textAlign = 'left';
    x.font = '800 24px ' + BODY;
    x.fillStyle = 'rgba(255,255,255,0.6)';
    x.fillText('SOLD TO', teamLeft, panelT + panelH / 2 - 26);
    x.fillStyle = '#fff';
    const teamSize = fit(x, (p.team_name || '').toUpperCase(), '800', DISPLAY, 70, 34,
                         W - PAD - 44 - priceW - 40 - teamLeft);
    x.fillText((p.team_name || '').toUpperCase(), teamLeft, panelT + panelH / 2 + teamSize * 0.55);

    // Footer.
    x.font = '700 22px ' + BODY;
    x.fillStyle = 'rgba(255,255,255,0.45)';
    x.textAlign = 'center';
    const credit = ev.sponsor_name ? 'Sponsored by ' + ev.sponsor_name + '   ·   ' : '';
    x.fillText(credit + 'Auction Pro Suite', W / 2, H - 52 - (story ? 110 : 0));
    x.textAlign = 'left';
  }

  return { draw };
})();
