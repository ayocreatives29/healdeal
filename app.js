'use strict';
/* HealDeal: a private place to pray, remember lessons and heal.
   Everything personal lives on this phone (localStorage). The lessons arrive
   encrypted in content.enc.json and are unlocked once with the passcode. */

const STORE = 'healdeal.v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayIndex = () => Math.floor(new Date(dkey() + 'T12:00:00').getTime() / 864e5);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(iso).toLocaleDateString('en-GB', opts);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const ICON = {
  chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5l2.5 2M9.5 3h5"/></svg>',
};

/* ---------------- State ---------------- */
function loadState() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
const S = loadState();
const DEFAULTS = {
  journal: [], prayerLog: {}, prayedDays: [], translations: {}, trView: {}, ticks: {}, lessonEdits: {}, userLessons: [],
  checklist: {}, drafts: {}, steps: [], relisten: '', lessonsTab: 'lessons', lockOnOpen: false,
  prayerEdits: {}, userPrayers: [],
  reminders: { morning: { on: true, time: '07:00' }, evening: { on: true, time: '21:00' } },
};
for (const [k, v] of Object.entries(DEFAULTS)) if (S[k] === undefined) S[k] = structuredClone(v);
let saveTimer, wiped = false;
function save() {
  clearTimeout(saveTimer);
  if (wiped) return;
  try { localStorage.setItem(STORE, JSON.stringify(S)); }
  catch { toast('HealDeal couldn’t save. Free up some space on your phone, then try again.'); }
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }

let C = S.content || null;   // unlocked content
let ENC = null;              // latest encrypted bundle from the server
let unlocked = false;
let timers = [];
const clearTimers = () => { timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); timers = []; };

/* ---------------- Crypto ---------------- */
const ub64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function decrypt(enc, pass) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: ub64(enc.salt), iterations: enc.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(enc.iv) }, key, ub64(enc.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

/* ---------------- Sky (time of day) ---------------- */
// Keyframes by hour: top, middle, horizon, water top, water bottom, lamp colour, ink.
const SKY = [
  [0,    '#050E15', '#0B1E2A', '#14303D', '#0E2531', '#06121A', '#DCE6E8', '#fff'],
  [4.5,  '#08121F', '#152338', '#2B3550', '#1A2A3C', '#0A1622', '#DCE6E8', '#fff'],
  [6,    '#1C2444', '#6B5A7C', '#EBA874', '#5B5A6E', '#1E2A3A', '#FFD28A', '#fff'],
  [8,    '#6FA4C2', '#B7D3DC', '#F2E6CF', '#7FA7AE', '#3F6E72', '#FFEFC2', '#132A2B'],
  [12,   '#5F9DBD', '#A6CDDA', '#E3EEEA', '#78A9AE', '#3A6D70', '#FFF7DC', '#132A2B'],
  [16.5, '#5F92B5', '#B4CCD2', '#EEDFC4', '#7A9FA4', '#3B6468', '#FFE2A8', '#132A2B'],
  [18.5, '#2A2E55', '#A1617A', '#F1A565', '#6A5466', '#24283E', '#FFBE78', '#fff'],
  [20.5, '#0C1832', '#1E2D4C', '#3A4A66', '#1D2C42', '#0B1626', '#E3E8F0', '#fff'],
  [24,   '#050E15', '#0B1E2A', '#14303D', '#0E2531', '#06121A', '#DCE6E8', '#fff'],
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
function paintSky(el, d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  let i = SKY.findIndex((k) => k[0] > h) - 1; if (i < 0) i = 0;
  const a = SKY[i], b = SKY[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  const names = ['--sky-a', '--sky-b', '--sky-c', '--water-a', '--water-b', '--lamp-c'];
  names.forEach((n, j) => el.style.setProperty(n, mix(a[j + 1], b[j + 1], t)));
  el.style.setProperty('--sky-ink', t < .5 ? a[7] : b[7]);
  // Sun from 6:00 to 20:00, moon through the night; both arc over the water.
  const day = h >= 6 && h < 20;
  const p = day ? (h - 6) / 14 : ((h - 20 + 24) % 24) / 10;
  el.style.setProperty('--lamp-x', `${12 + 76 * p}%`);
  el.style.setProperty('--lamp-y', `${64 - Math.sin(Math.PI * p) * 14}%`);
  el.style.setProperty('--glint', day ? .75 : .45);
}
function greeting(d = new Date()) {
  const h = d.getHours();
  const part = h < 5 ? 'Peace to you tonight' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Peace to you tonight';
  return C?.owner ? `${part}, ${C.owner}` : part;
}

/* ---------------- Helpers ---------------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
function verse(key) { return C.verses?.[key]; }
function verseCard(key) {
  const v = verse(key); if (!v) return '';
  return `<div class="verse-card"><p>${esc(v.text)}</p><p class="ref">${esc(v.ref)}</p></div>`;
}
function catName(id) { return C.categories.find((c) => c.id === id)?.name || 'My lessons'; }
function lessonsAll() {
  const base = C.lessons.map((l) => ({ ...l, ...(S.lessonEdits[l.id] || {}), edited: !!S.lessonEdits[l.id] }));
  return [...base, ...S.userLessons.map((l) => ({ ...l, mine: true }))];
}
function prayersAll() {
  const base = (C.prayers || []).map((p) => {
    const ref = p.verses.map((x) => x.ref).join(' · ');
    return { ...p, ref, origRef: ref, ...(S.prayerEdits[p.id] || {}), edited: !!S.prayerEdits[p.id] };
  });
  return [...base, ...S.userPrayers.map((p) => ({ ...p, verses: [], mine: true }))];
}
function todayTicks() {
  if (S.ticks.date !== dkey()) S.ticks = { date: dkey(), done: {} };
  return S.ticks.done;
}
function prayerHtml(p, ticked) {
  const refLink = (r) => `<a href="${bgUrl(r)}" target="_blank" rel="noopener">${esc(r)}</a>`;
  const showVerses = p.verses.length && p.ref === p.origRef;
  return `<article class="prayer" data-id="${esc(p.id)}">
    <p class="prayer-ref">${showVerses ? p.verses.map((x) => refLink(x.ref)).join(' · ') : esc(p.ref || 'My prayer')}${p.edited ? '<span class="tag">Edited</span>' : ''}</p>
    ${showVerses ? p.verses.map((x) => `<p class="prayer-verse">${esc(x.text)}${p.verses.length > 1 ? ` <span class="ref">${esc(x.ref)}</span>` : ''}</p>`).join('') : ''}
    <p class="prayer-text">${esc(p.text)}</p>
    <div class="prayer-foot"><button class="pray-tick" aria-pressed="${ticked}"><span class="ring">${ICON.tick}</span>${ticked ? 'Prayed' : 'Tick when prayed'}</button>
      <button class="pray-timer" aria-pressed="false" aria-label="Pray for 10 minutes">${ICON.clock}<span>10 min</span></button>
      <span class="lesson-actions"><button data-act="edit">Edit</button>${p.edited ? '<button data-act="restore">Restore</button>' : ''}${p.mine ? '<button data-act="delete" class="danger">Delete</button>' : ''}</span></div>
  </article>`;
}
function prayerForm(p) {
  return `<div class="card prayer-form">
    <label class="field"><span>Scripture</span><input type="text" class="f-ref" value="${esc(p?.ref || '')}" placeholder="For example, Isaiah 43:19"></label>
    <label class="field"><span>Prayer</span><textarea class="f-text" placeholder="Father in the name of Jesus…">${esc(p?.text || '')}</textarea></label>
    <div class="btn-row"><button class="btn primary f-save">Save prayer</button><button class="btn f-cancel">Cancel</button></div></div>`;
}
/* Prayer timer: one at a time, kept as an end time so it stays right if the phone sleeps. */
const PRAY_MS = 10 * 60e3;
let audioCtx, wake;
function chime() {
  try {
    const t = audioCtx.currentTime;
    [523.25, 783.99, 1046.5].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), at = t + i * .45;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.22, at + .02); g.gain.exponentialRampToValueAtTime(.001, at + 2.4);
      o.connect(g).connect(audioCtx.destination); o.start(at); o.stop(at + 2.5);
    });
  } catch {}
}
async function keepAwake(on) {
  try { if (on) wake = await navigator.wakeLock?.request('screen'); else { await wake?.release(); wake = null; } } catch {}
}
const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
function paintPrayers() {
  const t = S.prayTimer, done = new Set(todayTicks().prayers || []);
  $$('.prayer').forEach((card) => {
    const id = card.dataset.id, on = t?.id === id, left = on ? t.end - Date.now() : PRAY_MS;
    card.classList.toggle('timing', on);
    card.style.setProperty('--p', `${on ? (1 - left / PRAY_MS) * 100 : 0}%`);
    const b = $('.pray-timer', card);
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? `Stop the timer, ${fmtLeft(left)} left` : 'Pray for 10 minutes');
    $('span', b).textContent = on ? fmtLeft(left) : '10 min';
    const tk = $('.pray-tick', card), ticked = done.has(id);
    tk.setAttribute('aria-pressed', ticked); tk.lastChild.textContent = ticked ? 'Prayed' : 'Tick when prayed';
  });
}
function checkPrayTimer() {
  const t = S.prayTimer; if (!t) return;
  if (Date.now() < t.end) { paintPrayers(); return; }
  const done = todayTicks(); done.prayers = [...new Set([...(done.prayers || []), t.id])];
  S.prayTimer = null; save(); keepAwake(false);
  if (!document.hidden) chime();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  toast('10 minutes of prayer done. Amen.');
  paintPrayers();
}
setInterval(checkPrayTimer, 1000);
function bindPrayers(root) {
  const done = todayTicks();
  $$('.pray-timer', root).forEach((b) => b.onclick = () => {
    const id = b.closest('.prayer').dataset.id;
    if (S.prayTimer?.id === id) { S.prayTimer = null; keepAwake(false); }
    else {
      S.prayTimer = { id, end: Date.now() + PRAY_MS }; keepAwake(true);
      // Start the sound system on this tap, so the chime is allowed to play later.
      try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch {}
    }
    save(); paintPrayers();
  });
  paintPrayers();
  $$('.prayer', root).forEach((card) => {
    const id = card.dataset.id, p = prayersAll().find((x) => x.id === id);
    $('.pray-tick', card).onclick = (e) => {
      const set = new Set(done.prayers || []);
      set.has(id) ? set.delete(id) : set.add(id);
      done.prayers = [...set]; saveSoon();
      const on = set.has(id), b = e.currentTarget;
      b.setAttribute('aria-pressed', on); b.lastChild.textContent = on ? 'Prayed' : 'Tick when prayed';
    };
    $$('.lesson-actions button', card).forEach((b) => b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'edit') {
        card.outerHTML = `<div data-edit="${esc(id)}">${prayerForm(p)}</div>`;
        const box = $(`[data-edit="${CSS.escape(id)}"]`, root);
        bindPrayerForm(box, p); $('.f-text', box).focus();
      }
      if (act === 'restore') { delete S.prayerEdits[id]; save(); route(); toast('Original prayer restored'); }
      if (act === 'delete' && confirm('Delete this prayer? This can’t be undone.')) { S.userPrayers = S.userPrayers.filter((x) => x.id !== id); save(); route(); }
    });
  });
}
function bindPrayerForm(box, p) {
  $('.f-cancel', box).onclick = () => route();
  $('.f-save', box).onclick = () => {
    const ref = $('.f-ref', box).value.trim(), text = $('.f-text', box).value.trim();
    if (!text) { toast('Write the prayer first, then save.'); return; }
    if (!p) S.userPrayers.push({ id: 'u-' + uid(), ref, text });
    else if (p.mine) Object.assign(S.userPrayers.find((x) => x.id === p.id), { ref, text });
    else S.prayerEdits[p.id] = { ref, text };
    save(); route(); toast('Prayer saved');
  };
}
function paras(arr) { return (arr || []).map((p) => `<p>${esc(p)}</p>`).join(''); }
function splitParas(text) { return text.split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean); }
function bgUrl(ref) { return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref.replace('–', '-'))}&version=ESV;NIV;NASB`; }
function addJournal(entry) { S.journal.unshift({ id: uid(), date: new Date().toISOString(), ...entry }); }
function pageTop(title, { back, lede, right = '' } = {}) {
  return `<header class="top"><div class="top-row">${back ? `<a class="back" href="${back}">${ICON.back}Back</a>` : '<span></span>'}${right}</div>
    ${title ? `<h1 class="title">${esc(title)}</h1>` : ''}${lede ? `<p class="lede">${lede}</p>` : ''}</header>`;
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------- Boot & unlock ---------------- */
async function boot() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  try { const r = await fetch('content.enc.json', { cache: 'no-cache' }); if (r.ok) ENC = await r.json(); } catch {}
  if (!C) return ENC ? renderGate('first') : renderOffline();
  if (S.lockOnOpen && !unlocked) return renderGate('lock');
  startApp();
}

function renderOffline() {
  const v = $('#view');
  v.innerHTML = `<div class="gate" id="gate"><div class="sky-lamp"></div><div class="gate-inner">
    <h1>HealDeal</h1><p>Connect to the internet once so HealDeal can unlock your lessons. After that it works offline.</p>
    <button class="btn lamp block" id="retry">Try again</button></div></div>`;
  paintSky($('#gate'));
  $('#retry').onclick = () => location.reload();
}

function renderGate(mode) {
  $('#tabbar').hidden = true; document.body.classList.add('focus');
  const v = $('#view');
  const copy = {
    first: 'Enter your passcode to unlock your lessons on this phone. You only need to do this once.',
    lock: 'Enter your passcode to open HealDeal.',
    update: 'Your lessons have been updated. Enter your passcode to unlock the new version.',
  }[mode];
  const showTip = mode === 'first' && navigator.standalone === false;
  v.innerHTML = `<div class="gate" id="gate"><div class="sky-lamp"></div><div class="gate-inner">
    <h1>HealDeal</h1><p>${copy}</p>
    ${showTip ? `<p class="tip"><strong>Add HealDeal to your Home Screen first.</strong> Tap the Share button in Safari, then <em>Add to Home Screen</em>. Open it from there and unlock it, so your lessons are saved in the app.</p>` : ''}
    <form id="unlock" autocomplete="off">
      <input type="password" id="pass" placeholder="Passcode" aria-label="Passcode" autocomplete="current-password" enterkeyhint="go" required>
      <button class="btn lamp block" id="go">Unlock</button>
      <p class="err" id="err" hidden></p>
    </form>
    ${mode === 'update' ? '<button class="btn ghost" id="later">Not now</button>' : ''}
  </div></div>`;
  paintSky($('#gate'));
  $('#pass').focus();
  if (mode === 'update') $('#later').onclick = () => { unlocked = true; startApp(); };
  $('#unlock').onsubmit = async (e) => {
    e.preventDefault();
    const go = $('#go'), err = $('#err');
    go.disabled = true; go.textContent = 'Unlocking…'; err.hidden = true;
    const enc = mode === 'lock' ? (S.enc || ENC) : ENC;
    try {
      const content = await decrypt(enc, $('#pass').value);
      if (mode !== 'lock') { C = content; S.content = content; S.enc = ENC; S.encVersion = ENC.version; save(); }
      unlocked = true; startApp();
      if (mode === 'update') toast('Your lessons are up to date');
    } catch {
      err.textContent = 'That passcode didn’t unlock HealDeal. Check it and try again.';
      err.hidden = false; go.disabled = false; go.textContent = 'Unlock'; $('#pass').select();
    }
  };
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); save(); return; }
  if (S.prayTimer) { checkPrayTimer(); if (S.prayTimer) keepAwake(true); }
  if (S.lockOnOpen && C && hiddenAt && Date.now() - hiddenAt > 2 * 60e3) { unlocked = false; renderGate('lock'); }
  else if ($('#sky')) paintSky($('#sky'));
});

function startApp() {
  document.body.classList.remove('focus');
  $('#tabbar').hidden = false;
  window.onhashchange = route;
  if (!location.hash) location.replace('#/today');
  route();
}

/* ---------------- Router ---------------- */
function route() {
  if (!C || (S.lockOnOpen && !unlocked)) return;
  clearTimers();
  const [tab = 'today', id] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  document.body.classList.toggle('focus', tab === 'heal' && !!id);
  $$('#tabbar a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.tab === (tab === 'settings' ? 'today' : tab)));
  $$('#tabbar a[aria-current]').forEach((a) => a.setAttribute('aria-current', 'page'));
  const v = $('#view');
  const views = {
    today: viewToday, settings: viewSettings,
    pray: id === 'prayers' ? viewPrayers : id ? (el) => viewScripture(el, id) : viewPray,
    lessons: (el) => viewLessons(el, id),
    heal: id ? (el) => viewExercise(el, id) : viewHeal,
    journal: id === 'new' ? viewNewEntry : id ? (el) => viewEntry(el, id) : viewJournal,
  };
  v.innerHTML = '';
  (views[tab] || viewToday)(v);
  window.scrollTo(0, 0);
}

/* ---------------- Today ---------------- */
function viewToday(v) {
  const n = dayIndex();
  const st = C.statements[n % C.statements.length];
  const sc = C.scriptures[n % C.scriptures.length];
  const ls = lessonsAll();
  const le = ls[(n * 5 + 2) % ls.length];
  const prs = prayersAll(), pr = prs.length ? prs[n % prs.length] : null;
  const days = S.prayedDays.length;
  const prayedToday = S.prayedDays.includes(dkey());
  const update = ENC && S.encVersion && ENC.version !== S.encVersion;
  v.innerHTML = `
    <header class="sky" id="sky">
      <div class="sky-lamp"></div><div class="sky-water"><div class="sky-glint"></div></div>
      <div class="sky-text"><p class="sky-date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1 class="sky-greet">${esc(greeting())}</h1></div>
      <a class="icon-btn sky-gear" href="#/settings" aria-label="Settings">${ICON.gear}</a>
    </header>
    <div class="page">
      ${update ? `<div class="banner"><p>Your lessons have been updated.</p><button class="btn lamp" id="getUpdate">Unlock</button></div>` : ''}
      <section class="card word"><p class="eyebrow">Today’s word</p>
        <p class="word-text">${esc(st.text)}</p>${st.ref ? `<p class="ref">${esc(st.ref)}</p>` : ''}</section>
      <section class="card"><p class="eyebrow">Pray today</p>
        <h2 class="h2">${esc(sc.ref)}</h2><p class="theme">${esc(sc.theme)}</p>
        <p class="scripture-snip">${esc(sc.verses[0].text)}${sc.verses.length > 1 ? ' …' : ''}</p>
        <a class="btn primary block" href="#/pray/${sc.id}">Pray through it</a></section>
      ${pr ? `<section class="card"><p class="eyebrow">My prayer · ${esc(pr.ref || 'My prayer')}</p>
        <p class="prayer-text">${esc(pr.text)}</p>
        <a class="link" href="#/pray/prayers">Pray all ${prs.length} of my prayers</a></section>` : ''}
      <div class="quick">
        <a class="btn ember" href="#/heal/hurting">I’m hurting right now</a>
        <a class="btn" href="#/heal">Forgive</a>
        <a class="btn" href="#/journal/new">Write</a>
      </div>
      <section class="card"><p class="eyebrow">Remember · ${esc(catName(le.cat))}</p>
        <h2 class="h3">${esc(le.title)}</h2><div class="lesson-body" style="padding:0">${paras(le.body)}</div>
        <a class="link" href="#/lessons/${encodeURIComponent(le.id)}">Open in Lessons</a></section>
      <p class="tally">${days ? `You’ve prayed on ${days} ${days === 1 ? 'day' : 'days'} so far${prayedToday ? ', including today' : ''}.` : 'The days you pray will be counted here.'}</p>
    </div>`;
  paintSky($('#sky'));
  timers.push(setInterval(() => $('#sky') && paintSky($('#sky')), 60e3));
  if (update) $('#getUpdate').onclick = () => renderGate('update');
}

/* ---------------- Pray ---------------- */
function praySeg(tab) {
  return `<div class="seg" role="group" aria-label="View"><a href="#/pray" role="button" aria-pressed="${tab === 'passages'}">Passages</a><a href="#/pray/prayers" role="button" aria-pressed="${tab === 'prayers'}">Prayers</a></div>`;
}
function viewPrayers(v) {
  const done = todayTicks(), today = dkey();
  const all = prayersAll();
  const ticked = new Set(done.prayers || []);
  const prayedToday = (S.prayerLog.prayers || []).includes(today);
  v.innerHTML = pageTop('Pray', { lede: 'Pray each one aloud. Tick it as you pray.' }) + `<div class="page">
    ${praySeg('prayers')}
    ${all.map((p) => prayerHtml(p, ticked.has(p.id))).join('')}
    <button class="btn block" id="addPrayer">Add a prayer</button><div id="addForm"></div>
    <h2 class="section-h">What I prayed or sensed</h2>
    <textarea id="notes" placeholder="Optional. Write anything God put on your heart.">${esc(S.drafts['pray-prayers'] || '')}</textarea>
    <button class="btn lamp block" id="prayed" style="margin-top:14px">${prayedToday ? 'Save another prayer' : 'I’ve prayed these today'}</button>
    ${prayedToday ? '<p class="small muted" style="text-align:center">You’ve already prayed these today.</p>' : ''}
  </div>`;
  bindPrayers(v);
  $('#addPrayer').onclick = () => {
    $('#addPrayer').hidden = true; $('#addForm').innerHTML = prayerForm(null);
    bindPrayerForm($('#addForm'), null); $('#addForm .f-ref').focus();
  };
  $('#notes').oninput = (e) => { S.drafts['pray-prayers'] = e.target.value; saveSoon(); };
  $('#prayed').onclick = () => {
    (S.prayerLog.prayers ||= []).push(today);
    if (!S.prayedDays.includes(today)) S.prayedDays.push(today);
    const ids = new Set(todayTicks().prayers || []);
    const list = prayersAll().filter((p) => ids.has(p.id)).map((p) => '• ' + (p.ref || 'My prayer')).join('\n');
    const notes = ($('#notes').value || '').trim();
    addJournal({ type: 'prayer', title: 'My prayers', fields: [
      ...(list ? [{ label: 'I prayed', text: list }] : []),
      ...(notes ? [{ label: 'What I prayed or sensed', text: notes }] : []),
    ] });
    delete S.drafts['pray-prayers']; save(); route(); toast('Prayer saved to your journal');
  };
}
function viewPray(v) {
  v.innerHTML = pageTop('Pray', { lede: 'Pray through each passage. Tick each prompt as you pray it.' }) + `<div class="page list">
    ${(C.prayers || S.userPrayers.length) ? praySeg('passages') : ''}
    ${C.scriptures.map((s) => {
      const log = S.prayerLog[s.id] || [];
      const meta = log.length ? `Prayed ${log.length} ${log.length === 1 ? 'time' : 'times'} · last on ${fmtDate(log[log.length - 1] + 'T12:00')}` : 'Not prayed yet';
      return `<a class="row-link" href="#/pray/${s.id}"><div class="card"><div class="grow">
        <h2 class="h3" style="margin:0">${esc(s.ref)}</h2><div class="muted">${esc(s.theme)}</div><div class="meta">${meta}</div></div>${ICON.chev}</div></a>`;
    }).join('')}</div>`;
}

function viewScripture(v, id) {
  const sc = C.scriptures.find((s) => s.id === id);
  if (!sc) { location.hash = '#/pray'; return; }
  const today = dkey();
  todayTicks();
  const ticked = new Set(S.ticks.done[id] || []);
  const myPrayers = prayersAll().filter((p) => p.scripture === id);
  const prayerTicks = new Set(S.ticks.done.prayers || []);
  const tr = S.translations[id];
  const view = tr?.text && S.trView[id] === 'mine' ? 'mine' : 'web';
  const prayedToday = (S.prayerLog[id] || []).includes(today);

  const versesHtml = view === 'mine'
    ? splitParas(tr.text).map((p) => `<p>${esc(p)}</p>`).join('')
    : sc.verses.map((x) => `<p><sup>${x.n}</sup>${esc(x.text)}</p>`).join('');

  v.innerHTML = pageTop('', { back: '#/pray' }) + `<div class="page">
    <h1 class="title">${esc(sc.ref)}</h1><p class="theme">${esc(sc.theme)}</p>
    ${tr?.text ? `<div class="seg" role="group" aria-label="Translation">
      <button data-view="web" aria-pressed="${view === 'web'}">WEB</button>
      <button data-view="mine" aria-pressed="${view === 'mine'}">${esc(tr.label)}</button></div>` : ''}
    <div class="verses">${versesHtml}</div>
    <p class="attrib">${view === 'mine' ? `${esc(tr.label)} · pasted by you` : 'World English Bible · public domain'}</p>
    <div class="btn-row" style="margin:0 0 14px"><a class="btn block" href="${bgUrl(sc.ref)}" target="_blank" rel="noopener">Read in ESV, NIV and NASB</a></div>
    <details class="paste"><summary>${tr?.text ? 'Change your pasted translation' : 'Keep your own translation here'}</summary>
      <p class="small muted">Copy the passage from your Bible app and paste it below. It stays on this phone.</p>
      <label class="field"><span>Translation</span><select id="trLabel">${['ESV', 'NIV', 'NASB', 'Other'].map((o) => `<option${tr?.label === o ? ' selected' : ''}>${o}</option>`).join('')}</select></label>
      <label class="field"><span>Passage text</span><textarea id="trText" placeholder="Paste the verses here">${esc(tr?.text || '')}</textarea></label>
      <div class="btn-row" style="margin:0 0 12px"><button class="btn primary" id="trSave">Save translation</button>${tr?.text ? '<button class="btn" id="trDel">Remove</button>' : ''}</div>
    </details>
    <h2 class="section-h">Pray about this</h2>
    ${sc.prompts.map((p, i) => `<button class="prompt" data-i="${i}" aria-pressed="${ticked.has(i)}"><span class="ring">${ICON.tick}</span>
      <span><span class="v">VERSE ${esc(p.v)}</span>${esc(p.text)}</span></button>`).join('')}
    ${myPrayers.length ? `<h2 class="section-h">${myPrayers.length === 1 ? 'My prayer' : 'My prayers'}</h2><div id="myPrayers">${myPrayers.map((p) => prayerHtml(p, prayerTicks.has(p.id))).join('')}</div>` : ''}
    <h2 class="section-h">What I prayed or sensed</h2>
    <textarea id="notes" placeholder="Optional. Write anything God put on your heart.">${esc(S.drafts['pray-' + id] || '')}</textarea>
    <button class="btn lamp block" id="prayed" style="margin-top:14px">${prayedToday ? 'Save another prayer' : 'I’ve prayed this today'}</button>
    ${prayedToday ? '<p class="small muted" style="text-align:center">You’ve already prayed this today.</p>' : ''}
  </div>`;

  $$('.seg button', v).forEach((b) => b.onclick = () => { S.trView[id] = b.dataset.view; save(); route(); });
  $$('.prompt', v).forEach((b) => b.onclick = () => {
    const i = +b.dataset.i; ticked.has(i) ? ticked.delete(i) : ticked.add(i);
    b.setAttribute('aria-pressed', ticked.has(i)); S.ticks.done[id] = [...ticked]; saveSoon();
  });
  $('#notes').oninput = (e) => { S.drafts['pray-' + id] = e.target.value; saveSoon(); };
  if ($('#myPrayers')) bindPrayers($('#myPrayers'));
  $('#trSave').onclick = () => {
    const text = $('#trText').value.trim();
    if (!text) { toast('Paste the passage first, then tap Save.'); return; }
    S.translations[id] = { label: $('#trLabel').value, text }; S.trView[id] = 'mine'; save(); route(); toast('Translation saved');
  };
  if ($('#trDel')) $('#trDel').onclick = () => { delete S.translations[id]; S.trView[id] = 'web'; save(); route(); };
  $('#prayed').onclick = () => {
    (S.prayerLog[id] ||= []).push(today);
    if (!S.prayedDays.includes(today)) S.prayedDays.push(today);
    const pt = new Set(S.ticks.done.prayers || []);
    const prayedPrompts = [...sc.prompts.filter((_, i) => ticked.has(i)).map((p) => '• ' + p.text),
      ...myPrayers.filter((p) => pt.has(p.id)).map((p) => '• My prayer: ' + p.text)].join('\n');
    const notes = ($('#notes').value || '').trim();
    addJournal({ type: 'prayer', title: sc.ref, fields: [
      ...(prayedPrompts ? [{ label: 'I prayed', text: prayedPrompts }] : []),
      ...(notes ? [{ label: 'What I prayed or sensed', text: notes }] : []),
    ] });
    delete S.drafts['pray-' + id]; save(); route(); toast('Prayer saved to your journal');
  };
}

/* ---------------- Lessons ---------------- */
function viewLessons(v, openId) {
  const tab = openId ? 'lessons' : S.lessonsTab;
  const all = lessonsAll();
  const done = C.checklist.filter((_, i) => S.checklist[i]).length;
  let body = '';
  if (tab === 'lessons') {
    const cats = [...C.categories.map((c) => c.id), 'mine'];
    body = `<button class="btn block" id="addLesson" style="margin-bottom:6px">Add a lesson</button><div id="addForm"></div>` +
      cats.map((cid) => {
        const items = all.filter((l) => (l.cat || 'mine') === cid);
        if (!items.length) return '';
        return `<h2 class="section-h">${esc(cid === 'mine' ? 'My lessons' : catName(cid))}</h2>` + items.map((l) => lessonHtml(l, l.id === openId)).join('');
      }).join('');
  } else {
    body = `<p class="lede" style="margin-top:-4px">Use this when you meet someone new. ${done} of ${C.checklist.length} ticked.</p>` +
      C.checklist.map((c, i) => `<label class="check"><input type="checkbox" data-i="${i}"${S.checklist[i] ? ' checked' : ''}>
        <span>${esc(c.text)}${c.lesson ? `<a class="why link" href="#/lessons/${c.lesson}">Why this matters</a>` : ''}</span></label>`).join('') +
      `<button class="btn ghost block" id="clearChecks">Clear all ticks</button>`;
  }
  v.innerHTML = pageTop('Lessons', { lede: 'What you have learnt, so you can be wise next time.' }) + `<div class="page">
    <div class="seg" role="group" aria-label="View"><button data-t="lessons" aria-pressed="${tab === 'lessons'}">Lessons</button><button data-t="next" aria-pressed="${tab === 'next'}">Next time</button></div>
    ${body}</div>`;

  $$('.seg button', v).forEach((b) => b.onclick = () => { S.lessonsTab = b.dataset.t; save(); location.hash === '#/lessons' ? route() : (location.hash = '#/lessons'); });
  if (tab === 'next') {
    $$('.check input', v).forEach((c) => c.onchange = () => { S.checklist[c.dataset.i] = c.checked; save(); });
    $('#clearChecks').onclick = () => { S.checklist = {}; save(); route(); };
    return;
  }
  $('#addLesson').onclick = () => {
    $('#addLesson').hidden = true;
    $('#addForm').innerHTML = lessonForm({ cat: 'mine' }, true);
    bindLessonForm($('#addForm'), null);
  };
  $$('details.lesson', v).forEach((d) => bindLesson(d));
  if (openId) { const d = $(`details[data-id="${CSS.escape(openId)}"]`); d?.scrollIntoView({ block: 'center' }); }
}

function lessonHtml(l, open) {
  return `<details class="lesson" data-id="${esc(l.id)}"${open ? ' open' : ''}><summary>${esc(l.title)}${l.edited ? '<span class="tag">Edited</span>' : ''}</summary>
    <div class="lesson-body">${paras(l.body)}
      ${l.relisten ? `<label class="field"><span>Link to relisten to</span><input type="url" class="relisten" placeholder="Paste a link to the recording" value="${esc(S.relisten)}"></label>
        ${S.relisten ? `<a class="btn primary" href="${esc(S.relisten)}" target="_blank" rel="noopener" style="margin-bottom:12px">Relisten</a>` : ''}` : ''}
      <div class="lesson-actions"><button data-act="edit">Edit</button>
        ${l.edited ? '<button data-act="restore">Restore original</button>' : ''}${l.mine ? '<button data-act="delete" class="danger">Delete</button>' : ''}</div>
    </div></details>`;
}
function lessonForm(l, isNew) {
  const cats = [...C.categories, { id: 'mine', name: 'My lessons' }];
  return `<div class="card" style="margin-top:8px">
    ${isNew ? `<label class="field"><span>Group</span><select class="f-cat">${cats.map((c) => `<option value="${c.id}"${(l.cat || 'mine') === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
    <label class="field"><span>Title</span><input type="text" class="f-title" value="${esc(l.title || '')}" placeholder="What did you learn?"></label>
    <label class="field"><span>Lesson</span><textarea class="f-body" placeholder="Write it in your own words">${esc((l.body || []).join('\n\n'))}</textarea></label>
    <div class="btn-row"><button class="btn primary f-save">Save lesson</button><button class="btn f-cancel">Cancel</button></div></div>`;
}
function bindLessonForm(box, l) {
  $('.f-cancel', box).onclick = () => route();
  $('.f-save', box).onclick = () => {
    const title = $('.f-title', box).value.trim(), body = splitParas($('.f-body', box).value);
    if (!title) { toast('Give the lesson a title, then save.'); return; }
    if (!l) S.userLessons.push({ id: 'u-' + uid(), cat: $('.f-cat', box).value, title, body });
    else if (l.mine) Object.assign(S.userLessons.find((x) => x.id === l.id), { title, body });
    else S.lessonEdits[l.id] = { title, body };
    save(); route(); toast('Lesson saved');
  };
}
function bindLesson(d) {
  const id = d.dataset.id, l = lessonsAll().find((x) => x.id === id);
  const rl = $('.relisten', d);
  if (rl) rl.onchange = () => {
    const val = rl.value.trim();
    if (val && !/^https?:\/\//i.test(val)) { toast('Paste a full link that starts with https://'); return; }
    S.relisten = val; save(); route(); location.hash = '#/lessons/' + id;
  };
  $$('.lesson-actions button', d).forEach((b) => b.onclick = () => {
    if (b.dataset.act === 'edit') { $('.lesson-body', d).innerHTML = lessonForm(l, false); bindLessonForm(d, l); }
    if (b.dataset.act === 'restore') { delete S.lessonEdits[id]; save(); route(); toast('Original lesson restored'); }
    if (b.dataset.act === 'delete' && confirm('Delete this lesson? This can’t be undone.')) { S.userLessons = S.userLessons.filter((x) => x.id !== id); save(); route(); }
  });
}

/* ---------------- Heal ---------------- */
function viewHeal(v) {
  const order = ['forgive-other', 'forgive-self', 'letter', 'hurting'];
  const exs = order.map((id) => C.exercises.find((e) => e.id === id)).filter(Boolean);
  const steps = S.steps;
  v.innerHTML = pageTop('Heal', { lede: 'Forgiving others matters. So does forgiving yourself, and taking the next step forward.' }) + `<div class="page">
    <div class="ex-grid">${exs.map((e) => `<a class="ex-card${e.id === 'hurting' ? ' hurting' : ''}" href="#/heal/${e.id}">
      <h2 class="h3">${esc(e.title)}</h2><p class="line">${esc(e.line)}</p>
      ${S.drafts[e.id] ? '<span class="resume">Continue where you left off</span>' : ''}</a>`).join('')}</div>

    <h2 class="section-h">Steps forward</h2>
    <div class="card">
      ${steps.length ? steps.map((s) => `<label class="step-item${s.done ? ' done' : ''}"><input type="checkbox" data-id="${s.id}"${s.done ? ' checked' : ''}>
        <span class="txt">${esc(s.text)}<span class="meta" style="display:block">${fmtDate(s.date)}</span></span>
        <button class="del" data-del="${s.id}" aria-label="Remove step">×</button></label>`).join('')
        : '<p class="muted small" style="margin:0">Small steps add up. Add one you can take this week.</p>'}
      <form class="add-row" id="addStep"><input type="text" id="stepText" placeholder="A small step I’ll take" aria-label="New step"><button class="btn primary">Add</button></form>
    </div>

    <h2 class="section-h">Words to hold on to</h2>
    <div class="card">${C.statements.map((s) => `<p class="statement">${esc(s.text)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</p>`).join('')}</div>
  </div>`;
  $$('.step-item input', v).forEach((c) => c.onchange = () => { S.steps.find((s) => s.id === c.dataset.id).done = c.checked; save(); route(); });
  $$('[data-del]', v).forEach((b) => b.onclick = (e) => { e.preventDefault(); S.steps = S.steps.filter((s) => s.id !== b.dataset.del); save(); route(); });
  $('#addStep').onsubmit = (e) => {
    e.preventDefault(); const t = $('#stepText').value.trim(); if (!t) return;
    S.steps.push({ id: uid(), text: t, date: new Date().toISOString(), done: false }); save(); route();
  };
}

function viewExercise(v, id) {
  const ex = C.exercises.find((e) => e.id === id);
  if (!ex) { location.hash = '#/heal'; return; }
  const d = (S.drafts[id] ||= { step: 0, f: {} });
  const total = ex.steps.length;

  const render = () => {
    clearTimers();
    const st = ex.steps[d.step];
    const name = (d.f.name || '').trim() || 'them';
    const T = (s) => esc(s).replaceAll('{name}', esc(name));
    const last = d.step === total - 1;
    let inner = `<h2>${T(st.title)}</h2>`;
    if (st.hint) inner += `<p class="hint">${T(st.hint)}</p>`;
    if (st.body?.length) inner += `<div class="body">${st.body.map((p) => `<p>${T(p)}</p>`).join('')}</div>`;
    if (st.type === 'field') {
      if (st.chips) inner += `<div class="chips">${st.chips.map((c) => `<button class="chip" type="button">${esc(c)}</button>`).join('')}</div>`;
      inner += st.short
        ? `<input type="text" id="fld" placeholder="${esc(st.placeholder || '')}" value="${esc(d.f[st.key] || '')}">`
        : `<textarea id="fld" class="${st.tall ? 'tall' : ''}" placeholder="${esc(st.placeholder || '')}">${esc(d.f[st.key] || '')}</textarea>`;
    }
    if (st.type === 'choose') inner += d.f[st.key]
      ? `<p class="chosen">${ICON.tick.replace('<svg', '<svg width="22" height="22" style="stroke:currentColor;fill:none;stroke-width:2.5"')} You chose this on ${fmtDate(d.f[st.key])}.</p>`
      : `<button class="btn lamp block" id="choose" style="margin-top:8px">${esc(st.button)}</button>`;
    if (st.type === 'check') inner += st.items.map((it, i) => `<label class="check"><input type="checkbox" data-i="${i}"${(d.f[st.key] || []).includes(i) ? ' checked' : ''}><span>${esc(it)}</span></label>`).join('')
      + `<p class="after" id="after"${(d.f[st.key] || []).length ? '' : ' hidden'}>${esc(st.after)}</p>`;
    if (st.type === 'breathe') inner += `<div class="breath"><div class="orb" id="orb"></div><div class="say" id="say">Breathe in</div></div>`;
    if (st.verse) inner += verseCard(st.verse);
    const nav = st.type === 'release'
      ? `<div class="flow-nav"><button class="btn" id="keep">Keep in my journal</button><button class="btn lamp" id="letgo">Let it go</button></div>
         <div class="flow-nav" style="margin-top:8px"><button class="btn ghost" id="prev">Back</button></div>`
      : `<div class="flow-nav">${d.step > 0 ? '<button class="btn" id="prev">Back</button>' : ''}
         <button class="btn primary" id="next">${last ? 'Finish' : st.optional && !(d.f[st.key] || '').trim() ? 'Skip' : 'Next'}</button></div>`;

    v.innerHTML = `<div class="flow-top"><div class="flow-top-inner">
        <button class="icon-btn" id="close" aria-label="Close and save for later">${ICON.close}</button>
        <span class="count">${esc(ex.title)} · Step ${d.step + 1} of ${total}</span></div>
        <div class="bar"><i style="width:${((d.step + 1) / total) * 100}%"></i></div></div>
      <div class="flow" id="flow">${inner}${nav}</div>`;

    const fld = $('#fld');
    if (fld) {
      fld.oninput = () => {
        d.f[st.key] = fld.value; saveSoon();
        if (st.optional && $('#next')) $('#next').textContent = last ? 'Finish' : fld.value.trim() ? 'Next' : 'Skip';
      };
      $$('.chip', v).forEach((c) => c.onclick = () => {
        fld.value = (fld.value.trim() ? fld.value.trim() + '\n' : '') + c.textContent; fld.oninput(); fld.focus();
      });
    }
    if ($('#choose')) $('#choose').onclick = () => { d.f[st.key] = new Date().toISOString(); save(); render(); };
    $$('.check input', v).forEach((c) => c.onchange = () => {
      d.f[st.key] = $$('.check input', v).filter((x) => x.checked).map((x) => +x.dataset.i);
      $('#after').hidden = !d.f[st.key].length; saveSoon();
    });
    if (st.type === 'breathe') breathe();
    $('#close').onclick = () => {
      const started = Object.keys(d.f).length || d.step > 0;
      if (!started) delete S.drafts[id];
      save(); location.hash = '#/heal'; if (started) toast('Saved. You can continue later.');
    };
    if ($('#prev')) $('#prev').onclick = () => { if (d.step > 0) { d.step--; save(); render(); window.scrollTo(0, 0); } };
    if ($('#next')) $('#next').onclick = () => {
      if (st.key === 'name' && !(d.f.name || '').trim()) { toast('Write their name, or a word for them, to continue.'); return; }
      if (last) return finish(true);
      d.step++; save(); render(); window.scrollTo(0, 0);
    };
    if ($('#keep')) $('#keep').onclick = () => finish(true);
    if ($('#letgo')) $('#letgo').onclick = () => { $('#flow').classList.add('letting-go'); timers.push(setTimeout(() => finish(false), 1700)); };
  };

  const breathe = () => {
    const phases = [['Breathe in', true], ['Hold', true], ['Breathe out', false], ['Hold', false]];
    let i = 0;
    const tick = () => {
      const [say, big] = phases[i % 4];
      if (!$('#orb')) return;
      $('#say').textContent = say; $('#orb').classList.toggle('big', big); i++;
    };
    tick(); timers.push(setInterval(tick, 4000));
  };

  const finish = (keep) => {
    const name = (d.f.name || '').trim();
    const fields = [];
    for (const st of ex.steps) {
      const val = d.f[st.key];
      const label = st.title.replaceAll('{name}', name || 'them');
      if (st.type === 'field' && st.key !== 'name' && st.key !== 'to' && (val || '').trim()) fields.push({ label, text: val.trim() });
      if (st.type === 'choose' && val) fields.push({ label, text: st.body.join(' ').replaceAll('{name}', name || 'them') });
      if (st.type === 'check' && val?.length) fields.push({ label, text: val.map((i) => '• ' + st.items[i]).join('\n') });
    }
    const titles = {
      'forgive-other': `Forgiving ${name || 'someone'}`, 'forgive-self': 'Forgiving myself',
      letter: `Letter to ${(d.f.to || '').trim() || 'someone'}`, hurting: 'When I was hurting',
    };
    if (keep) addJournal({ type: 'exercise', ex: ex.id, title: titles[ex.id] || ex.title, fields });
    else addJournal({ type: 'exercise', ex: ex.id, title: 'I let a letter go', fields: [{ label: '', text: 'You gave this letter to God and let it go.' }] });
    const stepField = ex.steps.find((s) => s.progress);
    if (stepField && (d.f[stepField.key] || '').trim()) S.steps.push({ id: uid(), text: d.f[stepField.key].trim(), date: new Date().toISOString(), done: false });
    delete S.drafts[id]; save();
    clearTimers();
    const lam = verse('lam-3-22');
    v.innerHTML = `<div class="flow done"><div class="glow"></div>
      <h2>${keep ? 'Saved to your journal' : 'Let go. It’s in God’s hands now.'}</h2>
      ${lam ? `<div class="verse-card" style="text-align:left"><p>${esc(lam.text)}</p><p class="ref">${esc(lam.ref)}</p></div>` : ''}
      <div class="flow-nav"><a class="btn" href="#/heal">Back to Heal</a>${keep ? '<a class="btn primary" href="#/journal">Open journal</a>' : ''}</div></div>`;
  };

  render();
}

/* ---------------- Journal ---------------- */
function typeLabel(e) {
  if (e.type === 'prayer') return 'Prayer';
  if (e.type === 'note') return 'Journal';
  return C.exercises.find((x) => x.id === e.ex)?.title || 'Healing';
}
function viewJournal(v) {
  const groups = {};
  for (const e of S.journal) (groups[fmtDate(e.date, { month: 'long', year: 'numeric' })] ||= []).push(e);
  v.innerHTML = pageTop('Journal', { right: '<a class="btn primary" href="#/journal/new" style="min-height:38px;padding:0 14px">New entry</a>' }) + `<div class="page">
    ${S.journal.length ? Object.entries(groups).map(([m, es]) => `<h2 class="section-h">${esc(m)}</h2><div class="list">${es.map((e) => {
      const snip = e.fields?.map((f) => f.text).join(' · ') || '';
      return `<a class="row-link" href="#/journal/${e.id}"><div class="card entry"><div class="grow">
        <span class="type">${esc(typeLabel(e))}</span><h3 class="h3" style="margin:2px 0 0">${esc(e.title || 'Untitled')}</h3>
        ${snip ? `<p class="snip">${esc(snip)}</p>` : ''}<div class="meta">${fmtDate(e.date)} · ${fmtTime(e.date)}</div></div>${ICON.chev}</div></a>`;
    }).join('')}</div>`).join('')
    : `<div class="empty"><h2 class="h3">Your journal is empty</h2><p>Prayers, forgiveness exercises and anything you write will be kept here, on this phone only.</p>
       <a class="btn primary" href="#/journal/new">Write your first entry</a></div>`}
  </div>`;
}
function viewNewEntry(v) {
  const dr = S.drafts.note || { title: '', text: '' };
  v.innerHTML = pageTop('New entry', { back: '#/journal' }) + `<div class="page">
    <label class="field"><span>Title (optional)</span><input type="text" id="nt" value="${esc(dr.title)}" placeholder="e.g. What I’m thankful for"></label>
    <label class="field"><span>Entry</span><textarea id="nx" class="tall" placeholder="Write freely…">${esc(dr.text)}</textarea></label>
    <button class="btn primary block" id="ns">Save entry</button></div>`;
  const keep = () => { S.drafts.note = { title: $('#nt').value, text: $('#nx').value }; saveSoon(); };
  $('#nt').oninput = keep; $('#nx').oninput = keep;
  $('#ns').onclick = () => {
    const text = $('#nx').value.trim();
    if (!text) { toast('Write something first, then save.'); return; }
    addJournal({ type: 'note', title: $('#nt').value.trim() || fmtDate(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' }), fields: [{ label: '', text }] });
    delete S.drafts.note; save(); location.hash = '#/journal'; toast('Entry saved');
  };
}
function viewEntry(v, id) {
  const e = S.journal.find((x) => x.id === id);
  if (!e) { location.hash = '#/journal'; return; }
  v.innerHTML = pageTop('', { back: '#/journal' }) + `<div class="page entry">
    <span class="type">${esc(typeLabel(e))}</span><h1 class="title">${esc(e.title || 'Untitled')}</h1>
    <p class="muted" style="margin:0 0 22px">${fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${fmtTime(e.date)}</p>
    ${(e.fields || []).map((f) => `<div class="entry-field">${f.label ? `<h3>${esc(f.label)}</h3>` : ''}<p>${esc(f.text)}</p></div>`).join('') || '<p class="muted">Nothing was written for this entry.</p>'}
    <button class="btn ember block" id="del" style="margin-top:20px">Delete entry</button></div>`;
  $('#del').onclick = () => {
    if (!confirm('Delete this journal entry? This can’t be undone.')) return;
    S.journal = S.journal.filter((x) => x.id !== id); save(); location.hash = '#/journal'; toast('Entry deleted');
  };
}

/* ---------------- Settings ---------------- */
function ics() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ymd = `${tomorrow.getFullYear()}${pad(tomorrow.getMonth() + 1)}${pad(tomorrow.getDate())}`;
  const app = location.href.split('#')[0];
  const icsText = (s) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1');
  const ev = (key, label, line) => {
    const r = S.reminders[key]; if (!r.on) return '';
    label = icsText(label); line = icsText(line);
    return ['BEGIN:VEVENT', `UID:healdeal-${key}-${stamp}@healdeal`, `DTSTAMP:${stamp}`,
      `DTSTART:${ymd}T${r.time.replace(':', '')}00`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY',
      `SUMMARY:${label}`, `DESCRIPTION:${line} Open HealDeal: ${app}`, `URL:${app}`,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${label}`, 'END:VALARM', 'END:VEVENT'].join('\r\n') + '\r\n';
  };
  return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//HealDeal//EN\r\nCALSCALE:GREGORIAN\r\n'
    + ev('morning', 'Pray with HealDeal', 'Time to pray through today’s scripture.')
    + ev('evening', 'Evening reflection with HealDeal', 'Take a moment to pray, forgive and write.')
    + 'END:VCALENDAR\r\n';
}
function viewSettings(v) {
  const r = S.reminders;
  v.innerHTML = pageTop('Settings', { back: '#/today' }) + `<div class="page">
    <h2 class="section-h">Daily reminders to pray</h2>
    <div class="card">
      ${['morning', 'evening'].map((k) => `<div class="switch" style="margin-bottom:10px"><label for="on-${k}" style="flex:1">${k === 'morning' ? 'Morning prayer' : 'Evening reflection'}</label>
        <input type="time" id="t-${k}" value="${r[k].time}" style="width:auto;padding:8px 10px" aria-label="${k} time">
        <input type="checkbox" id="on-${k}"${r[k].on ? ' checked' : ''}></div>`).join('')}
      <button class="btn primary block" id="ics" style="margin-top:6px">Add reminders to Calendar</button>
      <p class="small muted" style="margin:10px 0 0">Open the file and tap <strong>Add All</strong>. Your iPhone Calendar will then remind you every day. If you change the times, delete the old HealDeal events in Calendar and add the new ones.</p>
    </div>

    <h2 class="section-h">Privacy</h2>
    <div class="card">
      <label class="switch"><span>Ask for my passcode when I open HealDeal</span><input type="checkbox" id="lock"${S.lockOnOpen ? ' checked' : ''}></label>
      <p class="small muted" style="margin:8px 0 0">Your journal, prayers and edits are stored only on this phone. Nothing you write is sent anywhere.</p>
    </div>

    <h2 class="section-h">Backup</h2>
    <div class="card">
      <p class="small muted">Save a copy of your journal, prayers, steps and edits. Keep it somewhere private, like your iCloud Drive.</p>
      <div class="btn-row" style="margin-top:0"><button class="btn" id="exp">Save a backup</button><label class="btn" for="imp">Restore a backup</label></div>
      <input type="file" id="imp" accept="application/json,.json" hidden>
    </div>

    <h2 class="section-h">About the scripture</h2>
    <div class="card"><p class="small" style="margin:0">Scripture in HealDeal is from the World English Bible, which is in the public domain. On any passage, tap <strong>Read in ESV, NIV and NASB</strong> to read your translations side by side, or paste your favourite translation in to keep it in the app.</p></div>

    <h2 class="section-h">Start again</h2>
    <div class="card"><button class="btn ember block" id="wipe">Remove everything from this phone</button></div>
  </div>`;

  for (const k of ['morning', 'evening']) {
    $('#t-' + k).onchange = (e) => { r[k].time = e.target.value || r[k].time; save(); };
    $('#on-' + k).onchange = (e) => { r[k].on = e.target.checked; save(); };
  }
  $('#ics').onclick = () => {
    if (!r.morning.on && !r.evening.on) { toast('Turn on at least one reminder first.'); return; }
    download('HealDeal reminders.ics', ics(), 'text/calendar');
  };
  $('#lock').onchange = (e) => { S.lockOnOpen = e.target.checked; unlocked = true; save(); toast(e.target.checked ? 'HealDeal will ask for your passcode' : 'Passcode lock turned off'); };
  $('#exp').onclick = () => {
    const { content, enc, ...mine } = S;
    download(`HealDeal backup ${dkey()}.json`, JSON.stringify({ healdealBackup: 1, saved: new Date().toISOString(), data: mine }, null, 1), 'application/json');
  };
  $('#imp').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const b = JSON.parse(await file.text());
      if (!b.healdealBackup || !b.data) throw new Error();
      if (!confirm(`Restore the backup from ${fmtDate(b.saved)}? It will replace your journal, prayers and edits on this phone.`)) return;
      Object.assign(S, b.data); save(); toast('Backup restored'); location.hash = '#/today';
    } catch { toast('That file isn’t a HealDeal backup. Choose a file saved from HealDeal.'); }
  };
  $('#wipe').onclick = () => {
    if (!confirm('Remove all HealDeal data from this phone, including your journal? This can’t be undone. Save a backup first if you want to keep it.')) return;
    wiped = true; localStorage.removeItem(STORE); location.replace(location.pathname);
  };
}

boot();
