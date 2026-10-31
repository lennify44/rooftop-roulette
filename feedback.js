// Feedback for every Lennify game: adds a "Feedback" button next to the "All games" link and on the end screen
// (a floating one where neither exists) and sends a rating plus a short text to the leaderboard Worker.
// Added to every page by build-site.py; works only on the public site (the Worker accepts only that origin).
(() => {
  'use strict';
  const URL_FB = 'https://rooftop-leaderboard.rooftop-b71afd.workers.dev/feedback';
  const PUBLIC = location.hostname === 'lennify44.github.io';
  const parts = location.pathname.split('/').filter(Boolean);
  const game = (parts[1] || 'rooftop-roulette').replace(/[^a-z0-9-]/g, '').slice(0, 30) || 'rooftop-roulette';
  const de = /lang=de/.test(location.search) || /^de\b/i.test(navigator.language || '');
  const T = de ? {
    btn: '💬 Feedback', title: 'Wie findest du', sub: 'Ehrlich sein hilft. Was nervt, was fehlt, was macht Spaß?',
    rates: ['Langweilig', 'Naja', 'Okay', 'Gut', 'Mega'], ph: 'Was soll besser werden? (keine Namen oder Daten)',
    send: 'Senden', cancel: 'Schließen', thanks: 'Danke! Das landet direkt beim Entwickler.', pick: 'Erst eine Bewertung antippen.',
    fail: 'Hat nicht geklappt, versuch es gleich nochmal.', slow: 'Kurz warten, dann nochmal senden.', offline: 'Feedback geht nur auf der öffentlichen Seite:',
  } : {
    btn: '💬 Feedback', title: 'How is', sub: 'Be honest. What is boring, what is missing, what is fun?',
    rates: ['Boring', 'Meh', 'OK', 'Good', 'Awesome'], ph: 'What should be better? (no names or personal info)',
    send: 'Send', cancel: 'Close', thanks: 'Thanks! This goes straight to the developer.', pick: 'Tap a rating first.',
    fail: 'That did not work, try again in a moment.', slow: 'Wait a few seconds, then send again.', offline: 'Feedback only works on the public site:',
  };
  const FACES = ['😴', '😐', '🙂', '😀', '🔥'];
  const name = (document.title || game).replace(/\s*[·|–-].*$/, '').trim();

  function best() {
    // a hint of how far the player got, read from the game's own profile (never personal data)
    try {
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith(game) && !(game === 'rooftop-roulette' && k === 'rooftop-roulette-best')) continue;
        const v = JSON.parse(localStorage.getItem(k) || 'null');
        if (v && typeof v === 'object') { const b = v.best !== undefined ? v.best : v.score; if (typeof b === 'number') return String(b); if (b && typeof b === 'object') return JSON.stringify(b).slice(0, 40); }
      }
    } catch (e) { /* storage blocked */ }
    return '';
  }

  let host = null;
  function open() {
    if (host) return;
    host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      .bg{position:absolute;inset:0;background:rgba(10,8,20,.72);display:grid;place-items:center;padding:16px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      .card{width:min(420px,100%);background:#fff;color:#1a1420;border-radius:16px;padding:18px 18px 14px;box-shadow:0 18px 50px rgba(0,0,0,.5)}
      h2{margin:0 0 4px;font-size:22px;line-height:1.15}
      p{margin:0 0 12px;font-size:14px;color:#5a5260}
      .rates{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:12px}
      .rates button{min-height:64px;border:2px solid #e3dde8;border-radius:12px;background:#f7f4fa;cursor:pointer;font-size:26px;display:grid;place-items:center;gap:2px;padding:4px 0;color:#1a1420}
      .rates button span{font-size:11px;font-weight:600}
      .rates button[aria-pressed="true"]{border-color:#ff7a2f;background:#fff1e6}
      textarea{width:100%;box-sizing:border-box;min-height:84px;border:2px solid #e3dde8;border-radius:12px;padding:10px;font:16px system-ui,sans-serif;resize:vertical}
      .row{display:flex;gap:10px;justify-content:flex-end;align-items:center;margin-top:12px;flex-wrap:wrap}
      .row button{min-height:44px;padding:0 18px;border-radius:22px;border:0;font-weight:700;font-size:16px;cursor:pointer}
      .send{background:#ff7a2f;color:#fff}.cancel{background:#eee;color:#1a1420}
      .msg{flex:1;font-size:13px;color:#5a5260;min-width:140px}
      a{color:#ff7a2f}
      button:focus-visible,textarea:focus-visible{outline:3px solid #ff7a2f;outline-offset:2px}
    </style>
    <div class="bg"><div class="card" role="dialog" aria-modal="true" aria-label="Feedback">
      <h2></h2><p></p><div class="rates"></div>
      <textarea maxlength="500"></textarea>
      <div class="row"><span class="msg" aria-live="polite"></span><button class="cancel" type="button"></button><button class="send" type="button"></button></div>
    </div></div>`;
    const $ = (s) => root.querySelector(s);
    $('h2').textContent = `${T.title} ${name}?`; $('p').textContent = T.sub;
    $('textarea').placeholder = T.ph; $('.send').textContent = T.send; $('.cancel').textContent = T.cancel;
    let rating = 0;
    FACES.forEach((f, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('data-rate', String(i + 1));
      b.innerHTML = `${f}<span></span>`; b.querySelector('span').textContent = T.rates[i];
      b.addEventListener('click', () => { rating = i + 1; root.querySelectorAll('.rates button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
      $('.rates').appendChild(b);
    });
    if (!PUBLIC) { const m = $('.msg'); m.textContent = T.offline + ' '; const a = document.createElement('a'); a.href = 'https://lennify44.github.io/rooftop-roulette/'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'lennify44.github.io'; m.appendChild(a); $('.send').disabled = true; }
    const close = () => { host.remove(); host = null; };
    $('.cancel').addEventListener('click', close);
    $('.bg').addEventListener('click', (e) => { if (e.target === $('.bg')) close(); });
    let busy = false;
    $('.send').addEventListener('click', async () => {
      const msg = $('.msg');
      if (!rating) { msg.textContent = T.pick; return; }
      if (busy) return; busy = true; msg.textContent = '…';
      try {
        const r = await fetch(URL_FB, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game, rating, text: $('textarea').value.trim().slice(0, 500), best: best(), lang: de ? 'de' : 'en' }) });
        if (r.ok) { msg.textContent = T.thanks; $('.send').disabled = true; setTimeout(close, 1600); }
        else msg.textContent = r.status === 429 ? T.slow : T.fail;
      } catch (e) { msg.textContent = T.fail; }
      busy = false;
    });
    // keep typing and taps inside the dialog away from the game's own controls
    for (const ev of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'touchstart']) host.addEventListener(ev, (e) => e.stopPropagation());
    host.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.body.appendChild(host);
    setTimeout(() => { const b = root.querySelector('.rates button'); if (b) b.focus(); }, 30);
  }

  function makeButton(likeEl) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = T.btn; b.setAttribute('data-feedback-btn', '');
    if (likeEl && likeEl.className) b.className = likeEl.className;
    else b.style.cssText = 'min-height:44px;border:0;background:none;padding:10px 0;cursor:pointer;color:inherit;font:inherit;font-weight:600;text-decoration:underline;text-underline-offset:4px';
    b.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    return b;
  }
  function init() {
    let placed = 0;
    document.querySelectorAll('a[data-hub]').forEach((a) => { a.insertAdjacentElement('afterend', makeButton(a)); placed++; });
    for (const id of ['screenOver', 'screenDone', 'screenEnd']) {
      const s = document.getElementById(id); if (!s) continue;
      const row = s.querySelector('.cta-row'); if (!row) continue;
      const like = row.querySelector('.link-btn') || row.querySelector('button:not(.btn)');
      row.appendChild(makeButton(like)); placed++;
    }
    document.querySelectorAll('[data-feedback]').forEach((el) => { el.addEventListener('click', open); placed++; });
    if (!placed) {
      const b = makeButton(null);
      b.style.cssText = 'position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));z-index:2147482000;min-height:44px;padding:0 16px;border:0;border-radius:22px;background:#ff7a2f;color:#fff;font:700 15px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer';
      document.body.appendChild(b);
    }
  }
  window.lennifyFeedback = { open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
