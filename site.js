/* s/ash — 動きの設定、導入、ヘッダー、いまの節（目次・スマホの移動バー）、カーソル、文字の動き、ヒーロー、AI、業務領域、体制、プロフィール、問い合わせ。
 * 実績（1件ずつ・カード・一覧）と事例の詳細は works-ui.js。 */
(window.slashInit || function (f) { f(); })(function () {
'use strict';
const D = window.SLASH_WORKS || { projects: [], services: [], archive: [], roles: [], ai: [] };
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const pad = n => String(n).padStart(2, '0');
const root = document.documentElement, body = document.body;
const fine = matchMedia('(hover:hover) and (pointer:fine)');
const byId = Object.fromEntries(D.projects.map(p => [p.id, p]));
const wallOf = src => src.replace('assets/works/', 'assets/wall/').replace('assets/crydope-', 'assets/wall/crydope-');
const go = el => { if (el) el.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }); };
// 計測（analytics.js。本番だけで動く。ほかの環境では何もしない）
const track = (name, params) => { try { if (window.slashTrack) window.slashTrack(name, params); } catch (e) { } };
const fromOf = a => a.closest('.gnav') ? 'header' : a.closest('.menu') ? 'menu' : a.closest('.site-footer') ? 'footer' : a.closest('.hero') ? 'hero' : a.closest('.sv-ask') ? 'services' : a.closest('.ai-foot') ? 'ai' : a.closest('.contact') ? 'contact' : 'link';
/* 節へ移る。途中の見出しが後から開いて（文字幅が変わって）着地点がずれないよう、目的の節より上の見出しを先に開いておく。
 * スクロールが止まったら、節の頭がヘッダーのすぐ下にあるかを確かめて合わせ直す */
function jump(el) {
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  $$('.split:not(.in)').forEach(s => { if (s.getBoundingClientRect().top < top) s.classList.add('in', 'instant'); });
  go(el);
  const fix = () => { const h = document.getElementById('header'), want = h ? h.offsetHeight : 0, t = el.getBoundingClientRect().top; if (Math.abs(t - want) > 2) window.scrollBy({ top: t - want, behavior: 'instant' }); };
  if ('onscrollend' in window && !reduced) addEventListener('scrollend', fix, { once: true }); else requestAnimationFrame(() => requestAnimationFrame(fix));
}
// ページ内の節へのリンク（ヘッダー・目次・ヒーロー・フッター）は jump で移る。URL は節の名前に置き換える（履歴は増やさない）
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || a.classList.contains('skip') || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const id = a.getAttribute('href').slice(1); const el = id === 'top' ? document.getElementById('top') : (['works', 'ai', 'services', 'team', 'profile', 'company', 'contact'].includes(id) ? document.getElementById(id) : null);
  if (!el) return;
  e.preventDefault();
  track('nav_click', { section: id, ui_from: fromOf(a) });
  if (!menu.hidden) setMenu(false);
  if (id === 'top') { window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' }); history.replaceState(null, '', location.pathname + location.search); return; }
  jump(el); history.replaceState(null, '', '#' + id);
  // キーボードで選んだときは、移った先から続けて操作できるように。焦点が離れたら tabindex を外す（「戻る」で節に焦点が奪われないように）
  if (e.detail === 0) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true }); }
});

// メールアドレスのリンクを押した（問い合わせの入口）
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="mailto:"]'); if (!a) return;
  const sec = a.closest('section[id], footer'); track('contact_click', { contact_method: 'mail_link', ui_from: sec ? (sec.id || 'footer') : 'link' });
});

/* ---------- 動きの設定（OSの設定＋ボタン。選択は端末に保存） ---------- */
const osReduce = matchMedia('(prefers-reduced-motion: reduce)');
let stored = null; try { stored = localStorage.getItem('slash-motion'); } catch (e) { }
let reduced = stored ? stored === 'off' : osReduce.matches;
function setReduced(v, save) {
  reduced = v; body.classList.toggle('reduced', v); root.classList.remove('pre-reduced');
  $$('#motion-toggle,[data-motion-alt]').forEach(b => { b.setAttribute('aria-pressed', String(v)); b.querySelector('span').textContent = v ? '動き：オフ' : '動き：オン'; b.setAttribute('aria-label', v ? '動きを再開する（いまは止めています）' : '動きを止める（いまは動いています）'); });
  if (save) { try { localStorage.setItem('slash-motion', v ? 'off' : 'on'); } catch (e) { } }
  if (v) { root.classList.remove('has-cursor'); $$('[data-magnetic]').forEach(el => { el.style.translate = ''; }); }
  document.dispatchEvent(new CustomEvent('slash:motion', { detail: { reduced: v } }));
  playVisible();
}
$$('#motion-toggle,[data-motion-alt]').forEach(b => b.addEventListener('click', () => { setReduced(!reduced, true); track(reduced ? 'motion_off' : 'motion_on', { ui_from: b.closest('.menu') ? 'menu' : 'header' }); }));
osReduce.addEventListener('change', e => { if (!stored) setReduced(e.matches, false); });

/* ---------- 目次（メニュー）。右上の「メニュー」と、スマホの移動バーの真ん中から開く ---------- */
const menu = $('#menu'), menuBtn = $('#menu-btn'), dock = $('#dock'), dockHere = $('#dock-here');
let menuOpener = null;
function setMenu(openIt, opener) {
  menu.hidden = !openIt; root.classList.toggle('menu-open', openIt);
  [menuBtn, dockHere].forEach(b => b && b.setAttribute('aria-expanded', String(openIt)));
  if (openIt) { menuOpener = opener || menuBtn; const a = $('a.current', menu) || $('a', menu); if (a) a.focus({ preventScroll: true }); }
  else { const o = menuOpener && menuOpener.offsetParent ? menuOpener : menuBtn; o.focus({ preventScroll: true }); menuOpener = null; }
  syncDock();
}
menuBtn.addEventListener('click', () => { const opening = menu.hidden; setMenu(opening, menuBtn); if (opening) track('open_menu', { ui_from: 'header' }); });
$$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
menu.addEventListener('click', e => { if (e.target === menu) setMenu(false); });

/* ---------- 文字：分割・近さで幅が変わる ---------- */
function splitText(el) {
  const text = el.textContent.trim(); let k = 0;
  el.innerHTML = `<span class="sr-only">${esc(text)}</span>` + text.split(' ').map(w => `<span class="w" aria-hidden="true">${[...w].map(ch => `<span class="ch" style="--i:${k++}">${esc(ch)}</span>`).join('')}</span>`).join('<span class="sp" aria-hidden="true"> </span>');
  el.classList.add('split');
}
$$('[data-split]').forEach(splitText);
const revealIO = new IntersectionObserver(es => es.forEach(x => { if (!x.isIntersecting) return; x.target.classList.add('in'); revealIO.unobserve(x.target); }), { threshold: .18 });
$$('.split, .sec-no').forEach(el => revealIO.observe(el));
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
  const loop = () => { raf = 0; const t = `translate3d(${x}px,${y}px,0)`; dot.style.transform = t; ring.style.transform = t; cursor.classList.toggle('flip-x', x > innerWidth - 170); cursor.classList.toggle('flip-y', y > innerHeight - 70); };
  let lastT = null;
  const target = el => {
    if (el === lastT) return; lastT = el; const t = el && el.closest && el.closest('[data-cursor]');
    if (t) { label.textContent = t.dataset.cursor + ' ' + (t.dataset.cursorMark || '↗'); cursor.classList.add('is-label'); cursor.classList.remove('is-link'); return; }
    cursor.classList.remove('is-label'); cursor.classList.toggle('is-link', !!(el && el.closest && el.closest('a,button,label,[role=button],[role=tab]')));
  };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !fine.matches || reduced) return;
    x = e.clientX; y = e.clientY; if (!on) { on = true; root.classList.add('has-cursor'); }
    target(e.target); if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  const retarget = () => { if (on) { lastT = null; target(document.elementFromPoint(x, y)); } };
  addEventListener('scroll', retarget, { passive: true, capture: true }); // 事例の詳細の中のスクロールも拾う
  root.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; }); root.addEventListener('mouseenter', () => { cursor.style.opacity = ''; });
  addEventListener('blur', () => root.classList.remove('has-cursor')); addEventListener('focus', () => { if (on && !reduced) root.classList.add('has-cursor'); });
  // 事例の詳細は最前面（top layer）に出るため、カーソルを中へ移さないと見えなくなる
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
    const strip = imgs.map(src => `<img src="${esc(src)}" alt="" loading="${r < 4 ? 'eager' : 'lazy'}" decoding="async">`).join('');
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
/* 画面の外にある節の動き（CSS のアニメーション）は止める（.still）。
 * 体制図の点線（stroke-dashoffset）や光（box-shadow）は、画面の外でも毎フレーム描き直しが走り、スマホでは重さの大半を占めていた */
const stillIO = new IntersectionObserver(es => es.forEach(x => x.target.classList.toggle('still', !x.isIntersecting)), { rootMargin: '160px 0px' });
$$('main > section:not(.hero), .site-footer').forEach(s => stillIO.observe(s));
// 体制の人数を数え上げる
function countUp(el, n) { if (!el) return; if (reduced) { el.textContent = pad(n); return; } let i = 0; const t = setInterval(() => { i++; el.textContent = pad(i); if (i >= n) clearInterval(t); }, 60); }
countUp($('[data-count="team"]'), (D.roles || []).length || 20);

/* ---------- いまの節：ヘッダーの目次（PC）・目次の画面・スマホの移動バー ----------
 * 画面の上から35%の線にかかっている節を「いまの節」とし、節の中でどこまで進んだかも出す。 */
const SECS = [['works', '01', '実績'], ['ai', '02', 'AI活用'], ['services', '03', '業務領域'], ['team', '04', '体制'], ['profile', '05', '代表'], ['company', '06', '会社'], ['contact', '07', '相談する']]
  .map(([id, no, ja]) => ({ id, no, ja, el: document.getElementById(id) })).filter(s => s.el);
const gnavLinks = $$('.gnav a[data-sec]'), menuLinks = $$('.menu a[data-sec]');
const dockNo = $('#dock-no'), dockName = $('#dock-name'), dockBar = $('#dock-bar'), dockPrev = dock && $('[data-dock="-1"]', dock), dockNext = dock && $('[data-dock="1"]', dock);
let secIdx = -2, secP = 0, solidNow = false, typing = false;
function findSection() {
  const line = innerHeight * .35; let i = -1, p = 0;
  for (let k = 0; k < SECS.length; k++) { const r = SECS[k].el.getBoundingClientRect(); if (r.top <= line && r.bottom > line) { i = k; p = clamp((line - r.top) / r.height); break; } }
  const last = SECS[SECS.length - 1];
  if (i < 0 && last && last.el.getBoundingClientRect().bottom <= line) { i = SECS.length - 1; p = 1; } // フッターまで来たら、最後の節
  if (scrollY + innerHeight >= root.scrollHeight - 2 && i >= 0) { i = SECS.length - 1; p = 1; }
  return [i, p];
}
// 節に着いて少し（0.8秒）とどまったら「見た」と記録する（1回だけ）。目次から遠くの節へ飛ぶとき、途中で通り過ぎた節は数えない
const seenSecs = new Set(); let seenTimer = 0;
function noteSection(i) {
  clearTimeout(seenTimer);
  const id = SECS[i] ? SECS[i].id : '';
  if (!id || seenSecs.has(id)) return;
  seenTimer = setTimeout(() => { if (secIdx === i && !seenSecs.has(id)) { seenSecs.add(id); track('view_section', { section: id }); } }, 800);
}
function paintSection(i, p) {
  if (i !== secIdx) {
    secIdx = i; const id = SECS[i] ? SECS[i].id : '';
    noteSection(i);
    [gnavLinks, menuLinks].forEach(list => list.forEach(a => { const on = a.dataset.sec === id; a.classList.toggle('current', on); if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); }));
    if (SECS[i] && dock) {
      dockNo.textContent = SECS[i].no; dockName.textContent = SECS[i].ja;
      dockHere.setAttribute('aria-label', `目次を開く（いまは ${SECS[i].no} ${SECS[i].ja}）`);
      dockNext.disabled = i >= SECS.length - 1;
      dockPrev.setAttribute('aria-label', i > 0 ? `前の節へ（${SECS[i - 1].ja}）` : 'ページの先頭へ');
      if (!dockNext.disabled) dockNext.setAttribute('aria-label', `次の節へ（${SECS[i + 1].ja}）`); else dockNext.setAttribute('aria-label', '次の節はありません');
      dockHere.classList.remove('flip'); void dockHere.offsetWidth; dockHere.classList.add('flip');
    }
  }
  secP = p;
  const cur = gnavLinks.find(a => a.classList.contains('current')); if (cur) cur.style.setProperty('--p', p.toFixed(3));
  if (dockBar) dockBar.style.transform = `scaleX(${p.toFixed(3)})`;
}
function syncDock() {
  if (!dock) return;
  const show = solidNow && secIdx >= 0 && menu.hidden && !typing && !root.classList.contains('case-open');
  dock.classList.toggle('on', show); dock.toggleAttribute('inert', !show);
}
if (dock) {
  $$('[data-dock]', dock).forEach(b => b.addEventListener('click', () => {
    const i = secIdx + +b.dataset.dock, ui = +b.dataset.dock < 0 ? 'dock_prev' : 'dock_next';
    if (i < 0) { track('nav_click', { section: 'top', ui_from: ui }); window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' }); return; }
    if (SECS[i]) { track('nav_click', { section: SECS[i].id, ui_from: ui }); jump(SECS[i].el); }
  }));
  dockHere.addEventListener('click', () => { setMenu(true, dockHere); track('open_menu', { ui_from: 'dock' }); });
  // 入力中は、キーボードの上にかぶらないよう隠す
  document.addEventListener('focusin', e => { if (e.target.matches && e.target.matches('input,textarea,select')) { typing = true; syncDock(); } });
  document.addEventListener('focusout', e => { if (e.target.matches && e.target.matches('input,textarea,select')) { typing = false; setTimeout(syncDock, 60); } });
  new MutationObserver(syncDock).observe(root, { attributes: true, attributeFilter: ['class'] });
}

/* ---------- ヘッダーの地色・進捗・スクロールの速さ ---------- */
const header = $('#header'), progress = $('#progress'), strip = $('#strip-skew');
const darkSecs = () => $$('.ai,.team,.site-footer');
let tick = false, lastY = scrollY, vel = 0, skew = 0, skewRaf = 0;
function onScroll() {
  tick = false;
  const h = header.offsetHeight, solid = !hero || hero.getBoundingClientRect().bottom <= h;
  header.classList.toggle('solid', solid);
  const mid = h / 2; header.classList.toggle('on-dark', solid && darkSecs().some(s => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; }));
  const max = root.scrollHeight - innerHeight; progress.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max) : 0})`;
  const [i, p] = findSection(); paintSection(i, p);
  if (solid !== solidNow) solidNow = solid;
  syncDock();
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
// 画像の読み込みで節の高さが変わっても、いまの節を取り直す
addEventListener('load', onScroll);
// 読み込みの間は高さが何度も変わるので、まとめて1回だけ取り直す（そのたびにページ全体の配置を計算し直さない）
let bodyRT = 0; new ResizeObserver(() => { clearTimeout(bodyRT); bodyRT = setTimeout(() => { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, 150); }).observe(body);

/* ---------- 見えている動画だけ再生 ---------- */
const mp4 = src => src.replace(/\.webm$/, '.mp4');
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
      <div class="ai-body"><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p><span class="ai-link"><small>${esc(p.title)}</small>事例を詳しく見る ↗</span></div>
      <a class="ai-hit" href="/works/${encodeURIComponent(it.id)}/" data-open="${esc(it.id)}" aria-haspopup="dialog" aria-label="${esc(it.title)}：${esc(p.label)}の事例の詳細を開く" data-cursor="詳しく見る"></a></li>`;
  }).join('');
  $$('video[data-auto]', aiGrid).forEach(v => playIO.observe(v));
  aiGrid.addEventListener('click', e => {
    const b = e.target.closest('[data-open]'); if (!b || !window.SlashWorks) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e.button && e.button !== 0)) return; // 押しながら：事例のページを新しいタブで開く
    e.preventDefault(); window.SlashWorks.open(b.dataset.open, b.closest('.ai-item').querySelector('.ai-media'), 'ai');
  });
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.ai-item', aiGrid).forEach((el, k) => { el.style.transitionDelay = `${(k % 3) * 80}ms`; io.observe(el); });
  // スマホでは、初めは上の2件だけを見せ、「すべてのAIの例を見る」で全部を開く（実績のカードと同じ形）
  const aiNarrow = matchMedia('(max-width: 720px)'), AI_SHOW = 2;
  let aiMore = false;
  const aiBar = document.createElement('div'); aiBar.className = 'more-bar on-dark'; aiBar.id = 'ai-more';
  aiBar.innerHTML = '<button type="button" class="more-btn" aria-expanded="false" aria-controls="ai-grid"><span class="more-t"></span><i aria-hidden="true">↓</i></button>';
  aiGrid.after(aiBar);
  const applyAiMore = () => {
    const items = $$('.ai-item', aiGrid), can = aiNarrow.matches && items.length > AI_SHOW + 1;
    items.forEach((el, k) => { el.hidden = can && !aiMore && k >= AI_SHOW; });
    aiBar.hidden = !can; aiBar.classList.toggle('open', aiMore);
    const b = aiBar.firstElementChild; b.setAttribute('aria-expanded', String(aiMore)); $('.more-t', b).textContent = aiMore ? '閉じる' : 'すべてのAIの例を見る';
  };
  aiBar.firstElementChild.addEventListener('click', e => {
    const b = e.currentTarget, before = b.getBoundingClientRect().top;
    aiMore = !aiMore; applyAiMore();
    if (!aiMore) window.scrollBy({ top: b.getBoundingClientRect().top - before, behavior: 'instant' });
    else { if (e.detail === 0) { const f = $$('.ai-item', aiGrid)[AI_SHOW], t = f && $('.ai-hit', f); if (t) t.focus(); } track('open_more', { view_mode: 'ai' }); }
  });
  aiNarrow.addEventListener('change', applyAiMore); applyAiMore();
}
$$('.ai-more[data-open]').forEach(b => { if (!byId[b.dataset.open]) { b.replaceWith(document.createTextNode(b.textContent)); return; } b.addEventListener('click', e => { if (!window.SlashWorks || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); window.SlashWorks.open(b.dataset.open, b, 'ai'); }); });

/* ---------- 業務領域（SERVICES）----------
 * 初めはすべて閉じ、領域の名前と説明だけを並べる。開くと、できることと、関係する事例（文字のリンク）を出す。 */
const svList = $('#service-list');
if (svList) {
  svList.innerHTML = (D.services || []).map((s, i) => {
    const works = s.works.filter(id => byId[id]);
    return `<li class="sv-item"><button type="button" class="sv-head" aria-expanded="false" aria-controls="sv-${esc(s.id)}"><span class="sv-no">${pad(i + 1)}</span><span class="sv-name"><b>${esc(s.en)}</b><span>${esc(s.name)}</span></span><span class="sv-desc">${esc(s.body)}</span><span class="sv-plus" aria-hidden="true"><i></i></span></button>
   <div class="sv-body" id="sv-${esc(s.id)}" role="region" aria-label="${esc(s.name)}"><div><div class="sv-inner">
     <div class="sv-col"><p class="sv-k">できること</p><ul class="sv-can">${s.can.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
     ${works.length ? `<div class="sv-col"><p class="sv-k">関係する事例<small>押すと、事例の詳細が開きます</small></p><ul class="sv-cases">${works.map(id => `<li><button type="button" data-work="${esc(id)}"><span>${esc(byId[id].label)}</span><small>${esc(byId[id].title)}</small><i aria-hidden="true">↗</i></button></li>`).join('')}</ul></div>` : ''}
     <p class="sv-ask">${works.length ? `<button type="button" data-area-works="${esc(s.id)}">実績で、この領域の事例を並べて見る <span aria-hidden="true">→</span></button>` : ''}<a href="#contact">この領域について相談する <span aria-hidden="true">→</span></a></p>
   </div></div></div></li>`;
  }).join('');
  $$('.sv-head', svList).forEach((h, k) => h.addEventListener('click', () => { const item = h.closest('.sv-item'), on = !item.classList.contains('open'); item.classList.toggle('open', on); h.setAttribute('aria-expanded', String(on)); if (on) track('open_service', { service_area: (D.services[k] || {}).name }); }));
  svList.addEventListener('click', e => {
    const w = e.target.closest('[data-area-works]'); if (w && window.SlashWorks && window.SlashWorks.area) { window.SlashWorks.area(w.dataset.areaWorks); return; }
    const b = e.target.closest('[data-work]'); if (b && window.SlashWorks) window.SlashWorks.open(b.dataset.work, b, 'services');
  });
}

/* ---------- 体制（TEAM） ----------
 * 役割の図（円周に20の役割、中心に代表）を作る部品。TEAMの節と、各事例の詳細の中で同じ図を使う。 */
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
// 役割の名前は、語の切れ目でだけ折り返す（スマホの星座の図で「ディレク／ター」のように切れないように）
const roleWbr = t => esc(t).replace(/・/g, '・<wbr>').replace(/(ディレクター|コンサル|アナリスト|（)/g, '<wbr>$1');
function teamNetHTML(core = '代表 中井') {
  return `<svg class="team-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${placedRoles.map(({ r, x, y }) => `<line data-role="${r.id}" x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" vector-effect="non-scaling-stroke"/>`).join('')}</svg>` +
    `<i class="team-glow" aria-hidden="true"></i><div class="team-core"><b>s/ash</b><span>${esc(core)}</span></div>` +
    `<ol class="team-roles">${placedRoles.map(({ r, x, y }) => `<li class="role" data-role="${r.id}" data-group="${r.group}" style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%"><button type="button" aria-pressed="false"><b>${esc(r.en)}</b><span>${roleWbr(r.label)}</span></button></li>`).join('')}</ol>`;
}
// set：光らせる役割、pick：選んでいる役割（さらに強く）
function paintTeamNet(net, set, pick) {
  $$('.role', net).forEach(li => { const id = li.dataset.role, on = !!set && set.has(id); li.classList.toggle('on', on); li.classList.toggle('dim', !!set && !on); li.classList.toggle('pick', id === pick); li.querySelector('button').setAttribute('aria-pressed', String(id === pick)); });
  $$('line', net).forEach(l => { const id = l.dataset.role, on = !!set && set.has(id); l.classList.toggle('on', on); l.classList.toggle('dim', !!set && !on); l.classList.toggle('pick', id === pick); });
}
const teamLegend = () => `<div class="team-legend">${groups.map(g => `<span><i style="background:${GROUP_COLOR[g.id]}"></i>${esc(g.label)}</span>`).join('')}</div>`;

/* 体制の図を、宇宙の星のようにわずかに動かす。
 * 役割の点はそれぞれ小さくゆっくり漂い、全体もごく小さく回る。線は点に付いていく。背景には瞬く星。
 * 見えている間だけ動かし、動きを止める設定では止める（スマホでも星座の図のまま動かす）。ポインタが乗っている間は動きを弱め、乗っている役割は止める。 */
const seeded = n => () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; };
const NETS = new Set(); let driftRaf = 0;
// 漂う動きと星は、とてもゆっくり（速くても1秒に2px弱）なので、1秒に15回描き直せば十分なめらかに見える。
// 体制図と星は同じコマで描き直し、スクロールしている間は描き直さない（スクロールを引っかからせない）
let slowAt = 0, slowNow = -1, scrollAt = -1e9;
addEventListener('scroll', () => { scrollAt = performance.now(); }, { passive: true });
function slowTick(now) { if (now === slowNow) return true; if (now - scrollAt < 140) return false; if (now - slowAt >= 66) { slowAt = slowNow = now; return true; } return false; }
function animateNet(net) {
  if (!net || net._drift) return;
  layoutNet(net);
  const rnd = seeded(7919);
  const items = $$('.role', net).map(li => {
    const line = net.querySelector(`line[data-role="${li.dataset.role}"]`);
    return { li, line, x: parseFloat(li.style.getPropertyValue('--x')), y: parseFloat(li.style.getPropertyValue('--y')), ax: .5 + rnd() * .55, ay: .45 + rnd() * .55, fx: 2 * Math.PI / (15 + rnd() * 13), fy: 2 * Math.PI / (17 + rnd() * 13), px: rnd() * 6.28, py: rnd() * 6.28, tw: 2 * Math.PI / (3.5 + rnd() * 5), tp: rnd() * 6.28, k: 1 };
  });
  const st = { net, items, glow: net.querySelector('.team-glow'), w: net.clientWidth, h: net.clientHeight, vis: false, over: false, hot: null, calm: 0, moved: false, t0: performance.now() - rnd() * 20000 };
  net._drift = st; NETS.add(st);
  new ResizeObserver(() => { const w = net.clientWidth; if (NET_MQ.matches && w && Math.abs(w - (st.lw || 0)) > 2) { st.lw = w; layoutNet(net); } st.w = w; st.h = net.clientHeight; wakeNets(); }).observe(net);
  new IntersectionObserver(es => { st.vis = es[0].isIntersecting; wakeNets(); }, { rootMargin: '80px 0px' }).observe(net);
  net.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') st.over = true; });
  net.addEventListener('pointerleave', () => { st.over = false; st.hot = null; });
  net.addEventListener('pointerover', e => { st.hot = e.target.closest('.role'); });
  net.addEventListener('focusin', e => { st.hot = e.target.closest('.role'); });
  net.addEventListener('focusout', () => { st.hot = null; });
  wakeNets();
}
function resetNet(st) { st.moved = false; if (st.glow) st.glow.style.opacity = ''; st.items.forEach(it => { it.li.style.translate = ''; if (it.line) { it.line.setAttribute('x2', it.x.toFixed(2)); it.line.setAttribute('y2', it.y.toFixed(2)); it.line.style.removeProperty('--tw'); } }); }
function wakeNets() { if (!driftRaf) driftRaf = requestAnimationFrame(driftFrame); }
function driftFrame(now) {
  driftRaf = 0; let any = false; const step = slowTick(now);
  NETS.forEach(st => {
    if (!st.net.isConnected) { NETS.delete(st); return; }
    if (!(st.vis && !reduced && !document.hidden && st.w > 0)) { if (st.moved) resetNet(st); st.lastT = 0; return; }
    any = true; if (!step) return;
    st.moved = true;
    const df = st.lastT ? Math.min(6, (now - st.lastT) / 16.67) : 1; st.lastT = now; // コマの間隔が変わっても、なめらかさの速さは同じにする
    const t = (now - st.t0) / 1000, W = st.w, H = st.h;
    st.calm += ((st.over ? 1 : 0) - st.calm) * (1 - Math.pow(.95, df));
    const amp = 1 - st.calm * .7;
    const rot = Math.sin(t * 2 * Math.PI / 96) * 1.1 * Math.PI / 180; // 全体がごくゆっくり ±1.1° 回る
    const cs = Math.cos(rot), sn = Math.sin(rot);
    if (st.glow) st.glow.style.opacity = (.5 + .5 * Math.sin(t * 2 * Math.PI / 12)).toFixed(3); // 中心の光がゆっくり脈打つ（12秒で1周）
    st.items.forEach(it => {
      it.k += ((st.hot === it.li ? 0 : 1) - it.k) * (1 - Math.pow(.88, df));
      const a = amp * it.k;
      const dx = (it.x - 50) * W / 100, dy = (it.y - 50) * H / 100;
      const X = 50 + (dx * cs - dy * sn) * 100 / W + Math.sin(t * it.fx + it.px) * it.ax * a;
      const Y = 50 + (dx * sn + dy * cs) * 100 / H + Math.cos(t * it.fy + it.py) * it.ay * a;
      it.li.style.translate = `${((X - it.x) * W / 100).toFixed(2)}px ${((Y - it.y) * H / 100).toFixed(2)}px`;
      if (it.line) { it.line.setAttribute('x2', X.toFixed(3)); it.line.setAttribute('y2', Y.toFixed(3)); it.line.style.setProperty('--tw', (.72 + .28 * Math.sin(t * it.tw + it.tp)).toFixed(3)); }
    });
  });
  if (any) driftRaf = requestAnimationFrame(driftFrame);
}
// 背景の星。大きさの違う点が、ゆっくり瞬きながら少しずつ流れる
const SKIES = new Set(); let skyRaf = 0, skyLast = 0, skyOdd = false;
function starSky(host, density = 5200) {
  if (!host || host._sky) return;
  const c = document.createElement('canvas'); c.className = 'stars'; c.setAttribute('aria-hidden', 'true'); host.prepend(c);
  const S = { host, c, ctx: c.getContext('2d'), list: [], w: 0, h: 0, dpr: 1, vis: false, t0: performance.now() };
  host._sky = S; SKIES.add(S);
  const build = () => {
    S.w = Math.max(1, Math.round(host.clientWidth)); S.h = Math.max(1, Math.round(host.clientHeight));
    // 星は小さな点なので、解像度は控えめでよい（大きなキャンバスの描き直しと転送が、スマホでいちばん重かった）
    S.dpr = Math.min(devicePixelRatio || 1, innerWidth <= 720 ? 1.25 : 1.5, Math.sqrt(1.8e6 / (S.w * S.h)));
    c.width = Math.round(S.w * S.dpr); c.height = Math.round(S.h * S.dpr);
    const rnd = seeded(S.w * 31 + S.h * 7 + 1), n = Math.min(420, Math.round(S.w * S.h / density));
    S.list = Array.from({ length: n }, () => { const big = rnd() < .07; const r = rnd(); return { x: rnd(), y: rnd(), r: big ? 1.05 + rnd() * .85 : .4 + rnd() * .55, a: big ? .55 + rnd() * .35 : .16 + rnd() * .42, f: .35 + rnd() * 1.25, p: rnd() * 6.28, col: r < .1 ? '#69d9ee' : r < .14 ? '#ff8fab' : '#ffffff', vx: (rnd() - .5) * 1.4, vy: -(.2 + rnd() * .6) }; });
    drawSky(S, performance.now());
  };
  let to = 0; new ResizeObserver(() => { clearTimeout(to); to = setTimeout(build, 120); }).observe(host);
  new IntersectionObserver(es => { S.vis = es[0].isIntersecting; wakeSky(); }).observe(host);
  build();
}
function drawSky(S, now) {
  const { ctx, w, h } = S, t = (now - S.t0) / 1000, still = reduced;
  ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  for (const s of S.list) {
    const tw = still ? .8 : .5 + .5 * Math.sin(t * s.f + s.p);
    let x = s.x * w + (still ? 0 : s.vx * t), y = s.y * h + (still ? 0 : s.vy * t);
    x = ((x % w) + w) % w; y = ((y % h) + h) % h;
    ctx.globalAlpha = s.a * (.25 + .75 * tw); ctx.fillStyle = s.col;
    ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.2832); ctx.fill();
    if (s.r > 1.2) { ctx.globalAlpha = s.a * tw * .4; ctx.fillRect(x - s.r * 3.2, y - .35, s.r * 6.4, .7); ctx.fillRect(x - .35, y - s.r * 3.2, .7, s.r * 6.4); }
  }
  ctx.globalAlpha = 1;
}
function wakeSky() { if (!skyRaf) skyRaf = requestAnimationFrame(skyFrame); }
function skyFrame(now) {
  skyRaf = 0; let any = false;
  SKIES.forEach(S => {
    if (!S.host.isConnected) { SKIES.delete(S); return; }
    if (!S.vis) return;
    if (reduced || document.hidden) { if (!S.still) { S.still = true; drawSky(S, now); } return; }
    S.still = false; any = true;
  });
  // 星の描き直しは、体制図の2コマに1回（1秒に7〜8回）。大きなキャンバスの転送がいちばん重いため
  if (any) { if (slowTick(now) && (skyOdd = !skyOdd)) { skyLast = now; SKIES.forEach(S => { if (S.vis && !S.still) drawSky(S, now); }); } skyRaf = requestAnimationFrame(skyFrame); }
}
document.addEventListener('slash:motion', () => { wakeNets(); SKIES.forEach(S => { S.still = false; drawSky(S, performance.now()); }); wakeSky(); });
document.addEventListener('visibilitychange', () => { wakeNets(); wakeSky(); });
addEventListener('resize', wakeNets);
// スマホ（720px以下）でも星座の図にする：横を詰めて、縦長の楕円に置く。画面の幅が境目をまたいだら置き直す
const NET_MQ = matchMedia('(max-width: 720px)');
function layoutNet(net) {
  const k = NET_MQ.matches ? .8 : 1;
  placedRoles.forEach(({ r, x, y }) => {
    const X = 50 + (x - 50) * k, li = net.querySelector(`.role[data-role="${r.id}"]`), ln = net.querySelector(`line[data-role="${r.id}"]`);
    if (li) { li.style.setProperty('--x', X.toFixed(2) + '%'); li.style.setProperty('--y', y.toFixed(2) + '%'); li.style.translate = ''; }
    if (ln) { ln.setAttribute('x2', X.toFixed(2)); ln.setAttribute('y2', y.toFixed(2)); }
  });
  if (NET_MQ.matches) relaxNet(net);
  const st = net._drift; if (st) st.items.forEach(it => { it.x = parseFloat(it.li.style.getPropertyValue('--x')); it.y = parseFloat(it.li.style.getPropertyValue('--y')); });
}
// スマホ：役割の札どうしが重ならないよう、楕円の位置から少しずつ押し広げる（中心の円もよけ、枠の中に収める）
function relaxNet(net) {
  const W = net.clientWidth, H = net.clientHeight; if (!W || !H) return;
  const core = net.querySelector('.team-core'), cr = core ? core.offsetWidth / 2 + 12 : 0, PAD = 12;
  const items = placedRoles.map(({ r }) => {
    const li = net.querySelector(`.role[data-role="${r.id}"]`), b = li && li.firstElementChild; if (!b) return null;
    return { li, ln: net.querySelector(`line[data-role="${r.id}"]`), w: b.offsetWidth + PAD, h: b.offsetHeight + PAD, x: parseFloat(li.style.getPropertyValue('--x')) * W / 100, y: parseFloat(li.style.getPropertyValue('--y')) * H / 100 };
  }).filter(Boolean);
  for (let n = 0; n < 800; n++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j], ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
      if (ox <= 0 || oy <= 0) continue;
      moved = true;
      // 縦に長い枠なので、上下にずらす方を優先する（左右は端で詰まりやすい）
      if (ox * 2.2 < oy) { const d = ox / 2 * (Math.sign(a.x - b.x) || 1); a.x += d; b.x -= d; } else { const d = oy / 2 * (Math.sign(a.y - b.y) || 1); a.y += d; b.y -= d; }
    }
    items.forEach(a => {
      const dx = a.x - W / 2, dy = a.y - H / 2, d = Math.hypot(dx, dy) || 1, need = cr + Math.min(a.w, a.h * 2) / 2;
      if (d < need) { a.x = W / 2 + dx / d * need; a.y = H / 2 + dy / d * need; moved = true; }
      a.x = Math.min(W - a.w / 2 + PAD / 2, Math.max(a.w / 2 - PAD / 2, a.x)); a.y = Math.min(H - a.h / 2 + PAD / 2, Math.max(a.h / 2 - PAD / 2, a.y));
    });
    if (!moved) break;
  }
  items.forEach(a => {
    const X = a.x / W * 100, Y = a.y / H * 100;
    a.li.style.setProperty('--x', X.toFixed(2) + '%'); a.li.style.setProperty('--y', Y.toFixed(2) + '%');
    if (a.ln) { a.ln.setAttribute('x2', X.toFixed(2)); a.ln.setAttribute('y2', Y.toFixed(2)); }
  });
}
NET_MQ.addEventListener('change', () => { NETS.forEach(st => layoutNet(st.net)); wakeNets(); });
// 文字の形は表示を待たせずに読み込む（boot.js）ので、届いたあとに役割の札の大きさが変わる。そのたびに置き直す
if (document.fonts) {
  let relayT = 0; const relayNets = () => { clearTimeout(relayT); relayT = setTimeout(() => { if (NET_MQ.matches) NETS.forEach(st => layoutNet(st.net)); }, 200); }; // 和文の書体は小分けに届くので、まとめて1回
  if (document.fonts.ready) document.fonts.ready.then(relayNets);
  if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', relayNets);
}
window.SlashTeam = { netHTML: teamNetHTML, paint: paintTeamNet, role: id => roleById[id], usedBy, groups, legend: teamLegend, animate: animateNet, sky: starSky };

const net = $('#team-net'), panel = $('#team-panel'), caseChips = $('#team-cases');
let teamCase = null, teamRole = null;
if (net && roles.length) {
  net.innerHTML = teamNetHTML();
  animateNet(net); starSky($('.team'));
  const rolesBox = $('.team-roles', net);
  caseChips.innerHTML = `<button type="button" data-case="" aria-pressed="true">すべて</button>` + D.projects.map(p => `<button type="button" data-case="${p.id}" aria-pressed="false">${esc(p.title)}</button>`).join('');
  const defaultPanel = () => `<p class="tp-kicker">1 + 20</p><h3 class="tp-title">ONE TEAM<br>PER CASE</h3><p class="tp-text">代表がすべての案件で全体を設計し、案件ごとに必要な専門家を集めます。上の事例を選ぶと、その案件の体制が光ります。役割を選ぶと、その役割が入った事例を表示します。</p>${teamLegend()}`;
  function paint() {
    const set = teamCase ? new Set(byId[teamCase].team) : teamRole ? new Set([teamRole]) : null;
    paintTeamNet(net, set, teamRole);
    $$('button', caseChips).forEach(b => b.setAttribute('aria-pressed', String((b.dataset.case || null) === teamCase)));
    if (teamCase) {
      const p = byId[teamCase];
      panel.innerHTML = `<p class="tp-kicker">${p.no} — ${esc(p.industry)} / ${esc(p.year)}</p><h3 class="tp-title">${esc(p.title)}</h3><p class="tp-text">${esc(p.label)}。${p.team.length}つの役割で組みました。</p><ul class="tp-list">${p.team.map(id => `<li>${esc((roleById[id] || {}).label)}</li>`).join('')}</ul><button type="button" class="tp-open" data-open="${p.id}">この事例を詳しく見る ↗</button>`;
    } else if (teamRole) {
      const r = roleById[teamRole], list = usedBy(teamRole);
      panel.innerHTML = `<p class="tp-kicker">${esc(r.en)} — ${esc((groups.find(g => g.id === r.group) || {}).label)}</p><h3 class="tp-title">${esc(r.label)}</h3><p class="tp-text">${esc(r.note)}。</p>${list.length ? `<ul class="tp-list">${list.map(p => `<li><button type="button" data-open="${p.id}">${esc(p.title)} ↗</button></li>`).join('')}</ul>` : '<p class="tp-text">案件に応じて参加します。</p>'}`;
    } else panel.innerHTML = defaultPanel();
  }
  caseChips.addEventListener('click', e => { const b = e.target.closest('[data-case]'); if (!b) return; teamCase = b.dataset.case || null; teamRole = null; paint(); track('team_select', { team_kind: 'case', team_value: teamCase ? byId[teamCase].label : 'すべて' }); });
  // スマホ：役割を選んだら、説明の欄が画面の外なら見える位置へ送る
  const showPanel = () => { if (innerWidth > 720) return; const r = panel.getBoundingClientRect(), top = header.offsetHeight; if (r.top < top || r.top > innerHeight - 120) panel.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }); };
  rolesBox.addEventListener('click', e => { const li = e.target.closest('.role'); if (!li) return; teamRole = teamRole === li.dataset.role ? null : li.dataset.role; teamCase = null; paint(); if (teamRole) { showPanel(); track('team_select', { team_kind: 'role', team_value: (roleById[teamRole] || {}).label }); } });
  panel.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b && window.SlashWorks) window.SlashWorks.open(b.dataset.open, b, 'team'); });
  paint();
}
const partnerList = $('#partner-list');
if (partnerList) partnerList.innerHTML = (D.partners || []).map(p => `<li><b>${p.href ? `<a href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.name)} ↗</a>` : esc(p.name)}</b><span>${esc(p.note)}</span></li>`).join('');

/* ---------- プロフィール ----------
 * 写真は、目元をぽーちゃん（猫）の帯で隠したものを焼き込み済み。口元のぽーちゃんは、写真が開いたあとに貼り付く。 */
const pf = D.profile, pfBox = $('#profile-body');
if (pf && pfBox) {
  pfBox.innerHTML = `<div class="pf-side">
    <figure class="pf-photo"><span class="pf-frame"><img class="pf-portrait" src="${esc(pf.photo)}" alt="代表 ${esc(pf.name)} の写真（目元と口元を、猫のぽーちゃんの写真で隠しています）" width="470" height="588" loading="lazy" decoding="async">${pf.pet ? `<img class="pf-sticker" src="${esc(pf.pet.src)}" alt="" width="300" height="300" loading="lazy" decoding="async">` : ''}</span>${pf.photo_note ? `<figcaption>${esc(pf.photo_note)}</figcaption>` : ''}</figure>
    <div class="pf-id"><p class="pf-name">${esc(pf.name)}<small>${esc(pf.en)}</small></p><ul class="pf-titles">${pf.titles.map(t => `<li><span>${esc(t)}</span></li>`).join('')}</ul></div>
    ${(pf.likes && pf.likes.length) || (pf.weak && pf.weak.length) ? `<dl class="pf-likes">${pf.likes && pf.likes.length ? `<dt>好きなこと</dt><dd class="pf-like-tags">${pf.likes.map(l => `<span>${esc(l)}</span>`).join('')}</dd>` : ''}${pf.weak && pf.weak.length ? `<dt class="pf-weak-dt">苦手なこと</dt><dd class="pf-like-tags pf-weak-tags">${pf.weak.map(l => `<span>${esc(l)}</span>`).join('')}</dd>` : ''}</dl>` : ''}
    <p class="pf-links">${(pf.links || []).map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</p>
  </div>
  <div class="pf-text">
    ${pf.lead ? `<p class="pf-lead">${esc(pf.lead)}</p>` : ''}
    ${pf.body && pf.body.length ? `<div class="pf-body">${pf.body.map(b => `<p>${esc(b)}</p>`).join('')}</div>` : ''}
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
    if (viaMail) { track('generate_lead', { contact_method: 'form_mail' }); location.href = mailto(d); status.innerHTML = `メールアプリが開きます。開かない場合は、<a href="mailto:nakai@slashslash.jp">nakai@slashslash.jp</a> へ直接お送りください。`; return; }
    btn.disabled = true; status.textContent = '送信しています…';
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: d.name, company: d.company, email: d.email, message: (d.topics ? `【ご相談の領域】${d.topics}\n\n` : '') + d.message, website: d.website, consent: true }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) { track('generate_lead', { contact_method: 'form' }); form.reset(); status.textContent = '送信しました。内容を確認のうえ、ご連絡します。'; }
      else throw new Error(data.error || 'unavailable');
    } catch (err) {
      status.innerHTML = `フォームから送信できませんでした。お手数ですが、<a href="${esc(mailto(d))}">メールアプリで送る</a>か、nakai@slashslash.jp へ直接お送りください。入力内容は残しています。`;
    } finally { btn.disabled = false; }
  });
}

setReduced(reduced, false);
});
