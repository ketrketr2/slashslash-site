/* s/ash — 動きの設定、導入、ヘッダー、カーソル、文字の動き、ヒーロー、AI、領域、体制、プロフィール、問い合わせ。
 * 実績（立体・カード・一覧）と事例ファイルは works-ui.js。 */
(function () {
'use strict';
const D = window.SLASH_WORKS || { projects: [], services: [], archive: [], roles: [], ai: [] };
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const pad = n => String(n).padStart(2, '0');
const root = document.documentElement, body = document.body;
const fine = matchMedia('(hover:hover) and (pointer:fine)');
const byId = Object.fromEntries(D.projects.map(p => [p.id, p]));
const mp4 = src => src.replace(/\.webm$/, '.mp4');
const thumbOf = p => { const L = (p.layers || []).find(l => l.type === 'image' || l.type === 'video'); return L ? (L.poster || L.src) : 'assets/brand-pigment-s.jpg'; };
const wallOf = src => src.replace('assets/works/', 'assets/wall/').replace('assets/crydope-', 'assets/wall/crydope-');

/* ---------- 動きの設定（OSの設定＋ボタン。選択は端末に保存） ---------- */
const osReduce = matchMedia('(prefers-reduced-motion: reduce)');
let stored = null; try { stored = localStorage.getItem('slash-motion'); } catch (e) { }
let reduced = stored ? stored === 'off' : osReduce.matches;
function setReduced(v, save) {
  reduced = v; body.classList.toggle('reduced', v); root.classList.remove('pre-reduced');
  $$('#motion-toggle,[data-motion-alt]').forEach(b => { b.setAttribute('aria-pressed', String(v)); b.querySelector('span').textContent = v ? 'MOTION OFF' : 'MOTION ON'; b.setAttribute('aria-label', v ? '動きを再開する' : '動きを止める'); });
  if (save) { try { localStorage.setItem('slash-motion', v ? 'off' : 'on'); } catch (e) { } }
  if (v) { root.classList.remove('has-cursor'); $$('[data-magnetic]').forEach(el => { el.style.translate = ''; }); }
  document.dispatchEvent(new CustomEvent('slash:motion', { detail: { reduced: v } }));
  playVisible();
}
$$('#motion-toggle,[data-motion-alt]').forEach(b => b.addEventListener('click', () => setReduced(!reduced, true)));
osReduce.addEventListener('change', e => { if (!stored) setReduced(e.matches, false); });

/* ---------- メニュー ---------- */
const menu = $('#menu'), menuBtn = $('#menu-btn');
function setMenu(openIt) {
  menu.hidden = !openIt; menuBtn.setAttribute('aria-expanded', String(openIt)); root.classList.toggle('menu-open', openIt);
  if (openIt) { const a = $('a', menu); if (a) a.focus(); } else menuBtn.focus({ preventScroll: true });
}
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
$$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

/* ---------- 文字：スクランブル・分割・近さで幅が変わる ---------- */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*+<>';
function scramble(el, text, dur = 620) {
  if (!el) return; text = text == null ? (el.dataset.text || el.textContent) : text; el.dataset.text = text;
  if (reduced) { el.textContent = text; return; }
  const start = performance.now(); cancelAnimationFrame(el._scr);
  const tick = now => {
    const t = clamp((now - start) / dur), n = Math.floor(t * text.length);
    let out = ''; for (let i = 0; i < text.length; i++) out += i < n || text[i] === ' ' ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = out; if (t < 1) el._scr = requestAnimationFrame(tick); else el.textContent = text;
  };
  el._scr = requestAnimationFrame(tick);
}
$$('.gnav a[data-scramble], .site-footer nav a').forEach(a => { const b = $('b', a) || a; b.dataset.text = b.textContent; a.addEventListener('pointerenter', () => { if (fine.matches) scramble(b); }); });
const loopEl = $('[data-scramble-loop]');
if (loopEl) { const words = ['DIVISION / CONNECT', 'STRATEGY / STATISTICS', 'AI / DESIGN / FILM', '20 PROFESSIONALS']; let k = 0; setInterval(() => { if (reduced || document.hidden) return; k = (k + 1) % words.length; scramble(loopEl, words[k], 700); }, 3400); }
function splitText(el) {
  const text = el.textContent.trim(); let k = 0;
  el.innerHTML = `<span class="sr-only">${esc(text)}</span>` + text.split(' ').map(w => `<span class="w" aria-hidden="true">${[...w].map(ch => `<span class="ch" style="--i:${k++}">${esc(ch)}</span>`).join('')}</span>`).join('<span class="sp" aria-hidden="true"> </span>');
  el.classList.add('split');
}
$$('[data-split]').forEach(splitText);
const revealIO = new IntersectionObserver(es => es.forEach(x => {
  if (!x.isIntersecting) return; const el = x.target; el.classList.add('in'); revealIO.unobserve(el);
  if (el.matches('.sec-no[data-scramble]')) scramble(el, el.dataset.text || el.textContent, 700);
}), { threshold: .18 });
$$('.split, .sec-no[data-scramble]').forEach(el => { if (el.matches('.sec-no')) el.dataset.text = el.textContent; revealIO.observe(el); });
// 近さで文字の幅が変わる（見出し・フッターの文字）
function splitChars(el) {
  const walk = node => { [...node.childNodes].forEach(n => { if (n.nodeType === 3) { const f = document.createDocumentFragment(); [...n.textContent].forEach(ch => { const s = document.createElement('span'); s.className = 'pch'; s.textContent = ch; f.append(s); }); n.replaceWith(f); } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n); }); };
  const label = el.textContent; walk(el); if (!el.getAttribute('aria-label') && !el.closest('[aria-hidden=true]')) el.setAttribute('aria-label', label);
}
const prox = $$('[data-proximity]'); prox.forEach(splitChars);
let proxRects = [], proxActive = null;
function cacheProx(el) { proxRects = $$('.pch', el).map(c => { const r = c.getBoundingClientRect(); return { c, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); }
prox.forEach(el => {
  const host = el.closest('section,footer') || el;
  host.addEventListener('pointerenter', () => { if (!fine.matches || reduced) return; proxActive = el; cacheProx(el); });
  host.addEventListener('pointermove', e => {
    if (proxActive !== el || reduced) return;
    proxRects.forEach(o => { const d = Math.hypot(e.clientX - o.x, e.clientY - o.y); const k = clamp(1 - d / 360); o.c.style.setProperty('--px-w', (62 + k * 63).toFixed(0) + '%'); o.c.style.setProperty('--px-g', String(Math.round(500 + k * 400))); });
  });
  host.addEventListener('pointerleave', () => { proxActive = null; $$('.pch', el).forEach(c => { c.style.removeProperty('--px-w'); c.style.removeProperty('--px-g'); }); });
});
addEventListener('scroll', () => { if (proxActive) cacheProx(proxActive); }, { passive: true });

/* ---------- カーソル ---------- */
const cursor = $('#cursor');
if (cursor) {
  const dot = $('.cursor-dot', cursor), ring = $('.cursor-ring', cursor), label = $('.cursor-label', cursor);
  let x = -100, y = -100, on = false, raf = 0;
  // 遅れて付いてくる動きはやめ、ポインタの位置にそのまま置く（操作の手応えを優先）。ラベルが画面の端で切れないよう、左・上へ逃がす
  const loop = () => { raf = 0; const t = `translate3d(${x}px,${y}px,0)`; dot.style.transform = t; ring.style.transform = t; cursor.classList.toggle('flip-x', x > innerWidth - 150); cursor.classList.toggle('flip-y', y > innerHeight - 70); };
  let lastT = null;
  const target = el => {
    if (el === lastT) return; lastT = el; const t = el && el.closest && el.closest('[data-cursor]');
    if (t) { label.textContent = t.dataset.cursor + (t.dataset.cursor === 'CLOSE' ? ' ×' : ' ↗'); cursor.classList.add('is-label'); cursor.classList.remove('is-link'); return; }
    cursor.classList.remove('is-label'); cursor.classList.toggle('is-link', !!(el && el.closest && el.closest('a,button,label,[role=button],[role=tab]')));
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !fine.matches || reduced) return;
    x = e.clientX; y = e.clientY; if (!on) { on = true; root.classList.add('has-cursor'); }
    target(e.target); if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  const retarget = () => { if (on) { lastT = null; target(document.elementFromPoint(x, y)); } };
  addEventListener('scroll', retarget, { passive: true, capture: true }); // 事例ファイルの中のスクロールも拾う
  root.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; }); root.addEventListener('mouseenter', () => { cursor.style.opacity = ''; });
  addEventListener('blur', () => root.classList.remove('has-cursor')); addEventListener('focus', () => { if (on && !reduced) root.classList.add('has-cursor'); });
  // 事例ファイルは最前面（top layer）に出るため、カーソルを中へ移さないと見えなくなる
  const dlgEl = $('#case');
  if (dlgEl) new MutationObserver(() => { const host = dlgEl.open ? dlgEl : body; if (cursor.parentElement !== host) host.append(cursor); requestAnimationFrame(retarget); }).observe(dlgEl, { attributes: true, attributeFilter: ['open'] });
}

/* ---------- 吸い付くボタン ---------- */
$$('[data-magnetic]').forEach(el => {
  el.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || reduced) return; const r = el.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); el.style.translate = `${(dx * .22).toFixed(1)}px ${(dy * .3).toFixed(1)}px`; });
  el.addEventListener('pointerleave', () => { el.style.transition = (getComputedStyle(el).transition ? getComputedStyle(el).transition + ',' : '') + 'translate .5s cubic-bezier(.16,1,.3,1)'; el.style.translate = ''; setTimeout(() => { el.style.transition = ''; }, 520); });
});

/* ---------- ヒーロー：実物の画面の壁と、動く文字 ---------- */
const wallSources = [];
D.projects.forEach(p => { (p.gallery || []).filter(a => a.kind === 'image' && a.ratio < 1.1).slice(0, 4).forEach(a => wallSources.push(wallOf(a.src))); });
function buildWall() {
  const plane = $('#wall-plane'); if (!plane || !wallSources.length) return;
  const mobile = innerWidth <= 720, rows = mobile ? 4 : 5, per = mobile ? 6 : 8;
  const pool = wallSources.slice(); let k = 0; let html = '';
  for (let r = 0; r < rows; r++) {
    const imgs = []; for (let i = 0; i < per; i++) { imgs.push(pool[(k * 7 + r * 5) % pool.length]); k++; }
    const strip = imgs.map(src => `<img src="${esc(src)}" alt="" loading="${r < 3 ? 'eager' : 'lazy'}" decoding="async">`).join('');
    html += `<div class="wall-row ${r % 2 ? 'rev' : ''}" style="--dur:${58 + r * 11}s">${strip}${strip}</div>`;
  }
  plane.innerHTML = html;
}
function buildType() {
  const box = $('#hero-type'); if (!box) return;
  const rows = [['STRATEGY', 'RESEARCH'], ['STATISTICS', 'AI'], ['DESIGN', 'FILM'], ['DIVISION', 'CONNECT'], ['DATA', 'SYSTEM', 'ARTIST']];
  const kinds = ['narrow', 'wide', 'narrow', 'wide', 'narrow'];
  box.innerHTML = rows.map((words, r) => { const seq = words.map(w => `<span class="ht-w">${w}</span><span class="ht-s">/</span>`).join(''); const strip = seq + seq + seq; return `<div class="ht-row ${kinds[r]} ${r % 2 ? 'rev' : ''}" style="--dur:${26 + r * 7}s">${strip}${strip}</div>`; }).join('');
}
buildWall(); buildType();
let lastMobile = innerWidth <= 720; addEventListener('resize', () => { const m = innerWidth <= 720; if (m !== lastMobile) { lastMobile = m; buildWall(); } });
const hero = $('.hero'), wallPlane = $('#wall-plane'), heroType = $('#hero-type');
if (hero && wallPlane) {
  hero.addEventListener('pointermove', e => { if (reduced || e.pointerType !== 'mouse') return; const r = hero.getBoundingClientRect(); const nx = (e.clientX - r.left) / r.width * 2 - 1, ny = (e.clientY - r.top) / r.height * 2 - 1; wallPlane.style.setProperty('--mx', nx.toFixed(3)); wallPlane.style.setProperty('--my', ny.toFixed(3)); $$('.ht-row', heroType).forEach((row, i) => { row.style.setProperty('--fs', `${Math.round((i % 2 ? 125 : 68) + nx * (i % 2 ? -30 : 30))}%`); }); });
  new IntersectionObserver(es => hero.classList.toggle('off', !es[0].isIntersecting)).observe(hero);
}
// 実績・体制の数を数え上げる
function countUp(el, n) { if (!el) return; if (reduced) { el.textContent = pad(n); return; } let i = 0; const t = setInterval(() => { i++; el.textContent = pad(i); if (i >= n) clearInterval(t); }, 60); }
countUp($('[data-count="cases"]'), D.projects.length); countUp($('[data-count="team"]'), (D.roles || []).length || 20);

/* ---------- ヘッダーの地色・進捗・現在地・スクロールの速さ ---------- */
const header = $('#header'), progress = $('#progress'), strip = $('#strip-skew');
const darkSecs = () => $$('.ai,.team,.site-footer');
let tick = false, lastY = scrollY, vel = 0, skew = 0, skewRaf = 0;
function onScroll() {
  tick = false;
  const h = header.offsetHeight, solid = !hero || hero.getBoundingClientRect().bottom <= h;
  header.classList.toggle('solid', solid);
  const mid = h / 2; header.classList.toggle('on-dark', solid && darkSecs().some(s => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; }));
  const max = document.documentElement.scrollHeight - innerHeight; progress.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max) : 0})`;
  showHere(solid);
}
/* スマホのヘッダーに「いまどの節か」を出す（ナビが隠れる幅で使う） */
const HERE = [['works', '01', 'WORKS', '実績'], ['ai', '02', 'AI', 'AI活用'], ['services', '03', 'SERVICES', '領域'], ['team', '04', 'TEAM', '体制'], ['profile', '05', 'PROFILE', '代表'], ['company', '06', 'COMPANY', '会社'], ['contact', '07', 'CONTACT', '相談する']];
const here = $('#here'); let hereId = '';
function showHere(solid) {
  if (!here) return;
  const line = innerHeight * .35; let cur = null;
  if (solid) for (const h of HERE) { const el = document.getElementById(h[0]); if (!el) continue; const r = el.getBoundingClientRect(); if (r.top <= line && r.bottom > line) { cur = h; break; } }
  here.classList.toggle('on', !!cur);
  if (cur && cur[0] !== hereId) { hereId = cur[0]; $('#here-no').textContent = cur[1]; $('#here-en').textContent = cur[2]; $('#here-ja').textContent = cur[3]; here.classList.remove('flip'); void here.offsetWidth; here.classList.add('flip'); }
  if (!cur) hereId = '';
}
function skewLoop() {
  skewRaf = 0; const y = scrollY; vel = y - lastY; lastY = y; const target = reduced ? 0 : clamp(vel * -.18, -10, 10);
  skew += (target - skew) * .14;
  if (heroType) heroType.style.transform = `skewY(${(skew * .4).toFixed(2)}deg)`;
  if (strip) strip.style.transform = `skewX(${skew.toFixed(2)}deg)`;
  if (Math.abs(skew) > .02 || Math.abs(vel) > .5) skewRaf = requestAnimationFrame(skewLoop);
}
addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(onScroll); } if (!skewRaf) skewRaf = requestAnimationFrame(skewLoop); }, { passive: true });
addEventListener('resize', onScroll); onScroll();
const navLinks = $$('.gnav a');
const so = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) navLinks.forEach(a => a.classList.toggle('current', a.getAttribute('href') === '#' + x.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
['works', 'ai', 'services', 'team', 'profile', 'company', 'contact'].forEach(id => { const el = document.getElementById(id); if (el) so.observe(el); });

/* ---------- 見えている動画だけ再生 ---------- */
const playIO = new IntersectionObserver(es => es.forEach(x => { x.target._vis = x.isIntersecting; playOne(x.target); }), { threshold: .25 });
function playOne(v) { if (v._vis && !reduced && !document.hidden && !root.classList.contains('case-open')) { if (!v.querySelector('source')) v.innerHTML = `<source src="${esc(v.dataset.src)}" type="video/webm"><source src="${esc(mp4(v.dataset.src))}" type="video/mp4">`; v.preload = 'auto'; const pr = v.play(); if (pr) pr.catch(() => { }); } else v.pause(); }
function playVisible() { $$('video[data-auto]').forEach(playOne); }
document.addEventListener('visibilitychange', playVisible);
new MutationObserver(playVisible).observe(root, { attributes: true, attributeFilter: ['class'] });

/* ---------- AI ---------- */
const aiGrid = $('#ai-grid'), aiTicker = $('#ai-ticker');
if (aiTicker) { const w = ['GEO', 'AI SEARCH', 'LLM', 'AGENT', 'RETRIEVAL', 'GENERATIVE VIDEO', 'EVALUATION', 'AUTOMATION', 'REALTIME UI', 'VALUE MODEL']; const seq = w.map(x => `<span>${x}<i>/</i></span>`).join(''); aiTicker.innerHTML = seq + seq + seq; }
if (aiGrid) {
  aiGrid.innerHTML = (D.ai || []).map((it, k) => {
    const p = byId[it.id]; if (!p) return '';
    const isVid = /\.webm$/.test(it.media), poster = isVid ? it.media.replace(/\.webm$/, '.jpg') : it.media;
    const portrait = (p.gallery || []).some(a => a.src === it.media && a.ratio > 1.15);
    return `<li class="ai-item"><div class="ai-media ${portrait ? 'portrait' : ''}"><img src="${esc(poster)}" alt="" loading="lazy" decoding="async">${isVid ? `<video muted loop playsinline preload="none" data-auto data-src="${esc(it.media)}" poster="${esc(poster)}"></video>` : ''}<span class="ai-no">${pad(k + 1)} / ${esc(it.no)}</span></div>
      <div class="ai-body"><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p><span class="ai-link">${esc(p.title)} — CASE FILE ↗</span></div>
      <button type="button" class="ai-hit" data-open="${esc(it.id)}" aria-label="${esc(it.title)}：${esc(p.title)}の事例ファイルを開く" data-cursor="OPEN"></button></li>`;
  }).join('');
  $$('video[data-auto]', aiGrid).forEach(v => playIO.observe(v));
  aiGrid.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b && window.SlashWorks) window.SlashWorks.open(b.dataset.open, b.closest('.ai-item').querySelector('.ai-media')); });
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.ai-item', aiGrid).forEach((el, k) => { el.style.transitionDelay = `${(k % 3) * 80}ms`; io.observe(el); });
}

/* ---------- 領域（SERVICES） ---------- */
// 事例のサムネ。動画の事例は、見えている間だけ動かす
function svThumb(p) {
  const L = (p.layers || []).find(l => l.type === 'image' || l.type === 'video');
  if (L && L.type === 'video' && L.poster) { const poster = wallOf(L.poster); return `<span class="sv-thumb"><img src="${esc(poster)}" alt="" loading="lazy" decoding="async"><video muted loop playsinline preload="none" data-auto data-src="${esc(L.src)}" poster="${esc(poster)}"></video></span>`; }
  return `<span class="sv-thumb"><img src="${esc(wallOf(thumbOf(p)))}" alt="" loading="lazy" decoding="async"></span>`;
}
const svList = $('#service-list');
if (svList) {
  svList.innerHTML = (D.services || []).map((s, i) => `<li class="sv-item"><button type="button" class="sv-head" aria-expanded="false" aria-controls="sv-${esc(s.id)}"><span class="sv-no">${pad(i + 1)}</span><span class="sv-name"><b>${esc(s.en)}</b><span>${esc(s.name)}</span></span><span class="sv-count">${pad(s.works.length)} CASES</span><span class="sv-plus" aria-hidden="true">+</span></button>
   <div class="sv-body" id="sv-${esc(s.id)}"><div><div class="sv-inner"><div class="sv-text"><p>${esc(s.body)}</p><ul class="sv-can" aria-label="できること">${s.can.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
   <div class="sv-works">${s.works.filter(id => byId[id]).map(id => `<button type="button" data-work="${esc(id)}" data-cursor="OPEN">${svThumb(byId[id])}<span>${esc(byId[id].title)}<br>${esc(byId[id].label)}</span></button>`).join('')}</div></div></div></div></li>`).join('');
  $$('video[data-auto]', svList).forEach(v => playIO.observe(v));
  $$('.sv-head', svList).forEach(h => h.addEventListener('click', () => { const item = h.closest('.sv-item'), on = !item.classList.contains('open'); item.classList.toggle('open', on); h.setAttribute('aria-expanded', String(on)); }));
  svList.addEventListener('click', e => { const b = e.target.closest('[data-work]'); if (b && window.SlashWorks) window.SlashWorks.open(b.dataset.work, b.querySelector('img')); });
  const first = $('.sv-item', svList); if (first) { first.classList.add('open'); $('.sv-head', first).setAttribute('aria-expanded', 'true'); }
}

/* ---------- 体制（TEAM） ----------
 * 役割の図（円周に20の役割、中心に代表）を作る部品。TEAMの節と、各事例ファイルの中で同じ図を使う。 */
const roles = D.roles || [], groups = D.roleGroups || [];
const roleById = Object.fromEntries(roles.map(r => [r.id, r]));
const usedBy = id => D.projects.filter(p => (p.team || []).includes(id));
const GROUP_COLOR = { strategy: 'var(--accent)', data: '#9bb4ff', creative: 'var(--pink)', tech: '#5dffb0', ops: '#ffd166' };
// 役割を、領域ごとに円周上へ置く（上から時計回り）。隣り合う役割は内側と外側の輪に交互に置き、箱どうしが重ならないようにする
const placedRoles = (() => {
  const ordered = groups.flatMap(g => roles.filter(r => r.group === g.id));
  const gap = .6, total = ordered.length + groups.length * gap; let pos = 0, prevGroup = null;
  return ordered.map((r, k) => { if (r.group !== prevGroup) { pos += gap; prevGroup = r.group; } const a = -Math.PI / 2 + (pos / total) * Math.PI * 2; pos += 1; const ring = k % 2 ? .7 : 1; return { r, x: 50 + Math.cos(a) * 43 * ring, y: 50 + Math.sin(a) * 44 * ring }; });
})();
function teamNetHTML(core = '代表 中井') {
  return `<svg class="team-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${placedRoles.map(({ r, x, y }) => `<line data-role="${r.id}" x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" vector-effect="non-scaling-stroke"/>`).join('')}</svg>` +
    `<div class="team-core"><b>s/ash</b><span>${esc(core)}</span></div>` +
    `<ol class="team-roles">${placedRoles.map(({ r, x, y }, k) => `<li class="role" data-role="${r.id}" data-group="${r.group}" style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%;--d:${(-k * .37).toFixed(2)}s"><button type="button" aria-pressed="false"><b>${esc(r.en)}</b><span>${esc(r.label)}</span></button></li>`).join('')}</ol>`;
}
// set：光らせる役割、pick：選んでいる役割（さらに強く）
function paintTeamNet(net, set, pick) {
  $$('.role', net).forEach(li => { const id = li.dataset.role, on = !!set && set.has(id); li.classList.toggle('on', on); li.classList.toggle('dim', !!set && !on); li.classList.toggle('pick', id === pick); li.querySelector('button').setAttribute('aria-pressed', String(id === pick)); });
  $$('line', net).forEach(l => { const id = l.dataset.role, on = !!set && set.has(id); l.classList.toggle('on', on); l.classList.toggle('dim', !!set && !on); l.classList.toggle('pick', id === pick); });
}
const teamLegend = () => `<div class="team-legend">${groups.map(g => `<span><i style="background:${GROUP_COLOR[g.id]}"></i>${esc(g.label)}</span>`).join('')}</div>`;
window.SlashTeam = { netHTML: teamNetHTML, paint: paintTeamNet, role: id => roleById[id], usedBy, groups, legend: teamLegend };

const net = $('#team-net'), panel = $('#team-panel'), caseChips = $('#team-cases');
let teamCase = null, teamRole = null;
if (net && roles.length) {
  net.innerHTML = teamNetHTML();
  const rolesBox = $('.team-roles', net);
  caseChips.innerHTML = `<button type="button" data-case="" aria-pressed="true">すべて</button>` + D.projects.map(p => `<button type="button" data-case="${p.id}" aria-pressed="false">${esc(p.title)}</button>`).join('');
  const defaultPanel = () => `<p class="tp-kicker">1 + 20</p><h3 class="tp-title">ONE TEAM<br>PER CASE</h3><p class="tp-text">代表がすべての案件で全体を設計し、案件ごとに必要な専門家を集めます。上の事例を選ぶと、その案件の体制が光ります。役割を選ぶと、その役割が入った事例を表示します。</p>${teamLegend()}`;
  function paint() {
    const set = teamCase ? new Set(byId[teamCase].team) : teamRole ? new Set([teamRole]) : null;
    paintTeamNet(net, set, teamRole);
    $$('button', caseChips).forEach(b => b.setAttribute('aria-pressed', String((b.dataset.case || null) === teamCase)));
    if (teamCase) {
      const p = byId[teamCase];
      panel.innerHTML = `<p class="tp-kicker">${p.no} — ${esc(p.industry)} / ${esc(p.year)}</p><h3 class="tp-title">${esc(p.title)}</h3><p class="tp-text">${esc(p.label)}。${p.team.length}つの役割で組みました。</p><ul class="tp-list">${p.team.map(id => `<li>${esc((roleById[id] || {}).label)}</li>`).join('')}</ul><button type="button" class="tp-open" data-open="${p.id}">事例ファイルを開く ↗</button>`;
    } else if (teamRole) {
      const r = roleById[teamRole], list = usedBy(teamRole);
      panel.innerHTML = `<p class="tp-kicker">${esc(r.en)} — ${esc((groups.find(g => g.id === r.group) || {}).label)}</p><h3 class="tp-title">${esc(r.label)}</h3><p class="tp-text">${esc(r.note)}。</p>${list.length ? `<ul class="tp-list">${list.map(p => `<li><button type="button" data-open="${p.id}">${esc(p.title)} ↗</button></li>`).join('')}</ul>` : '<p class="tp-text">案件に応じて参加します。</p>'}`;
    } else panel.innerHTML = defaultPanel();
  }
  caseChips.addEventListener('click', e => { const b = e.target.closest('[data-case]'); if (!b) return; teamCase = b.dataset.case || null; teamRole = null; paint(); });
  // スマホ：役割を選んだら、説明の欄が画面の外なら見える位置へ送る
  const showPanel = () => { if (innerWidth > 720) return; const r = panel.getBoundingClientRect(), top = header.offsetHeight; if (r.top < top || r.top > innerHeight - 120) panel.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }); };
  rolesBox.addEventListener('click', e => { const li = e.target.closest('.role'); if (!li) return; teamRole = teamRole === li.dataset.role ? null : li.dataset.role; teamCase = null; paint(); if (teamRole) showPanel(); });
  panel.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b && window.SlashWorks) window.SlashWorks.open(b.dataset.open, b); });
  paint();
}
const partnerList = $('#partner-list');
if (partnerList) partnerList.innerHTML = (D.partners || []).map(p => `<li><b>${p.href ? `<a href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.name)} ↗</a>` : esc(p.name)}</b><span>${esc(p.note)}</span></li>`).join('');

/* ---------- プロフィール ---------- */
const pf = D.profile, pfBox = $('#profile-body');
if (pf && pfBox) {
  pfBox.innerHTML = `<div class="pf-side">
    <figure class="pf-photo"><span class="pf-frame"><img class="pf-portrait" src="${esc(pf.photo)}" alt="代表 ${esc(pf.name)} の写真（目元を帯で、口元を猫の写真で隠しています）" width="470" height="588" loading="lazy" decoding="async">${pf.pet ? `<img class="pf-sticker" src="${esc(pf.pet.src)}" alt="猫の${esc(pf.pet.name)}" width="300" height="300" loading="lazy" decoding="async">` : ''}</span>${pf.photo_note ? `<figcaption>${esc(pf.photo_note)}</figcaption>` : ''}</figure>
    <div class="pf-id"><p class="pf-name">${esc(pf.name)}<small>${esc(pf.en)}</small></p><ul class="pf-titles">${pf.titles.map(t => `<li><span>${esc(t)}</span></li>`).join('')}</ul></div>
    ${pf.likes && pf.likes.length ? `<dl class="pf-likes"><dt>好きなこと</dt><dd class="pf-like-tags">${pf.likes.map(l => `<span>${esc(l)}</span>`).join('')}</dd></dl>` : ''}
    <p class="pf-links">${(pf.links || []).map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</p>
  </div>
  <div class="pf-text">
    <p class="pf-lead">${esc(pf.lead)}</p>
    <div class="pf-body">${pf.body.map(b => `<p>${esc(b)}</p>`).join('')}</div>
    <ul class="pf-skills" aria-label="専門">${pf.skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <ol class="pf-time" aria-label="経歴">${pf.timeline.map(([y, t], i) => `<li style="--i:${i}" class="${/スラッシュを設立/.test(t) ? 'hl' : ''}"><b>${esc(y)}</b><p><span>${esc(t)}</span></p></li>`).join('')}</ol>
  </div>`;
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .2 });
  [$('.pf-photo', pfBox), $('.pf-time', pfBox)].forEach(el => el && io.observe(el));
}

/* ---------- 問い合わせ ---------- */
const form = $('#contact-form');
if (form) {
  $('#cf-topics').innerHTML = (D.services || []).map(s => `<label><input type="checkbox" name="topics" value="${esc(s.name)}">${esc(s.name)}</label>`).join('');
  const status = $('#form-status'), btn = $('.btn-submit', form);
  // 公開先にフォームの送信先（/api/contact）がないときは、<html data-form="mailto"> でメールアプリに渡す
  const viaMail = root.dataset.form === 'mailto';
  if (viaMail) { const t = $('span', btn); if (t) t.textContent = 'メールで送る'; }
  const mailto = d => { const text = `お名前：${d.name}\n会社名：${d.company}\nメール：${d.email}\nご相談の領域：${d.topics || '—'}\n\n${d.message}`.slice(0, 1500); return `mailto:nakai@slashslash.jp?subject=${encodeURIComponent('[s/ash] Webサイトからのご相談')}&body=${encodeURIComponent(text)}`; };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const f = form.elements, d = { name: f.name.value.trim(), company: f.company.value.trim(), email: f.email.value.trim(), message: f.message.value.trim(), website: f.website.value, topics: $$('input[name=topics]:checked', form).map(x => x.value).join('、') };
    const bad = [];
    [['cf-name', !d.name], ['cf-email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)], ['cf-message', d.message.length < 10]].forEach(([id, wrong]) => { $('#' + id).setAttribute('aria-invalid', String(wrong)); if (wrong) bad.push(id); });
    if (!$('#cf-consent').checked) bad.push('cf-consent');
    if (bad.length) { status.textContent = 'お名前、メールアドレス、ご相談内容（10文字以上）、同意をご確認ください。'; $('#' + bad[0]).focus(); return; }
    if (d.website) return; // 自動送信よけ
    if (viaMail) { location.href = mailto(d); status.innerHTML = `メールアプリが開きます。開かない場合は、<a href="mailto:nakai@slashslash.jp">nakai@slashslash.jp</a> へ直接お送りください。`; return; }
    btn.disabled = true; status.textContent = '送信しています…';
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: d.name, company: d.company, email: d.email, message: (d.topics ? `【ご相談の領域】${d.topics}\n\n` : '') + d.message, website: d.website, consent: true }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) { form.reset(); status.textContent = '送信しました。内容を確認のうえ、ご連絡します。'; }
      else throw new Error(data.error || 'unavailable');
    } catch (err) {
      status.innerHTML = `フォームから送信できませんでした。お手数ですが、<a href="${esc(mailto(d))}">メールアプリで送る</a>か、nakai@slashslash.jp へ直接お送りください。入力内容は残しています。`;
    } finally { btn.disabled = false; }
  });
}

setReduced(reduced, false);
})();
