'use strict';
/* HealDeal: a private place to pray, remember lessons and heal.
   Everything personal lives on this phone (localStorage). The lessons arrive
   encrypted in content.enc.json and are unlocked once with the passcode.
   Evidence-based psychotherapy tools load from therapy.js and merge at runtime
   without altering content.enc.json or the user's passcode. */

const STORE = 'healdeal.v1';
const TH = window.HEALDEAL_THERAPY || {
  VERSES: {}, EMOTION_FAMILIES: [], BODY_ZONES: [], BODY_SENSATIONS: [],
  WINDOW_ZONES: [], CATEGORIES: [], META: {}, EXERCISES: [], BREATH_MODES: {},
};
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
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h4l5-4v13l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
};

/* ---------------- State ---------------- */
function loadState() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } }
const S = loadState();
const DEFAULTS = {
  journal: [], prayerLog: {}, prayedDays: [], translations: {}, trView: {}, ticks: {}, lessonEdits: {}, userLessons: [],
  checklist: {}, drafts: {}, steps: [], relisten: '', lessonsTab: 'lessons', lockOnOpen: false,
  prayerEdits: {}, userPrayers: [], checkins: [], healFilter: 'all', journalFilter: 'all', prayMins: 10,
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

let C = S.content || null;   // unlocked encrypted content (preserved untouched)
let ENC = null;              // latest encrypted bundle from the server
let unlocked = false;
let timers = [];
const clearTimers = () => { timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); timers = []; };

/* ---------------- Crypto (untouched format: healdeal-1) ---------------- */
const ub64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function decrypt(enc, pass) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: ub64(enc.salt), iterations: enc.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub64(enc.iv) }, key, ub64(enc.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

/* ---------------- Sky (time of day) ---------------- */
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
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800);
}
function verse(key) { return C?.verses?.[key] || TH.VERSES[key]; }
function verseCard(key) {
  const v = verse(key); if (!v) return '';
  return `<div class="verse-card"><p>${esc(v.text)}</p><p class="ref">${esc(v.ref)}</p></div>`;
}
function exercisesAll() {
  const seen = new Set();
  const merged = [];
  for (const e of [...(C?.exercises || []), ...TH.EXERCISES]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    merged.push({ ...e, meta: TH.META[e.id] || {} });
  }
  return merged;
}
function findExercise(id) { return exercisesAll().find((e) => e.id === id); }
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
function prayerMs() { return (S.prayMins || 10) * 60e3; }
function prayerHtml(p, ticked) {
  const refLink = (r) => `<a href="${bgUrl(r)}" target="_blank" rel="noopener">${esc(r)}</a>`;
  const showVerses = p.verses.length && p.ref === p.origRef;
  const mins = S.prayMins || 10;
  return `<article class="prayer" data-id="${esc(p.id)}">
    <p class="prayer-ref">${showVerses ? p.verses.map((x) => refLink(x.ref)).join(' · ') : esc(p.ref || 'My prayer')}${p.edited ? '<span class="tag">Edited</span>' : ''}</p>
    ${showVerses ? p.verses.map((x) => `<p class="prayer-verse">${esc(x.text)}${p.verses.length > 1 ? ` <span class="ref">${esc(x.ref)}</span>` : ''}</p>`).join('') : ''}
    <p class="prayer-text">${esc(p.text)}</p>
    <div class="prayer-foot"><button class="pray-tick" aria-pressed="${ticked}"><span class="ring">${ICON.tick}</span>${ticked ? 'Prayed' : 'Tick when prayed'}</button>
      <button class="pray-timer" aria-pressed="false" aria-label="Pray for ${mins} minutes">${ICON.clock}<span>${mins} min</span></button>
      <span class="lesson-actions"><button data-act="edit">Edit</button>${p.edited ? '<button data-act="restore">Restore</button>' : ''}${p.mine ? '<button data-act="delete" class="danger">Delete</button>' : ''}</span></div>
  </article>`;
}
function prayerForm(p) {
  return `<div class="card prayer-form">
    <label class="field"><span>Scripture</span><input type="text" class="f-ref" value="${esc(p?.ref || '')}" placeholder="For example, Isaiah 43:19"></label>
    <label class="field"><span>Prayer</span><textarea class="f-text" placeholder="Father in the name of Jesus…">${esc(p?.text || '')}</textarea></label>
    <div class="btn-row"><button class="btn primary f-save">Save prayer</button><button class="btn f-cancel">Cancel</button></div></div>`;
}

/* Audio & WakeLock helpers */
let audioCtx, wake;
function ensureAudio() {
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); return audioCtx; } catch { return null; }
}
function chime() {
  try {
    const ctx = ensureAudio(); if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), at = t + i * .45;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.22, at + .02); g.gain.exponentialRampToValueAtTime(.001, at + 2.4);
      o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 2.5);
    });
  } catch {}
}
function softTapTone(side) {
  try {
    const ctx = ensureAudio(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = side === 'left' ? 280 : 320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = side === 'left' ? -0.75 : 0.75;
      o.connect(g).connect(pan).connect(ctx.destination);
    } else {
      o.connect(g).connect(ctx.destination);
    }
    o.start(t); o.stop(t + 0.24);
  } catch {}
}
async function keepAwake(on) {
  try { if (on) wake = await navigator.wakeLock?.request('screen'); else { await wake?.release(); wake = null; } } catch {}
}
const fmtLeft = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

/* Prayer timer */
function paintPrayers() {
  const t = S.prayTimer, done = new Set(todayTicks().prayers || []);
  const mins = S.prayMins || 10, dur = t?.dur || prayerMs();
  $$('.prayer').forEach((card) => {
    const id = card.dataset.id, on = t?.id === id, left = on ? t.end - Date.now() : dur;
    card.classList.toggle('timing', on);
    card.style.setProperty('--p', `${on ? Math.min(100, Math.max(0, (1 - left / dur) * 100)) : 0}%`);
    const b = $('.pray-timer', card);
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? `Stop the timer, ${fmtLeft(left)} left` : `Pray for ${mins} minutes`);
    $('span', b).textContent = on ? fmtLeft(left) : `${mins} min`;
    const tk = $('.pray-tick', card), ticked = done.has(id);
    tk.setAttribute('aria-pressed', ticked); tk.lastChild.textContent = ticked ? 'Prayed' : 'Tick when prayed';
  });
}
function checkPrayTimer() {
  const t = S.prayTimer; if (!t) return;
  if (Date.now() < t.end) { paintPrayers(); return; }
  const mins = Math.round((t.dur || prayerMs()) / 60e3);
  const done = todayTicks(); done.prayers = [...new Set([...(done.prayers || []), t.id])];
  S.prayTimer = null; save(); keepAwake(false);
  if (!document.hidden) chime();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  toast(`${mins} minutes of prayer done. Amen.`);
  paintPrayers();
}
setInterval(checkPrayTimer, 1000);
function bindPrayers(root) {
  const done = todayTicks();
  $$('.pray-timer', root).forEach((b) => b.onclick = () => {
    const id = b.closest('.prayer').dataset.id;
    if (S.prayTimer?.id === id) { S.prayTimer = null; keepAwake(false); }
    else {
      const dur = prayerMs();
      S.prayTimer = { id, end: Date.now() + dur, dur }; keepAwake(true);
      ensureAudio();
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
function weekRhythmHtml() {
  const active = new Set([
    ...S.prayedDays,
    ...(S.checkins || []).map((c) => c.dkey || dkey(new Date(c.date))),
    ...(S.journal || []).map((j) => dkey(new Date(j.date))),
  ]);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const k = dkey(dt);
    const lbl = dt.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2);
    days.push(`<div class="rhythm-day${active.has(k) ? ' on' : ''}${i === 0 ? ' today' : ''}" title="${esc(k)}">
      <span class="rhythm-dot"></span><span>${lbl}</span></div>`);
  }
  return `<div class="rhythm" aria-label="Last 7 days shown up">${days.join('')}</div>`;
}

function checkinCardHtml() {
  const today = dkey();
  const latest = (S.checkins || []).find((c) => (c.dkey || dkey(new Date(c.date))) === today);
  const fam = latest ? TH.EMOTION_FAMILIES.find((f) => f.id === latest.familyId) : null;
  const recs = fam ? fam.suggest.map((id) => findExercise(id)).filter(Boolean).slice(0, 2) : [];

  return `<section class="card checkin-card" id="checkinCard">
    <div class="checkin-head">
      <p class="eyebrow" style="margin:0">Heart check-in</p>
      ${latest ? `<button class="link-btn" id="recheck">Update</button>` : ''}
    </div>
    ${latest && fam ? `
      <p class="checkin-summary">Today you named <strong>${esc(fam.name)}</strong>${latest.words?.length ? ` · ${esc(latest.words.join(', '))}` : ''}.</p>
      ${recs.length ? `<p class="small muted" style="margin:0 0 8px">Suggested for how you feel:</p>
        <div class="rec-row">${recs.map((e) => `<a class="rec-pill" href="#/heal/${esc(e.id)}">
          <span>${esc(e.title)}</span><small>${esc(e.meta.badge || '')}</small></a>`).join('')}</div>` : ''}
      <a class="link" href="#/heal/emotion-map" style="margin-top:6px">Go deeper with the Emotion &amp; Body Map</a>
    ` : `
      <h2 class="h3" style="margin:4px 0 6px">How is your heart right now?</h2>
      <p class="small muted" style="margin:0 0 12px">Naming what you feel quiets emotional overwhelm and helps choose the right support.</p>
      <div class="mood-grid">
        ${TH.EMOTION_FAMILIES.map((f) => `<button type="button" class="mood-btn tone-${esc(f.tone)}" data-fam="${esc(f.id)}">
          <strong>${esc(f.name)}</strong><span>${esc(f.short)}</span></button>`).join('')}
      </div>
      <div id="checkinFollow"></div>
    `}
  </section>`;
}

function bindCheckinCard(v) {
  const card = $('#checkinCard', v); if (!card) return;
  const re = $('#recheck', card);
  if (re) {
    re.onclick = () => {
      card.innerHTML = `
        <div class="checkin-head"><p class="eyebrow" style="margin:0">Heart check-in</p></div>
        <h2 class="h3" style="margin:4px 0 6px">How is your heart right now?</h2>
        <div class="mood-grid">
          ${TH.EMOTION_FAMILIES.map((f) => `<button type="button" class="mood-btn tone-${esc(f.tone)}" data-fam="${esc(f.id)}">
            <strong>${esc(f.name)}</strong><span>${esc(f.short)}</span></button>`).join('')}
        </div>
        <div id="checkinFollow"></div>`;
      bindCheckinButtons(card);
    };
  }
  bindCheckinButtons(card);
}

function bindCheckinButtons(card) {
  $$('.mood-btn', card).forEach((b) => b.onclick = () => {
    const fam = TH.EMOTION_FAMILIES.find((f) => f.id === b.dataset.fam);
    if (!fam) return;
    $$('.mood-btn', card).forEach((x) => x.setAttribute('aria-pressed', x === b));
    const chosenWords = new Set();
    const follow = $('#checkinFollow', card);
    const recs = fam.suggest.map((id) => findExercise(id)).filter(Boolean).slice(0, 2);
    follow.innerHTML = `<div class="checkin-follow">
      <p class="small muted" style="margin:12px 0 6px">Tap any specific words that fit (optional):</p>
      <div class="chips">${[...fam.surface.slice(0, 4), ...fam.primary.slice(0, 4)].map((w) =>
        `<button type="button" class="chip toggle-chip" data-w="${esc(w)}" aria-pressed="false">${esc(w)}</button>`).join('')}</div>
      <div class="btn-row" style="margin-top:8px">
        <button type="button" class="btn primary" id="saveCheckin">Save check-in</button>
        <a class="btn" href="#/heal/emotion-map">Full Body &amp; Emotion Map</a>
      </div>
      ${recs.length ? `<p class="small muted" style="margin:14px 0 6px">Helpful right now:</p>
        <div class="rec-row">${recs.map((e) => `<a class="rec-pill" href="#/heal/${esc(e.id)}">
          <span>${esc(e.title)}</span><small>${esc(e.meta.badge || '')}</small></a>`).join('')}</div>` : ''}
    </div>`;
    $$('.toggle-chip', follow).forEach((c) => c.onclick = () => {
      const w = c.dataset.w;
      chosenWords.has(w) ? chosenWords.delete(w) : chosenWords.add(w);
      c.setAttribute('aria-pressed', chosenWords.has(w));
    });
    $('#saveCheckin', follow).onclick = () => {
      const words = [...chosenWords];
      const entry = { id: uid(), date: new Date().toISOString(), dkey: dkey(), familyId: fam.id, family: fam.name, words };
      S.checkins.unshift(entry);
      addJournal({
        type: 'checkin',
        title: `Heart check-in: ${fam.name}`,
        emotions: words.length ? words : [fam.name],
        fields: [
          { label: 'Feeling', text: words.length ? `${fam.name} — ${words.join(', ')}` : fam.name },
        ],
      });
      save();
      toast('Heart check-in saved');
      route();
    };
  });
}

function viewToday(v) {
  const n = dayIndex();
  const st = C.statements[n % C.statements.length];
  const sc = C.scriptures[n % C.scriptures.length];
  const ls = lessonsAll();
  const le = ls[(n * 5 + 2) % ls.length];
  const prs = prayersAll(), pr = prs.length ? prs[n % prs.length] : null;
  const days = S.prayedDays.length;
  const prayedToday = S.prayedDays.includes(dkey());
  v.innerHTML = `
    <header class="sky" id="sky">
      <div class="sky-lamp"></div><div class="sky-water"><div class="sky-glint"></div></div>
      <div class="sky-text"><p class="sky-date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1 class="sky-greet">${esc(greeting())}</h1></div>
      <a class="icon-btn sky-gear" href="#/settings" aria-label="Settings">${ICON.gear}</a>
    </header>
    <div class="page">
      ${updateBanner('Your lessons have been updated.')}
      <section class="card word"><p class="eyebrow">Today’s word</p>
        <p class="word-text">${esc(st.text)}</p>${st.ref ? `<p class="ref">${esc(st.ref)}</p>` : ''}</section>
      ${checkinCardHtml()}
      <div class="quick">
        <a class="btn ember" href="#/heal/hurting">I’m hurting right now</a>
        <a class="btn" href="#/heal/nervous-reset">Calm body</a>
        <a class="btn" href="#/heal/emotion-map">Name feeling</a>
        <a class="btn" href="#/heal/forgive-other">Forgive</a>
        <a class="btn" href="#/journal/new">Write</a>
      </div>
      <section class="card"><p class="eyebrow">Pray today</p>
        <h2 class="h2">${esc(sc.ref)}</h2><p class="theme">${esc(sc.theme)}</p>
        <p class="scripture-snip">${esc(sc.verses[0].text)}${sc.verses.length > 1 ? ' …' : ''}</p>
        <a class="btn primary block" href="#/pray/${sc.id}">Pray through it</a></section>
      ${pr ? `<section class="card"><p class="eyebrow">My prayer · ${esc(pr.ref || 'My prayer')}</p>
        <p class="prayer-text">${esc(pr.text)}</p>
        <a class="link" href="#/pray/prayers">Pray all ${prs.length} of my prayers</a></section>` : ''}
      <section class="card"><p class="eyebrow">Remember · ${esc(catName(le.cat))}</p>
        <h2 class="h3">${esc(le.title)}</h2><div class="lesson-body" style="padding:0">${paras(le.body)}</div>
        <a class="link" href="#/lessons/${encodeURIComponent(le.id)}">Open in Lessons</a></section>
      <div class="rhythm-wrap">
        ${weekRhythmHtml()}
        <p class="tally">${days ? `You’ve prayed on ${days} ${days === 1 ? 'day' : 'days'} so far${prayedToday ? ', including today' : ''}.` : 'The days you pray and show up will gather here.'}</p>
      </div>
    </div>`;
  paintSky($('#sky'));
  timers.push(setInterval(() => $('#sky') && paintSky($('#sky')), 60e3));
  bindUpdate(v);
  bindCheckinCard(v);
}

/* ---------------- Pray ---------------- */
const updateReady = () => ENC && S.encVersion && ENC.version !== S.encVersion;
function updateBanner(text) {
  return updateReady() ? `<div class="banner"><p>${text}</p><button class="btn lamp get-update">Unlock</button></div>` : '';
}
function bindUpdate(v) { $$('.get-update', v).forEach((b) => b.onclick = () => renderGate('update')); }
function praySeg(tab) {
  return `<div class="seg" role="group" aria-label="View"><a href="#/pray" role="button" aria-pressed="${tab === 'passages'}">Passages</a><a href="#/pray/prayers" role="button" aria-pressed="${tab === 'prayers'}">Prayers</a></div>`;
}
function viewPrayers(v) {
  const done = todayTicks(), today = dkey();
  const all = prayersAll();
  const ticked = new Set(done.prayers || []);
  const prayedToday = (S.prayerLog.prayers || []).includes(today);
  const curMins = S.prayMins || 10;
  v.innerHTML = pageTop('Pray', { lede: 'Pray each one aloud. Tick it as you pray.' }) + `<div class="page">
    ${praySeg('prayers')}
    ${updateBanner('New prayers are ready. Unlock the update to see them.')}
    <div class="dur-row" role="group" aria-label="Prayer timer length">
      <span class="small muted">Timer length:</span>
      ${[5, 10, 15].map((m) => `<button type="button" class="pill-btn" data-mins="${m}" aria-pressed="${curMins === m}">${m} min</button>`).join('')}
    </div>
    ${all.map((p) => prayerHtml(p, ticked.has(p.id))).join('')}
    <button class="btn block" id="addPrayer">Add a prayer</button><div id="addForm"></div>
    <h2 class="section-h">What I prayed or sensed</h2>
    <textarea id="notes" placeholder="Optional. Write anything God put on your heart.">${esc(S.drafts['pray-prayers'] || '')}</textarea>
    <button class="btn lamp block" id="prayed" style="margin-top:14px">${prayedToday ? 'Save another prayer' : 'I’ve prayed these today'}</button>
    ${prayedToday ? '<p class="small muted" style="text-align:center">You’ve already prayed these today.</p>' : ''}
  </div>`;
  $$('.dur-row .pill-btn', v).forEach((b) => b.onclick = () => {
    S.prayMins = +b.dataset.mins; save();
    $$('.dur-row .pill-btn', v).forEach((x) => x.setAttribute('aria-pressed', x === b));
    paintPrayers();
  });
  bindPrayers(v); bindUpdate(v);
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
    ${updateBanner('New prayers are ready. Unlock the update to see them.')}
    ${praySeg('passages')}
    ${C.scriptures.map((s) => {
      const log = S.prayerLog[s.id] || [];
      const meta = log.length ? `Prayed ${log.length} ${log.length === 1 ? 'time' : 'times'} · last on ${fmtDate(log[log.length - 1] + 'T12:00')}` : 'Not prayed yet';
      return `<a class="row-link" href="#/pray/${s.id}"><div class="card"><div class="grow">
        <h2 class="h3" style="margin:0">${esc(s.ref)}</h2><div class="muted">${esc(s.theme)}</div><div class="meta">${meta}</div></div>${ICON.chev}</div></a>`;
    }).join('')}</div>`;
  bindUpdate(v);
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
let lessonQuery = '';
function viewLessons(v, openId) {
  const tab = openId ? 'lessons' : S.lessonsTab;
  const all = lessonsAll();
  const done = C.checklist.filter((_, i) => S.checklist[i]).length;

  const renderLessonGroups = (q) => {
    const needle = (q || '').trim().toLowerCase();
    const cats = [...C.categories.map((c) => c.id), 'mine'];
    const html = cats.map((cid) => {
      const items = all.filter((l) => (l.cat || 'mine') === cid && (!needle
        || (l.title || '').toLowerCase().includes(needle)
        || (l.body || []).join(' ').toLowerCase().includes(needle)));
      if (!items.length) return '';
      return `<h2 class="section-h">${esc(cid === 'mine' ? 'My lessons' : catName(cid))}</h2>` + items.map((l) => lessonHtml(l, l.id === openId || !!needle)).join('');
    }).join('');
    return html || `<div class="empty"><p>No lessons match “${esc(q)}”.</p></div>`;
  };

  let body = '';
  if (tab === 'lessons') {
    body = `<div class="search-box">${ICON.search}<input type="search" id="lessonSearch" placeholder="Search lessons…" aria-label="Search lessons" value="${esc(lessonQuery)}"></div>
      <button class="btn block" id="addLesson" style="margin-bottom:6px">Add a lesson</button><div id="addForm"></div>
      <div id="lessonGroups">${renderLessonGroups(lessonQuery)}</div>`;
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
  const bindAll = () => $$('details.lesson', v).forEach((d) => bindLesson(d));
  bindAll();
  const sbox = $('#lessonSearch', v);
  if (sbox) sbox.oninput = () => {
    lessonQuery = sbox.value;
    $('#lessonGroups', v).innerHTML = renderLessonGroups(lessonQuery);
    bindAll();
  };
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
function exCardHtml(e) {
  const m = e.meta || {};
  return `<a class="ex-card${e.id === 'hurting' ? ' hurting' : ''}" href="#/heal/${esc(e.id)}">
    <div class="ex-meta-row">
      ${m.badge ? `<span class="ex-badge">${esc(m.badge)}</span>` : ''}
      ${m.duration ? `<span class="ex-dur">${esc(m.duration)}</span>` : ''}
    </div>
    <h2 class="h3">${esc(e.title)}</h2>
    <p class="line">${esc(e.line)}</p>
    ${S.drafts[e.id] ? '<span class="resume">Continue where you left off</span>' : ''}
  </a>`;
}

function viewHeal(v) {
  const all = exercisesAll();
  const filter = S.healFilter || 'all';
  const orderByCat = {
    calm: ['hurting', 'nervous-reset', 'window-tipp', 'ground', 'reach-out'],
    express: ['emotion-map', 'rain', 'expressive-writing', 'empty-chair', 'letter', 'lament'],
    reframe: ['thought-check', 'act-defusion', 'ifs-parts'],
    forgive: ['forgive-other', 'reach-forgive', 'forgive-self'],
  };
  const catList = filter === 'all' ? TH.CATEGORIES : TH.CATEGORIES.filter((c) => c.id === filter);
  const sectionsHtml = catList.map((cat) => {
    const ids = orderByCat[cat.id] || [];
    const items = ids.map((id) => all.find((e) => e.id === id)).filter(Boolean);
    if (!items.length) return '';
    return `<div class="cat-head"><h2 class="section-h" style="margin-bottom:2px">${esc(cat.name)}</h2>
      <p class="small muted" style="margin:0 4px 10px">${esc(cat.sub)}</p></div>
      <div class="ex-grid">${items.map(exCardHtml).join('')}</div>`;
  }).join('');

  const steps = S.steps;
  v.innerHTML = pageTop('Heal', { lede: 'Evidence-based tools for naming emotion, calming your body, forgiving, and moving forward.' }) + `<div class="page">
    <div class="filter-bar" role="group" aria-label="Filter healing tools">
      <button type="button" class="pill-btn" data-f="all" aria-pressed="${filter === 'all'}">All (${all.length})</button>
      ${TH.CATEGORIES.map((c) => `<button type="button" class="pill-btn" data-f="${esc(c.id)}" aria-pressed="${filter === c.id}">${esc(c.name)}</button>`).join('')}
    </div>
    ${sectionsHtml}

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

  $$('.filter-bar .pill-btn', v).forEach((b) => b.onclick = () => { S.healFilter = b.dataset.f; save(); route(); });
  $$('.step-item input', v).forEach((c) => c.onchange = () => { S.steps.find((s) => s.id === c.dataset.id).done = c.checked; save(); route(); });
  $$('[data-del]', v).forEach((b) => b.onclick = (e) => { e.preventDefault(); S.steps = S.steps.filter((s) => s.id !== b.dataset.del); save(); route(); });
  $('#addStep').onsubmit = (e) => {
    e.preventDefault(); const t = $('#stepText').value.trim(); if (!t) return;
    S.steps.push({ id: uid(), text: t, date: new Date().toISOString(), done: false }); save(); route();
  };
}

/* Interactive Somatic Body Map SVG markup */
function bodyMapHtml(val) {
  const zones = new Set(val?.zones || []);
  const sens = new Set(val?.sensations || []);
  const svgZones = TH.BODY_ZONES.map((z) => {
    const on = zones.has(z.id);
    if (z.twin) {
      return `<g class="bz${on ? ' on' : ''}" data-z="${esc(z.id)}" tabindex="0" role="button" aria-label="${esc(z.label)}" aria-pressed="${on}">
        ${z.twin.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${z.r}"/>`).join('')}
      </g>`;
    }
    return `<g class="bz${on ? ' on' : ''}" data-z="${esc(z.id)}" tabindex="0" role="button" aria-label="${esc(z.label)}" aria-pressed="${on}">
      <circle cx="${z.cx}" cy="${z.cy}" r="${z.r}"/>
    </g>`;
  }).join('');

  return `<div class="bodymap-wrap">
    <svg class="bodymap-svg" viewBox="0 0 200 320" role="img" aria-label="Body map — tap areas where you feel emotion">
      <path class="body-outline" d="M100 14c13 0 22 10 22 23 0 11-6 19-12 23v12l28 11c11 4 17 14 19 28l9 72c1 8-4 13-11 13-6 0-11-4-12-11l-7-55-4 58 9 102c1 10-5 16-14 16-8 0-14-6-15-15l-8-76h-8l-8 76c-1 9-7 15-15 15-9 0-15-6-14-16l9-102-4-58-7 55c-1 7-6 11-12 11-7 0-12-5-11-13l9-72c2-14 8-24 19-28l28-11V60c-6-4-12-12-12-23 0-13 9-23 22-23Z"/>
      ${svgZones}
    </svg>
    <div class="bodymap-list">
      <p class="small muted" style="margin:0 0 8px">Or tap a region:</p>
      <div class="chips">${TH.BODY_ZONES.map((z) =>
        `<button type="button" class="chip toggle-chip" data-zb="${esc(z.id)}" aria-pressed="${zones.has(z.id)}">${esc(z.label)}</button>`).join('')}</div>
    </div>
  </div>
  <p class="small muted" style="margin:12px 0 6px">What does it feel like physically?</p>
  <div class="chips">${TH.BODY_SENSATIONS.map((s) =>
    `<button type="button" class="chip toggle-chip" data-sens="${esc(s)}" aria-pressed="${sens.has(s)}">${esc(s)}</button>`).join('')}</div>`;
}

/* Interactive Affect Labeling & EFT Emotion Picker */
function emotionsPickerHtml(val) {
  const picked = new Set(val?.words || []);
  const activeFam = val?.activeFam || TH.EMOTION_FAMILIES[0]?.id;
  const fam = TH.EMOTION_FAMILIES.find((f) => f.id === activeFam) || TH.EMOTION_FAMILIES[0];
  return `<div class="emo-tabs" role="tablist">
      ${TH.EMOTION_FAMILIES.map((f) => `<button type="button" class="pill-btn tone-${esc(f.tone)}" data-efam="${esc(f.id)}" aria-pressed="${f.id === fam.id}">${esc(f.name)}</button>`).join('')}
    </div>
    <div class="card emo-panel">
      <p class="eyebrow">Surface / protective feelings</p>
      <div class="chips">${fam.surface.map((w) =>
        `<button type="button" class="chip toggle-chip" data-ew="${esc(w)}" aria-pressed="${picked.has(w)}">${esc(w)}</button>`).join('')}</div>
      <p class="eyebrow" style="margin-top:14px">Deeper primary feelings underneath</p>
      <p class="small muted" style="margin:-4px 0 8px">In Emotion-Focused Therapy, anger or numbness often guards a softer, vulnerable hurt beneath.</p>
      <div class="chips">${fam.primary.map((w) =>
        `<button type="button" class="chip toggle-chip deep" data-ew="${esc(w)}" aria-pressed="${picked.has(w)}">${esc(w)}</button>`).join('')}</div>
    </div>
    <div class="emo-picked" id="emoPicked">${picked.size ? `<strong>Named:</strong> ${[...picked].map(esc).join(' · ')}` : '<span class="muted">Tap any words that ring true — you can mix across families.</span>'}</div>`;
}

function viewExercise(v, id) {
  const ex = findExercise(id);
  if (!ex) { location.hash = '#/heal'; return; }
  const d = (S.drafts[id] ||= { step: 0, f: {} });
  if (d.step >= ex.steps.length) d.step = 0;
  const total = ex.steps.length;
  const countDone = {};
  const waitStep = ex.steps.find((s) => s.type === 'wait');
  const waitLeft = () => (waitStep && d.f[waitStep.key] ? Math.max(0, d.f[waitStep.key] - Date.now()) : 0);

  const render = () => {
    clearTimers();
    const st = ex.steps[d.step];
    const name = (d.f.name || '').trim() || 'them';
    const T = (s) => esc(s).replaceAll('{name}', esc(name));
    const last = d.step === total - 1;
    let inner = '';
    if (d.step === 0 && ex.meta?.why) {
      inner += `<details class="why-box"><summary>${esc(ex.meta.badge || 'Evidence-based')} · Why this works</summary><p>${esc(ex.meta.why)}</p></details>`;
    }
    inner += `<h2>${T(st.title)}</h2>`;
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
      : `<button class="btn lamp block" id="choose" style="margin-top:8px">${T(st.button)}</button>`;
    if (st.type === 'check') inner += st.items.map((it, i) => `<label class="check"><input type="checkbox" data-i="${i}"${(d.f[st.key] || []).includes(i) ? ' checked' : ''}><span>${esc(it)}</span></label>`).join('')
      + `<p class="after" id="after"${(d.f[st.key] || []).length ? '' : ' hidden'}>${esc(st.after)}</p>`;

    if (st.type === 'breathe') {
      const modeKey = d.f._breathMode || st.defaultMode || 'box';
      const mode = TH.BREATH_MODES[modeKey] || TH.BREATH_MODES.box;
      inner += `<div class="seg" role="group" aria-label="Breathing rhythm">
          ${Object.entries(TH.BREATH_MODES).map(([k, m]) =>
            `<button type="button" data-bmode="${k}" aria-pressed="${k === modeKey}">${esc(m.name)}</button>`).join('')}
        </div>
        <p class="small muted" style="text-align:center;margin:-6px 0 8px" id="bNote">${esc(mode.note)}</p>
        <div class="breath"><div class="orb" id="orb"></div><div class="say" id="say">Ready</div><div class="breath-sub" id="bRound">Round 1</div></div>`;
      if (findExercise('ground') && id !== 'nervous-reset') inner += `<a class="link alt-ex" href="#/heal/ground">Or try grounding: 5, 4, 3, 2, 1</a>`;
    }

    if (st.type === 'bilateral') {
      const pace = d.f._pace || 1100;
      inner += `<div class="butterfly-box">
          <div class="bf-stage">
            <div class="bf-pad" id="bfLeft"><span>Left</span></div>
            <div class="bf-heart" aria-hidden="true">✦</div>
            <div class="bf-pad" id="bfRight"><span>Right</span></div>
          </div>
          <p class="bf-status" id="bfStatus">Cross arms over chest · Tap Start when ready</p>
          <div class="bf-controls">
            <button type="button" class="btn primary" id="bfToggle">Start gentle taps</button>
            <button type="button" class="btn" id="bfSound" aria-pressed="false">${ICON.sound}<span>Sound off</span></button>
          </div>
          <div class="dur-row" style="justify-content:center;margin-top:12px" role="group" aria-label="Tap speed">
            <span class="small muted">Pace:</span>
            ${[['Slow', 1400], ['Steady', 1100], ['Gentle', 850]].map(([lbl, ms]) =>
              `<button type="button" class="pill-btn" data-pace="${ms}" aria-pressed="${pace === ms}">${lbl}</button>`).join('')}
          </div>
        </div>`;
    }

    if (st.type === 'emotions') {
      inner += emotionsPickerHtml(d.f[st.key]);
    }

    if (st.type === 'bodymap') {
      inner += bodyMapHtml(d.f[st.key]);
    }

    if (st.type === 'timedwrite') {
      const mins = d.f._twMins || st.defaultMinutes || 10;
      const text = d.f[st.key] || '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      inner += `<div class="tw-bar">
          <div class="dur-row" style="margin:0" role="group" aria-label="Writing time">
            ${(st.options || [5, 10, 15]).map((m) =>
              `<button type="button" class="pill-btn" data-twm="${m}" aria-pressed="${mins === m}">${m} min</button>`).join('')}
          </div>
          <div class="tw-right">
            <span class="tw-clock" id="twClock">${mins}:00</span>
            <button type="button" class="btn primary tw-btn" id="twStart">Start</button>
          </div>
        </div>
        <textarea id="fld" class="tall" placeholder="${esc(st.placeholder || '')}">${esc(text)}</textarea>
        <p class="small muted" id="twWords" style="margin:6px 2px 0">${words} ${words === 1 ? 'word' : 'words'} · Keep moving, don’t edit</p>`;
    }

    if (st.type === 'defuse') {
      const raw = (d.f[st.sourceKey] || '').trim() || 'I am not enough';
      const val = (d.f[st.key] ||= { tapped: [], story: '' });
      const layers = [
        { k: 0, label: '1. The hooked thought', text: `“${raw}”` },
        { k: 1, label: '2. Name it as a thought', text: `“I am having the thought that ${raw.charAt(0).toLowerCase() + raw.slice(1)}.”` },
        { k: 2, label: '3. Notice yourself noticing', text: `“I notice my mind is offering the thought that ${raw.charAt(0).toLowerCase() + raw.slice(1)}.”` },
      ];
      inner += `<div class="defuse-stack">${layers.map((L) => {
        const on = (val.tapped || []).includes(L.k);
        return `<button type="button" class="defuse-card" data-dk="${L.k}" aria-pressed="${on}">
          <span class="eyebrow">${esc(L.label)}</span>
          <p class="defuse-txt">${esc(L.text)}</p>
          <span class="small muted">${on ? '✓ Read aloud' : 'Tap after reading slowly'}</span>
        </button>`;
      }).join('')}</div>
      <label class="field" style="margin-top:14px"><span>4. Name the recurring story (optional)</span>
        <input type="text" id="defStory" value="${esc(val.story || '')}" placeholder="e.g. “There’s the ‘I ruined it’ radio station again”"></label>`;
    }

    if (st.type === 'values') {
      const picked = new Set(d.f[st.key] || []);
      inner += `<div class="values-grid">${st.items.map((item) =>
        `<button type="button" class="val-card" data-v="${esc(item)}" aria-pressed="${picked.has(item)}">${esc(item)}</button>`).join('')}</div>`;
    }

    if (st.type === 'window') {
      const cur = d.f[st.key] || '';
      inner += `<div class="window-stack">${TH.WINDOW_ZONES.map((z) => {
        const on = cur === z.id;
        return `<button type="button" class="win-card tone-${esc(z.tone)}" data-wz="${esc(z.id)}" aria-pressed="${on}">
          <div class="win-head"><strong>${esc(z.title)}</strong><span class="ex-badge">${esc(z.tag)}</span></div>
          <p class="small muted" style="margin:6px 0 0">${esc(z.signs)}</p>
          ${on ? `<div class="win-guide"><p style="margin:0 0 8px">${esc(z.guidance)}</p>
            <div class="rec-row">${z.links.map((lid) => findExercise(lid)).filter(Boolean).map((e) =>
              `<a class="rec-pill" href="#/heal/${esc(e.id)}"><span>Try: ${esc(e.title)}</span></a>`).join('')}</div></div>` : ''}
        </button>`;
      }).join('')}</div>`;
    }

    if (st.type === 'chair') {
      const val = (d.f[st.key] ||= { speak: '', reply: '', tab: 'speak' });
      const active = val.tab || 'speak';
      inner += `<div class="seg" role="group" aria-label="Chair perspective">
          <button type="button" data-ctab="speak" aria-pressed="${active === 'speak'}">Speak to ${esc(name)}</button>
          <button type="button" data-ctab="reply" aria-pressed="${active === 'reply'}">Step back / Closure</button>
        </div>
        <p class="small muted" style="margin:-6px 0 10px">${active === 'speak'
          ? `Say everything directly to ${esc(name)}. Don’t hold back or polish it.`
          : `Now step into a calm, wise chair. What truth, closure, or boundary would you speak back?`}</p>
        <textarea id="chairTxt" class="tall" placeholder="${active === 'speak' ? `What I never got to say to ${esc(name)} is…` : 'The honest closure I need to hear is…'}">${esc(val[active] || '')}</textarea>`;
    }

    if (st.type === 'scale') inner += `<div class="scale" role="group" aria-label="${esc(st.title)}">${Array.from({ length: 11 }, (_, n) =>
      `<button type="button" data-n="${n}" aria-pressed="${d.f[st.key] === n}">${n}</button>`).join('')}</div>
      <div class="scale-ends"><span>${esc(st.lowLabel || 'Not at all')}</span><span>${esc(st.highLabel || 'Completely')}</span></div>`;

    if (st.type === 'count') {
      const got = countDone[d.step] || 0;
      inner += `<div class="count-dots">${Array.from({ length: st.n }, (_, n) =>
        `<button type="button" data-n="${n}" aria-pressed="${n < got}" aria-label="Noticed ${n + 1}"></button>`).join('')}</div>`;
    }
    if (st.type === 'wait') inner += waitLeft() > 0
      ? `<p class="chosen">${ICON.tick.replace('<svg', '<svg width="22" height="22" style="stroke:currentColor;fill:none;stroke-width:2.5"')} Started. Keep going while the time runs.</p>`
      : d.f[st.key] ? '<p class="chosen">The ten minutes are up.</p>'
      : `<button class="btn lamp block" id="startWait" style="margin-top:8px">${esc(st.button)}</button>`;
    if (st.lessons?.length) inner += `<div class="ex-lessons">${st.lessons.map((lid) => C.lessons.find((l) => l.id === lid)).filter(Boolean)
      .map((l) => `<a class="link" href="#/lessons/${encodeURIComponent(l.id)}">Read your lesson: ${esc(l.title)}</a>`).join('')}</div>`;
    if (st.verse) inner += verseCard(st.verse);
    if (st.type === 'release' && waitLeft() > 0) inner += `<p class="after">You still have <span class="wait-left">${fmtLeft(waitLeft())}</span> of your ten minutes. Don’t send anything yet.</p>`;

    const nextLabel = last ? 'Finish'
      : (st.optional && !(d.f[st.key] || '').trim()) || (st.type === 'wait' && !d.f[st.key]) ? 'Skip'
      : 'Next';
    const nav = st.type === 'release'
      ? `<div class="flow-nav"><button class="btn" id="keep">${esc(st.keepLabel || 'Keep in my journal')}</button><button class="btn lamp" id="letgo">${esc(st.letgoLabel || 'Let it go')}</button></div>
         <div class="flow-nav" style="margin-top:8px"><button class="btn ghost" id="prev">Back</button></div>`
      : `<div class="flow-nav">${d.step > 0 ? '<button class="btn" id="prev">Back</button>' : ''}
         <button class="btn primary" id="next">${nextLabel}</button></div>`;

    v.innerHTML = `<div class="flow-top"><div class="flow-top-inner">
        <button class="icon-btn" id="close" aria-label="Close and save for later">${ICON.close}</button>
        <span class="count">${esc(ex.title)} · Step ${d.step + 1} of ${total}${waitLeft() > 0 ? ` · <span class="wait-left">${fmtLeft(waitLeft())}</span> to wait` : ''}</span></div>
        <div class="bar"><i style="width:${((d.step + 1) / total) * 100}%"></i></div></div>
      <div class="flow" id="flow">${inner}${nav}</div>`;

    /* Bind field */
    const fld = $('#fld');
    if (fld) {
      fld.oninput = () => {
        d.f[st.key] = fld.value; saveSoon();
        if (st.optional && $('#next')) $('#next').textContent = last ? 'Finish' : fld.value.trim() ? 'Next' : 'Skip';
        if (st.type === 'timedwrite') {
          const w = fld.value.trim() ? fld.value.trim().split(/\s+/).length : 0;
          if ($('#twWords')) $('#twWords').textContent = `${w} ${w === 1 ? 'word' : 'words'} · Keep moving, don’t edit`;
        }
      };
      $$('.chip', v).forEach((c) => {
        if (c.classList.contains('toggle-chip')) return;
        c.onclick = () => {
          fld.value = st.short ? c.textContent : (fld.value.trim() ? fld.value.trim() + '\n' : '') + c.textContent;
          fld.oninput(); fld.focus();
        };
      });
    }

    if ($('#choose')) $('#choose').onclick = () => { d.f[st.key] = new Date().toISOString(); save(); render(); };
    $$('.check input', v).forEach((c) => c.onchange = () => {
      d.f[st.key] = $$('.check input', v).filter((x) => x.checked).map((x) => +x.dataset.i);
      $('#after').hidden = !d.f[st.key].length; saveSoon();
    });

    /* Bind multi-mode breathing */
    if (st.type === 'breathe') {
      const startBreathe = (mKey) => {
        clearTimers();
        const mode = TH.BREATH_MODES[mKey] || TH.BREATH_MODES.box;
        if ($('#bNote')) $('#bNote').textContent = mode.note;
        let idx = 0, round = 1;
        const stepPhase = () => {
          const orb = $('#orb'), say = $('#say'), rd = $('#bRound');
          if (!orb || !say) return;
          const [label, size, ms] = mode.phases[idx % mode.phases.length];
          orb.style.transitionDuration = `${Math.max(0.8, ms / 1000)}s`;
          orb.classList.remove('mid', 'big', 'small');
          orb.classList.add(size);
          say.textContent = label;
          if (rd) rd.textContent = `Round ${round}`;
          idx++;
          if (idx % mode.phases.length === 0) round++;
          timers.push(setTimeout(stepPhase, ms));
        };
        stepPhase();
      };
      $$('[data-bmode]', v).forEach((b) => b.onclick = () => {
        d.f._breathMode = b.dataset.bmode; saveSoon();
        $$('[data-bmode]', v).forEach((x) => x.setAttribute('aria-pressed', x === b));
        startBreathe(b.dataset.bmode);
      });
      startBreathe(d.f._breathMode || st.defaultMode || 'box');
    }

    /* Bind EMDR Butterfly Hug bilateral stimulation */
    if (st.type === 'bilateral') {
      let running = false, soundOn = false, side = 'left', taps = 0, bfTimer = null;
      const stopBf = () => {
        running = false; clearInterval(bfTimer); bfTimer = null;
        $('#bfLeft')?.classList.remove('active'); $('#bfRight')?.classList.remove('active');
        if ($('#bfToggle')) $('#bfToggle').textContent = taps ? 'Resume taps' : 'Start gentle taps';
        if ($('#bfStatus')) $('#bfStatus').textContent = taps ? `Paused · ${Math.floor(taps / 2)} gentle cycles done` : 'Cross arms over chest · Tap Start when ready';
      };
      const tickBf = () => {
        const L = $('#bfLeft'), R = $('#bfRight'), stEl = $('#bfStatus');
        if (!L || !R) { stopBf(); return; }
        L.classList.toggle('active', side === 'left');
        R.classList.toggle('active', side === 'right');
        taps++;
        d.f[st.key] = Math.floor(taps / 2);
        if (stEl) stEl.textContent = `${side === 'left' ? 'Tap left shoulder' : 'Tap right shoulder'} · Cycle ${Math.max(1, Math.ceil(taps / 2))}`;
        if (soundOn) softTapTone(side);
        if (navigator.vibrate) try { navigator.vibrate(18); } catch {}
        side = side === 'left' ? 'right' : 'left';
      };
      const startBf = () => {
        clearInterval(bfTimer);
        running = true;
        if (soundOn) ensureAudio();
        if ($('#bfToggle')) $('#bfToggle').textContent = 'Pause';
        tickBf();
        bfTimer = setInterval(tickBf, d.f._pace || 1100);
        timers.push(bfTimer);
      };
      $('#bfToggle').onclick = () => running ? stopBf() : startBf();
      $('#bfSound').onclick = (e) => {
        soundOn = !soundOn;
        if (soundOn) ensureAudio();
        e.currentTarget.setAttribute('aria-pressed', soundOn);
        $('span', e.currentTarget).textContent = soundOn ? 'Sound on' : 'Sound off';
      };
      $$('[data-pace]', v).forEach((b) => b.onclick = () => {
        d.f._pace = +b.dataset.pace; saveSoon();
        $$('[data-pace]', v).forEach((x) => x.setAttribute('aria-pressed', x === b));
        if (running) startBf();
      });
    }

    /* Bind Affect Labeling emotions picker */
    if (st.type === 'emotions') {
      const val = (d.f[st.key] ||= { activeFam: TH.EMOTION_FAMILIES[0]?.id, words: [] });
      $$('[data-efam]', v).forEach((b) => b.onclick = () => {
        val.activeFam = b.dataset.efam; saveSoon(); render();
      });
      $$('[data-ew]', v).forEach((b) => b.onclick = () => {
        const w = b.dataset.ew;
        const set = new Set(val.words || []);
        set.has(w) ? set.delete(w) : set.add(w);
        val.words = [...set]; saveSoon();
        b.setAttribute('aria-pressed', set.has(w));
        $('#emoPicked').innerHTML = set.size ? `<strong>Named:</strong> ${[...set].map(esc).join(' · ')}` : '<span class="muted">Tap any words that ring true — you can mix across families.</span>';
      });
    }

    /* Bind Somatic Body Map */
    if (st.type === 'bodymap') {
      const val = (d.f[st.key] ||= { zones: [], sensations: [] });
      const toggleZone = (zid) => {
        const set = new Set(val.zones || []);
        set.has(zid) ? set.delete(zid) : set.add(zid);
        val.zones = [...set]; saveSoon();
        $$(`[data-z="${CSS.escape(zid)}"]`, v).forEach((el) => { el.classList.toggle('on', set.has(zid)); el.setAttribute('aria-pressed', set.has(zid)); });
        $$(`[data-zb="${CSS.escape(zid)}"]`, v).forEach((el) => el.setAttribute('aria-pressed', set.has(zid)));
      };
      $$('[data-z]', v).forEach((g) => {
        g.onclick = () => toggleZone(g.dataset.z);
        g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleZone(g.dataset.z); } };
      });
      $$('[data-zb]', v).forEach((b) => b.onclick = () => toggleZone(b.dataset.zb));
      $$('[data-sens]', v).forEach((b) => b.onclick = () => {
        const s = b.dataset.sens, set = new Set(val.sensations || []);
        set.has(s) ? set.delete(s) : set.add(s);
        val.sensations = [...set]; saveSoon();
        b.setAttribute('aria-pressed', set.has(s));
      });
    }

    /* Bind Pennebaker Timed Writing */
    if (st.type === 'timedwrite') {
      let leftMs = (d.f._twMins || st.defaultMinutes || 10) * 60e3;
      let running = false, iv = null;
      const paintTw = () => { if ($('#twClock')) $('#twClock').textContent = fmtLeft(leftMs); };
      const stopTw = () => { running = false; clearInterval(iv); iv = null; if ($('#twStart')) $('#twStart').textContent = leftMs > 0 ? 'Start' : 'Done'; };
      $$('[data-twm]', v).forEach((b) => b.onclick = () => {
        stopTw();
        d.f._twMins = +b.dataset.twm; leftMs = d.f._twMins * 60e3; saveSoon();
        $$('[data-twm]', v).forEach((x) => x.setAttribute('aria-pressed', x === b));
        paintTw();
      });
      $('#twStart').onclick = () => {
        if (running) { stopTw(); return; }
        if (leftMs <= 0) leftMs = (d.f._twMins || 10) * 60e3;
        ensureAudio();
        running = true; $('#twStart').textContent = 'Pause'; $('#fld')?.focus();
        iv = setInterval(() => {
          leftMs = Math.max(0, leftMs - 1000);
          paintTw();
          if (leftMs <= 0) {
            stopTw(); chime();
            toast('Time is up. Take a slow breath.');
          }
        }, 1000);
        timers.push(iv);
      };
    }

    /* Bind ACT Defusion */
    if (st.type === 'defuse') {
      const val = (d.f[st.key] ||= { tapped: [], story: '' });
      $$('[data-dk]', v).forEach((b) => b.onclick = () => {
        const k = +b.dataset.dk, set = new Set(val.tapped || []);
        set.has(k) ? set.delete(k) : set.add(k);
        val.tapped = [...set]; saveSoon();
        b.setAttribute('aria-pressed', set.has(k));
        $('.small', b).textContent = set.has(k) ? '✓ Read aloud' : 'Tap after reading slowly';
      });
      if ($('#defStory')) $('#defStory').oninput = (e) => { val.story = e.target.value; saveSoon(); };
    }

    /* Bind ACT Values */
    if (st.type === 'values') {
      $$('[data-v]', v).forEach((b) => b.onclick = () => {
        const item = b.dataset.v, set = new Set(d.f[st.key] || []);
        if (set.has(item)) set.delete(item);
        else if (set.size < 3) set.add(item);
        else { toast('Choose up to 3 core values for today.'); return; }
        d.f[st.key] = [...set]; saveSoon();
        b.setAttribute('aria-pressed', set.has(item));
      });
    }

    /* Bind Window of Tolerance */
    if (st.type === 'window') {
      $$('[data-wz]', v).forEach((b) => b.onclick = (e) => {
        if (e.target.closest('a')) return;
        d.f[st.key] = b.dataset.wz; save(); render();
      });
    }

    /* Bind Gestalt Empty Chair */
    if (st.type === 'chair') {
      const val = (d.f[st.key] ||= { speak: '', reply: '', tab: 'speak' });
      $$('[data-ctab]', v).forEach((b) => b.onclick = () => { val.tab = b.dataset.ctab; saveSoon(); render(); });
      if ($('#chairTxt')) $('#chairTxt').oninput = (e) => { val[val.tab || 'speak'] = e.target.value; saveSoon(); };
    }

    $$('.scale button', v).forEach((b) => b.onclick = () => {
      d.f[st.key] = +b.dataset.n; saveSoon();
      $$('.scale button', v).forEach((x) => x.setAttribute('aria-pressed', x === b));
    });
    $$('.count-dots button', v).forEach((b) => b.onclick = () => {
      const n = +b.dataset.n, got = countDone[d.step] || 0;
      countDone[d.step] = n < got ? n : n + 1;
      $$('.count-dots button', v).forEach((x) => x.setAttribute('aria-pressed', +x.dataset.n < countDone[d.step]));
      if (countDone[d.step] === st.n) $('#next').focus();
    });
    if ($('#startWait')) $('#startWait').onclick = () => { d.f[st.key] = Date.now() + st.minutes * 60e3; save(); render(); };
    if (waitLeft() > 0) timers.push(setInterval(() => {
      $$('.wait-left', v).forEach((el) => { el.textContent = fmtLeft(waitLeft()); });
      if (waitLeft() > 0) return;
      clearTimers(); toast('Your ten minutes are up. Well done for waiting.');
      if (st.type === 'wait' || st.type === 'release') render();
      else $('.flow-top .count').textContent = `${ex.title} · Step ${d.step + 1} of ${total}`;
    }, 1000));

    $('#close').onclick = () => {
      const started = Object.keys(d.f).length || d.step > 0;
      if (!started) delete S.drafts[id];
      save(); location.hash = '#/heal'; if (started) toast('Saved. You can continue later.');
    };
    if ($('#prev')) $('#prev').onclick = () => { if (d.step > 0) { d.step--; save(); render(); window.scrollTo(0, 0); } };
    if ($('#next')) $('#next').onclick = () => {
      if (st.key === 'name' && !(d.f.name || '').trim()) { toast('Write a name or word to continue.'); return; }
      if (last) return finish(true);
      d.step++; save(); render(); window.scrollTo(0, 0);
    };
    if ($('#keep')) $('#keep').onclick = () => finish(true);
    if ($('#letgo')) $('#letgo').onclick = () => { $('#flow').classList.add('letting-go'); timers.push(setTimeout(() => finish(false), 1700)); };
  };

  const finish = (keep) => {
    const name = (d.f.name || '').trim();
    const fields = [];
    const collectedEmotions = [];

    for (const st of ex.steps) {
      const val = d.f[st.key];
      const label = st.title.replaceAll('{name}', name || 'them');
      if (st.type === 'field' && st.key !== 'name' && st.key !== 'to' && (val || '').trim()) fields.push({ label, text: val.trim() });
      if (st.type === 'timedwrite' && (val || '').trim()) fields.push({ label, text: val.trim() });
      if (st.type === 'choose' && val) fields.push({ label, text: st.body.join(' ').replaceAll('{name}', name || 'them') });
      if (st.type === 'check' && val?.length) fields.push({ label, text: val.map((i) => '• ' + st.items[i]).join('\n') });
      if (st.type === 'scale' && typeof val === 'number') fields.push({ label, text: `${val} out of 10` });
      if (st.type === 'emotions' && val?.words?.length) {
        collectedEmotions.push(...val.words);
        fields.push({ label, text: val.words.join(', ') });
      }
      if (st.type === 'bodymap' && (val?.zones?.length || val?.sensations?.length)) {
        const zNames = (val.zones || []).map((zid) => TH.BODY_ZONES.find((z) => z.id === zid)?.label || zid);
        const parts = [
          zNames.length ? `Where: ${zNames.join(', ')}` : '',
          val.sensations?.length ? `Felt like: ${val.sensations.join(', ')}` : '',
        ].filter(Boolean);
        fields.push({ label, text: parts.join('\n') });
      }
      if (st.type === 'bilateral' && typeof val === 'number' && val > 0) {
        fields.push({ label, text: `Completed ${val} alternating Butterfly Hug ${val === 1 ? 'cycle' : 'cycles'}.` });
      }
      if (st.type === 'defuse' && (val?.story || val?.tapped?.length)) {
        const raw = (d.f[st.sourceKey] || '').trim();
        const lines = [raw ? `Stepped back from: “${raw}”` : '', val.story ? `Story name: ${val.story.trim()}` : ''].filter(Boolean);
        if (lines.length) fields.push({ label, text: lines.join('\n') });
      }
      if (st.type === 'values' && val?.length) fields.push({ label, text: val.join(' · ') });
      if (st.type === 'window' && val) {
        const z = TH.WINDOW_ZONES.find((x) => x.id === val);
        if (z) fields.push({ label, text: z.title });
      }
      if (st.type === 'chair' && (val?.speak?.trim() || val?.reply?.trim())) {
        if (val.speak?.trim()) fields.push({ label: `Spoken to ${name || 'the chair'}`, text: val.speak.trim() });
        if (val.reply?.trim()) fields.push({ label: 'Wiser closure / response', text: val.reply.trim() });
      }
    }

    const thought = (d.f.thought || '').trim();
    const titles = {
      'forgive-other': `Forgiving ${name || 'someone'}`,
      'reach-forgive': `REACH Forgiveness: ${name || 'someone'}`,
      'forgive-self': 'Forgiving myself',
      letter: `Letter to ${(d.f.to || '').trim() || 'someone'}`,
      'empty-chair': `Empty chair: ${name || 'unfinished conversation'}`,
      hurting: 'When I was hurting',
      lament: 'My lament',
      'thought-check': thought ? `Checking “${thought.length > 40 ? thought.slice(0, 40) + '…' : thought}”` : 'Checking a thought',
      'act-defusion': thought ? `Unhooking from “${thought.length > 36 ? thought.slice(0, 36) + '…' : thought}”` : 'Unhooking from a thought',
      'reach-out': 'I didn’t send it',
      'emotion-map': collectedEmotions.length ? `Named: ${collectedEmotions.slice(0, 3).join(', ')}` : 'Named what I feel',
      'nervous-reset': 'Calmed my nervous system',
      'window-tipp': 'Window of Tolerance & TIPP',
      rain: 'RAIN self-compassion',
      'expressive-writing': 'Raw expressive writing',
      'ifs-parts': d.f.part?.trim() ? `Parts dialogue: ${d.f.part.trim()}` : 'Talked with a hurting part',
    };
    const rel = ex.steps.find((s) => s.type === 'release') || {};
    const ratingMeta = (typeof d.f.before === 'number' && typeof d.f.after === 'number')
      ? { before: d.f.before, after: d.f.after } : undefined;

    if (ex.nojournal) { /* nothing worth keeping */ }
    else if (keep) addJournal({
      type: 'exercise', ex: ex.id, title: titles[ex.id] || ex.title,
      emotions: collectedEmotions.length ? [...new Set(collectedEmotions)] : undefined,
      rating: ratingMeta, fields,
    });
    else addJournal({
      type: 'exercise', ex: ex.id, title: rel.letgoTitle || 'I let a letter go',
      fields: [{ label: '', text: rel.letgoText || 'You gave this letter to God and let it go.' }],
    });

    const stepField = ex.steps.find((s) => s.progress);
    if (stepField && (d.f[stepField.key] || '').trim()) {
      S.steps.push({ id: uid(), text: d.f[stepField.key].trim(), date: new Date().toISOString(), done: false });
    }
    const moved = typeof d.f.before === 'number' && typeof d.f.after === 'number' && d.f.before !== d.f.after;
    const scaleName = ex.scaleLabel || (ex.id === 'thought-check' ? 'The thought' : 'Distress');
    const beforeVal = d.f.before, afterVal = d.f.after;
    delete S.drafts[id]; save();
    clearTimers();
    const lam = verse('lam-3-22');
    v.innerHTML = `<div class="flow done"><div class="glow"></div>
      <h2>${ex.nojournal ? 'You came back to now.' : keep ? 'Saved to your journal' : esc(rel.letgoDone || 'Let go. It’s in God’s hands now.')}</h2>
      ${moved ? `<p class="lede">${esc(scaleName)} moved from ${beforeVal} to ${afterVal} out of 10.</p>` : ''}
      ${lam ? `<div class="verse-card" style="text-align:left"><p>${esc(lam.text)}</p><p class="ref">${esc(lam.ref)}</p></div>` : ''}
      <div class="flow-nav"><a class="btn" href="#/heal">Back to Heal</a>${keep && !ex.nojournal ? '<a class="btn primary" href="#/journal">Open journal</a>' : ''}</div></div>`;
  };

  render();
}

/* ---------------- Journal ---------------- */
let journalQuery = '';
function typeLabel(e) {
  if (e.type === 'prayer') return 'Prayer';
  if (e.type === 'note') return 'Journal';
  if (e.type === 'checkin') return 'Heart check-in';
  return findExercise(e.ex)?.title || 'Healing';
}

function journalInsightsHtml() {
  if (S.journal.length < 2) return '';
  const rated = S.journal.filter((e) => e.rating && typeof e.rating.before === 'number' && typeof e.rating.after === 'number');
  const avgDrop = rated.length ? rated.reduce((acc, e) => acc + (e.rating.before - e.rating.after), 0) / rated.length : null;
  const emoCounts = {};
  for (const e of S.journal) for (const w of (e.emotions || [])) emoCounts[w] = (emoCounts[w] || 0) + 1;
  const topEmos = Object.entries(emoCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
  return `<section class="card insights-card">
    <p class="eyebrow">Your healing pattern</p>
    <div class="insights-grid">
      <div class="ins-stat"><strong>${S.journal.length}</strong><span>Reflections saved</span></div>
      <div class="ins-stat"><strong>${S.prayedDays.length}</strong><span>Days prayed</span></div>
      ${avgDrop !== null ? `<div class="ins-stat"><strong>${avgDrop >= 0 ? '−' : '+'}${Math.abs(avgDrop).toFixed(1)}</strong><span>Avg distress shift</span></div>` : ''}
    </div>
    ${topEmos.length ? `<p class="small muted" style="margin:10px 0 0">Most named lately: ${topEmos.map((w) => `<span class="tag" style="margin-left:4px">${esc(w)}</span>`).join('')}</p>` : ''}
  </section>`;
}

function viewJournal(v) {
  const filter = S.journalFilter || 'all';
  const filters = [
    ['all', 'All'], ['exercise', 'Healing'], ['prayer', 'Prayers'], ['checkin', 'Check-ins'], ['note', 'Notes'],
  ];

  const renderList = (q) => {
    const needle = (q || '').trim().toLowerCase();
    const filtered = S.journal.filter((e) => {
      if (filter !== 'all' && e.type !== filter) return false;
      if (!needle) return true;
      const hay = [e.title, typeLabel(e), ...(e.emotions || []), ...(e.fields || []).map((f) => `${f.label} ${f.text}`)].join(' ').toLowerCase();
      return hay.includes(needle);
    });
    if (!filtered.length) {
      return S.journal.length
        ? `<div class="empty"><p>No matching entries here.</p></div>`
        : `<div class="empty"><h2 class="h3">Your journal is empty</h2><p>Prayers, check-ins, therapy exercises and anything you write will be kept here, on this phone only.</p>
           <a class="btn primary" href="#/journal/new">Write your first entry</a></div>`;
    }
    const groups = {};
    for (const e of filtered) (groups[fmtDate(e.date, { month: 'long', year: 'numeric' })] ||= []).push(e);
    return Object.entries(groups).map(([m, es]) => `<h2 class="section-h">${esc(m)}</h2><div class="list">${es.map((e) => {
      const snip = e.fields?.map((f) => f.text).join(' · ') || '';
      const shift = e.rating ? `<span class="tag">${e.rating.before}→${e.rating.after}/10</span>` : '';
      return `<a class="row-link" href="#/journal/${e.id}"><div class="card entry"><div class="grow">
        <span class="type">${esc(typeLabel(e))}</span>${shift}
        <h3 class="h3" style="margin:2px 0 0">${esc(e.title || 'Untitled')}</h3>
        ${snip ? `<p class="snip">${esc(snip)}</p>` : ''}
        <div class="meta">${fmtDate(e.date)} · ${fmtTime(e.date)}</div></div>${ICON.chev}</div></a>`;
    }).join('')}</div>`).join('');
  };

  v.innerHTML = pageTop('Journal', { right: '<a class="btn primary" href="#/journal/new" style="min-height:38px;padding:0 14px">New entry</a>' }) + `<div class="page">
    ${journalInsightsHtml()}
    ${S.journal.length ? `<div class="search-box">${ICON.search}<input type="search" id="jSearch" placeholder="Search journal…" aria-label="Search journal" value="${esc(journalQuery)}"></div>
      <div class="filter-bar" role="group" aria-label="Filter journal">${filters.map(([k, lbl]) =>
        `<button type="button" class="pill-btn" data-jf="${k}" aria-pressed="${filter === k}">${lbl}</button>`).join('')}</div>` : ''}
    <div id="jList">${renderList(journalQuery)}</div>
  </div>`;

  $$('[data-jf]', v).forEach((b) => b.onclick = () => { S.journalFilter = b.dataset.jf; save(); route(); });
  const sb = $('#jSearch', v);
  if (sb) sb.oninput = () => { journalQuery = sb.value; $('#jList', v).innerHTML = renderList(journalQuery); };
}

function viewNewEntry(v) {
  const dr = S.drafts.note || { title: '', text: '' };
  v.innerHTML = pageTop('New entry', { back: '#/journal' }) + `<div class="page">
    <label class="field"><span>Title (optional)</span><input type="text" id="nt" value="${esc(dr.title)}" placeholder="e.g. What I’m carrying today"></label>
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
  const isNote = e.type === 'note';
  v.innerHTML = pageTop('', { back: '#/journal', right: isNote ? '<button class="btn ghost" id="editNote">Edit</button>' : '' }) + `<div class="page entry" id="entryBox">
    <span class="type">${esc(typeLabel(e))}</span>${e.rating ? `<span class="tag">${e.rating.before} → ${e.rating.after} / 10</span>` : ''}
    <h1 class="title">${esc(e.title || 'Untitled')}</h1>
    <p class="muted" style="margin:0 0 18px">${fmtDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${fmtTime(e.date)}</p>
    ${e.emotions?.length ? `<div class="chips" style="margin-bottom:18px">${e.emotions.map((w) => `<span class="tag" style="margin:0;padding:4px 10px;font-size:13px">${esc(w)}</span>`).join('')}</div>` : ''}
    ${(e.fields || []).map((f) => `<div class="entry-field">${f.label ? `<h3>${esc(f.label)}</h3>` : ''}<p>${esc(f.text)}</p></div>`).join('') || '<p class="muted">Nothing was written for this entry.</p>'}
    <button class="btn ember block" id="del" style="margin-top:20px">Delete entry</button></div>`;

  if ($('#editNote')) $('#editNote').onclick = () => {
    const txt = e.fields?.[0]?.text || '';
    $('#entryBox').innerHTML = `
      <label class="field"><span>Title</span><input type="text" id="et" value="${esc(e.title || '')}"></label>
      <label class="field"><span>Entry</span><textarea id="ex" class="tall">${esc(txt)}</textarea></label>
      <div class="btn-row"><button class="btn primary" id="esave">Save changes</button><button class="btn" id="ecancel">Cancel</button></div>`;
    $('#ecancel').onclick = () => route();
    $('#esave').onclick = () => {
      const ntxt = $('#ex').value.trim(); if (!ntxt) { toast('Write something first.'); return; }
      e.title = $('#et').value.trim() || e.title;
      e.fields = [{ label: '', text: ntxt }];
      save(); route(); toast('Entry updated');
    };
  };
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
      <p class="small muted" style="margin:8px 0 0">Your journal, check-ins, prayers and edits are stored only on this phone. Nothing you write is sent anywhere.</p>
    </div>

    <h2 class="section-h">Backup</h2>
    <div class="card">
      <p class="small muted">Save a copy of your journal, check-ins, prayers, steps and edits. Keep it somewhere private, like your iCloud Drive.</p>
      <div class="btn-row" style="margin-top:0"><button class="btn" id="exp">Save a backup</button><label class="btn" for="imp">Restore a backup</label></div>
      <input type="file" id="imp" accept="application/json,.json" hidden>
    </div>

    <h2 class="section-h">Evidence-based healing tools</h2>
    <div class="card"><p class="small" style="margin:0">HealDeal pairs scripture and personal wisdom with renowned clinical tools: Affect Labeling &amp; Emotion-Focused Therapy (EFT), Somatic Body Mapping, Cyclic Physiological Sighing (Stanford RCT), EMDR Butterfly Hug, RAIN Mindfulness &amp; Self-Compassion, Pennebaker Expressive Writing, Acceptance &amp; Commitment Therapy (ACT), Internal Family Systems (IFS), Worthington’s REACH Forgiveness, Gestalt Empty Chair, CBT Thought Records, and DBT TIPP / Window of Tolerance. These support personal reflection and do not replace professional medical or crisis care.</p></div>

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
