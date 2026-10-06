/* s/ash WORKS — 実績の3つの表示（1件ずつ・カード・一覧）、タグの絞り込み、事例の詳細（CASE）。
 * データは works.js（window.SLASH_WORKS）。「1件ずつ」は4枚の面を透視変換で並べ、選んだ面から事例の詳細へ切り替える。
 * 動きを止める設定（OS・ヘッダーのボタン）では、浮遊・自動再生・切り替えの演出を止める。 */
(window.slashInit || function (f) { f(); })(function () {
'use strict';
const D = window.SLASH_WORKS; if (!D) return;
const projects = D.projects, archive = D.archive || [];
const TAG = Object.fromEntries(D.tags.map(t => [t.id, t]));
const ROLE = Object.fromEntries((D.roles || []).map(r => [r.id, r]));
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n)), lerp = (a, b, t) => a + (b - a) * t;
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const yearOf = y => { const m = String(y).match(/(\d{4})(?!.*\d{4})/); return m ? +m[1] : 0; };
const isPortrait = a => a && a.ratio > 1.15;
const mp4 = src => src.replace(/\.webm$/, '.mp4');
const fine = matchMedia('(hover:hover) and (pointer:fine)');
let reduced = document.body.classList.contains('reduced');
const announce = t => { const a = $('#announcement'); if (a) a.textContent = t; };
// 計測（analytics.js。本番だけで動く）
const track = (name, params) => { try { if (window.slashTrack) window.slashTrack(name, params); } catch (e) { } };

/* ================= 状態 ================= */
// 初めての人には、いちばん迷わない「カード」を見せる（表示の選択は端末に保存。2026-10-05 に鍵を改め、全員カードから）
const state = { area: null, field: null, tag: null, view: 'grid', current: 0 };
try { const v = localStorage.getItem('slash-view3'); if (v && ['layers', 'grid', 'list'].includes(v)) state.view = v; } catch (e) { }
const SV = D.services || [], AREA = Object.fromEntries(SV.map(s => [s.id, s])), AREA_TAGS = D.areaTags || {};
// 事例の業務領域は、業務領域の節の「関係する事例」と同じ（食い違わない）。これまでの取り組みは、タグから領域を引く
const PA = Object.fromEntries(projects.map(p => [p.id, SV.filter(s => s.works.includes(p.id)).map(s => s.id)]));
const archAreas = a => SV.filter(s => (AREA_TAGS[s.id] || []).some(t => a.tags.includes(t))).map(s => s.id);
const areaText = ids => ids.map(id => (AREA[id] || {}).short || '').filter(Boolean).join('・');
const CASES = projects.map((p, i) => ({ kind: 'case', p, i, tags: p.tags, areas: PA[p.id], year: yearOf(p.year) }));
const ARCH = archive.map((a, i) => ({ kind: 'arch', a, i, tags: a.tags, areas: archAreas(a), year: yearOf(a.year) }));
const fits = (x, f = state) => (!f.area || x.areas.includes(f.area)) && (!f.field || x.tags.includes(f.field)) && (!f.tag || x.tags.includes(f.tag));
const visibleProjects = (f = state) => CASES.filter(x => fits(x, f)).map(({ p, i }) => ({ p, i }));
const listItems = (f = state) => CASES.concat(ARCH).filter(x => fits(x, f)).sort((x, y) => y.year - x.year || (x.kind === 'case' ? -1 : 1) - (y.kind === 'case' ? -1 : 1) || 0);
const resultCount = (f = state) => state.view === 'list' ? listItems(f).length : visibleProjects(f).length;
const filtered = () => !!(state.area || state.field || state.tag);
// カードと一覧は、初めは閉じて上の数件だけを見せ、「すべての事例を見る」で全部を開く（条件や表示を変えると、閉じた状態に戻る）
let more = false;

/* ================= 絞り込み：業務領域のタブ（主）・業種（従）・タグ（事例の中のタグから） ================= */
const fArea = $('#f-area'), fField = $('#f-field'), wsTitle = $('#ws-title'), wsDesc = $('#ws-desc'), wsPills = $('#ws-pills'), worksBar = $('#works-bar');
const FIELDS = D.tags.filter(t => t.group === 'field').map(t => ({ t, total: CASES.concat(ARCH).filter(x => x.tags.includes(t.id)).length })).filter(x => x.total).sort((a, b) => b.total - a.total);
function renderFilters() {
  // 業務領域：選ぶと該当がなくなる領域は薄く（押せる）
  fArea.innerHTML = [{ id: '', label: 'すべて' }].concat(SV.map(s => ({ id: s.id, label: s.short || s.name }))).map(({ id, label }) => {
    const n = id ? resultCount({ ...state, area: id }) : 1, on = (state.area || '') === id;
    return `<button type="button" data-area="${id}" aria-pressed="${on}" class="${n ? '' : 'zero'}"${id ? ` title="${esc(AREA[id].name)}"` : ''}>${esc(label)}</button>`;
  }).join('');
  // 業種：件数の多い順。選ぶと該当がなくなる業種には（該当なし）
  fField.innerHTML = `<option value="">すべての業種</option>` + FIELDS.map(({ t }) => `<option value="${t.id}"${state.field === t.id ? ' selected' : ''}>${esc(t.label)}${resultCount({ ...state, field: t.id }) ? '' : '（該当なし）'}</option>`).join('');
  fField.closest('.ws-select').classList.toggle('on', !!state.field);
  // いまの条件
  const s = state.area && AREA[state.area];
  const what = state.view === 'list' ? '事例・取り組み' : '事例';
  wsTitle.textContent = s ? `${s.name}の${what}` : filtered() ? `絞り込んだ${what}` : (state.view === 'list' ? 'すべての事例と、これまでの取り組み' : 'すべての事例');
  wsDesc.textContent = s ? s.body : '';
  wsPills.innerHTML = (state.field ? `<button type="button" data-clear="field">業種：${esc(TAG[state.field].label)}<i aria-hidden="true">×</i></button>` : '') +
    (state.tag ? `<button type="button" data-clear="tag">タグ：${esc(TAG[state.tag].label)}<i aria-hidden="true">×</i></button>` : '') +
    (filtered() ? `<button type="button" data-clear="all" class="ws-reset">条件をすべて解除</button>` : '');
  requestAnimationFrame(() => { showActiveTab(); tabEdges(); });
}
// 選んだタブが横にはみ出していたら、見える位置へ寄せる（スマホ）
function showActiveTab() { const b = $('[aria-pressed=true]', fArea); if (!b) return; const r = fArea.getBoundingClientRect(), br = b.getBoundingClientRect(); if (br.left < r.left + 8 || br.right > r.right - 8) fArea.scrollTo({ left: b.offsetLeft - (r.width - br.width) / 2, behavior: reduced ? 'instant' : 'smooth' }); }
// 条件を変えたら、結果の頭が見える位置へ（下の方で押したときだけ）
function toResults() {
  const sub = $('.works-sub'); if (!sub) return;
  const head = document.getElementById('header'), barH = worksBar.offsetHeight, top = sub.getBoundingClientRect().top, want = (head ? head.offsetHeight : 0) + barH;
  if (top < want - 2) window.scrollBy({ top: top - want, behavior: reduced ? 'instant' : 'smooth' });
}
function setFilters(patch, opts = {}) {
  Object.assign(state, patch); more = false;
  if (state.view === 'layers' && !visibleProjects().length && opts.fallback) state.view = 'list';
  renderFilters(); renderView(true);
  const s = state.area && AREA[state.area];
  const label = [s && s.name, state.field && TAG[state.field].label, state.tag && TAG[state.tag].label].filter(Boolean).join('、');
  announce(label ? `${label}で絞り込みました。${resultCount()}件。` : 'すべての事例を表示しています。');
  if (!opts.noScroll) toResults();
}
fArea.addEventListener('click', e => {
  const b = e.target.closest('[data-area]'); if (!b) return;
  const id = b.dataset.area || null; if (id === state.area) return;
  setFilters({ area: id });
  track('filter_works', { filter_type: 'area', filter_value: id ? AREA[id].name : 'すべて', ui_from: 'works' });
  if (e.detail === 0) { const again = fArea.querySelector(`[data-area="${b.dataset.area}"]`); if (again) again.focus({ preventScroll: true }); }
});
fField.addEventListener('change', () => { setFilters({ field: fField.value || null }, { noScroll: true }); track('filter_works', { filter_type: 'field', filter_value: state.field ? TAG[state.field].label : 'すべての業種', ui_from: 'works' }); });
wsPills.addEventListener('click', e => { const b = e.target.closest('[data-clear]'); if (!b) return; const k = b.dataset.clear; setFilters(k === 'all' ? { area: null, field: null, tag: null } : { [k]: null }, { noScroll: true }); track('filter_works', { filter_type: 'clear', filter_value: k, ui_from: 'works' }); });
// 事例の中のタグ（1件ずつの表示・事例の詳細）から：業種のタグは業種に、ほかはタグとして絞る
function filterByTag(id, from = 'case') {
  const t = TAG[id]; if (!t) return;
  setFilters(t.group === 'field' ? { field: id, area: null, tag: null } : { tag: id, area: null }, { fallback: true, noScroll: true });
  track('filter_works', { filter_type: t.group === 'field' ? 'field' : 'tag', filter_value: t.label, ui_from: from });
  jumpToBar();
}
// 帯は画面の上に貼り付く（sticky）ため、帯そのものの位置ではなく、帯の直前に置いた目印の位置で移る。止まったあと、ずれていれば合わせ直す
function jumpToBar() {
  const headH = () => { const h = document.getElementById('header'); return h ? h.offsetHeight : 0; };
  const off = () => barSentinel.getBoundingClientRect().top - headH();
  window.scrollTo({ top: off() + scrollY, behavior: reduced ? 'instant' : 'smooth' });
  const fix = () => { const d = off(); if (Math.abs(d) > 2) window.scrollBy({ top: d, behavior: 'instant' }); };
  if ('onscrollend' in window && !reduced) addEventListener('scrollend', fix, { once: true }); else requestAnimationFrame(() => requestAnimationFrame(fix));
}
// タブの帯が画面の上に貼り付いたら、影をつける
const barSentinel = document.createElement('i'); barSentinel.className = 'wb-sentinel'; barSentinel.setAttribute('aria-hidden', 'true'); worksBar.before(barSentinel);
new IntersectionObserver(es => { const r = es[0]; worksBar.classList.toggle('stuck', !r.isIntersecting && r.boundingClientRect.top < 200); }, { rootMargin: '-80px 0px 0px 0px' }).observe(barSentinel);
// タブが横にはみ出すときは、続きがある側の端をぼかす（スクロールできることを見せる）
function tabEdges() { const max = fArea.scrollWidth - fArea.clientWidth; fArea.classList.toggle('more-left', fArea.scrollLeft > 4); fArea.classList.toggle('more-right', max > 4 && fArea.scrollLeft < max - 4); }
fArea.addEventListener('scroll', tabEdges, { passive: true }); new ResizeObserver(tabEdges).observe(fArea);
// タブはマウスのホイールでも横に送れる
fArea.addEventListener('wheel', e => { if (!fine.matches || Math.abs(e.deltaX) > Math.abs(e.deltaY) || fArea.scrollWidth <= fArea.clientWidth + 2) return; e.preventDefault(); fArea.scrollLeft += e.deltaY; }, { passive: false });

/* ================= 表示の切り替え（カード・一覧・1件ずつ） ================= */
const views = { layers: $('#view-layers'), grid: $('#view-grid'), list: $('#view-list') }, viewsBox = $('#works-views');
function syncViewButtons() { $$('.ws-views [data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === state.view))); Object.entries(views).forEach(([k, el]) => { el.hidden = k !== state.view; }); syncHowto(); }
/* 使い方の一文（表示ごと・画面の幅ごと） */
const howto = $('#works-howto-text');
function syncHowto() {
  if (!howto) return;
  const wide = innerWidth > 960, touch = !fine.matches, press = touch ? 'タップ' : 'クリック';
  if (state.view === 'layers') howto.innerHTML = `<b class="n">①</b>${wide ? '左' : '上'}の一覧から事例を選ぶ <i aria-hidden="true">→</i> <b class="n">②</b>画面を${press}すると、詳細が開きます${touch ? '（左右のスワイプで前後の事例へ）' : ''}`;
  else if (state.view === 'grid') howto.textContent = `カードを${press}すると、事例の詳細が開きます。`;
  else howto.textContent = `「事例」の行は詳細が、「実施」「提案」「試作」の行は概要が開きます。`;
}
addEventListener('resize', () => { clearTimeout(syncHowto._t); syncHowto._t = setTimeout(syncHowto, 150); });
function setView(v) {
  if (v === state.view) return;
  track('change_view', { view_mode: v });
  const go = () => { state.view = v; more = false; try { localStorage.setItem('slash-view3', v); } catch (e) { } syncViewButtons(); renderFilters(); renderView(true); };
  if (reduced) { go(); return; }
  viewsBox.classList.remove('wipe'); void viewsBox.offsetWidth; viewsBox.classList.add('wipe');
  setTimeout(go, 330); setTimeout(() => viewsBox.classList.remove('wipe'), 760);
}
$$('.ws-views [data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
$('.ws-views').addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; const order = ['grid', 'list', 'layers']; const i = order.indexOf(state.view); const n = order[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setView(n); setTimeout(() => $(`.ws-views [data-view="${n}"]`).focus(), 360); });
// 流れる帯：1件ずつの表示ではその事例の言葉、ほかの表示では事例の名前を流す
function tapeAll() { const t = projects.map(p => esc(p.title)).join(' <i>/</i> '); $('#strip-track').innerHTML = `<span>${t} <i>/</i> </span><span>${t} <i>/</i> </span>`; }
function renderView(changed) {
  const empty = $('#works-empty');
  const vis = visibleProjects();
  if (state.view !== 'list' && !vis.length) {
    empty.hidden = false; Object.values(views).forEach(el => { el.hidden = true; });
    const inList = listItems().length;
    empty.innerHTML = `この条件の事例はありません。<button type="button" data-clear-all>条件をすべて解除する</button>${inList ? `<button type="button" id="to-list">「一覧」で、これまでの取り組みを見る →</button>` : ''}`;
    const tl = $('#to-list'); if (tl) tl.addEventListener('click', () => setView('list'));
    $('[data-clear-all]', empty).addEventListener('click', () => { setFilters({ area: null, field: null, tag: null }, { noScroll: true }); track('filter_works', { filter_type: 'clear', filter_value: 'all', ui_from: 'works_empty' }); });
    stopStage(); return;
  }
  if (state.view === 'list' && !listItems().length) {
    empty.hidden = false; Object.values(views).forEach(el => { el.hidden = true; });
    empty.innerHTML = `この条件の事例・取り組みはありません。<button type="button" data-clear-all>条件をすべて解除する</button>`;
    $('[data-clear-all]', empty).addEventListener('click', () => { setFilters({ area: null, field: null, tag: null }, { noScroll: true }); track('filter_works', { filter_type: 'clear', filter_value: 'all', ui_from: 'works_empty' }); });
    stopStage(); return;
  }
  empty.hidden = true; syncViewButtons();
  if (state.view === 'layers') { renderPlist(); if (!vis.some(x => x.i === state.current)) selectProject(vis[0].i, true); else if (changed) mount(state.current); startStage(); }
  else { stopStage(); tapeAll(); }
  if (state.view === 'grid') renderGrid();
  if (state.view === 'list') renderList();
}

/* ================= 立体（LAYERS） ================= */
const stage = $('#stage'), scene = $('#scene'), plist = $('#plist');
let planes = [], hot = -1, hotAmt = [0, 0, 0, 0], running = false, raf = 0, clock = 0, last = 0, mx = 0, my = 0, tx = 0, ty = 0, inView = true, switching = false, switchTimer = 0, stageW = 800, stageH = 450;
let brain = null, brainTimer = 0, brainStep = 0, brainLoading = null;
function renderPlist() {
  const vis = visibleProjects();
  plist.innerHTML = vis.map(({ p, i }) => `<li><button type="button" class="pl-item" data-i="${i}" aria-current="${i === state.current}"><span class="pl-no">${p.no}</span><span class="pl-copy"><strong>${esc(p.title)}</strong><span>${esc(p.label)}</span><small>${esc(p.industry)} / ${esc(p.year)}</small></span><span class="pl-arrow" aria-hidden="true">→</span></button></li>`).join('');
}
plist.addEventListener('click', e => { const b = e.target.closest('.pl-item'); if (b) selectProject(+b.dataset.i); });
function markPlist() { $$('.pl-item', plist).forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === state.current))); const a = $('.pl-item[aria-current=true]', plist); if (a) { const lr = plist.getBoundingClientRect(), ar = a.getBoundingClientRect(); if (ar.top < lr.top || ar.bottom > lr.bottom || ar.left < lr.left || ar.right > lr.right) a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }); } }
const shell = (inner, cls, i, L, p) => `<div class="plane ${cls}" data-plane="${i}" tabindex="0" role="button" data-cursor="詳しく見る" aria-label="${pad(i + 1)} ${esc(L.name)} — ${esc(p.label)}の事例の詳細を開く" style="--layer:${i}"><div class="plane-content">${inner}</div><span class="plane-open" aria-hidden="true"><span>${pad(i + 1)} / ${esc(L.name)}</span><span>詳しく見る ↗</span></span></div>`;
function layerHTML(L, i, p) {
  const lab = `<span class="layer-label">${pad(i + 1)} / ${esc(L.name)}</span>`, tag = L.tag ? `<span class="layer-tag">${esc(L.tag)}</span>` : '';
  const pos = esc(L.focus || '50% 50%');
  switch (L.type) {
    case 'image': return shell(`<img class="plane-media" src="${esc(L.src)}" alt="${esc(L.alt)}" style="object-position:${pos}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async" draggable="false">${lab}${tag}`, `media-wrap tone-${esc(L.tone || 'light')}`, i, L, p);
    case 'video': return shell(`<video class="plane-media" muted loop playsinline preload="none" poster="${esc(L.poster || '')}" aria-label="${esc(L.alt)}" style="object-position:${pos}"><source src="${esc(L.src)}" type="video/webm"><source src="${esc(mp4(L.src))}" type="video/mp4"></video>${lab}${tag}<span class="layer-live" aria-hidden="true">● PLAY</span>`, 'media-wrap tone-dark', i, L, p);
    case 'brain': return shell(`<div class="brain-wrap"><canvas class="brain-canvas" aria-hidden="true"></canvas><div class="brain-labels" aria-hidden="true"></div></div>${lab}${tag}<div class="brain-hud" aria-hidden="true"><b>NAVI</b><span class="brain-state">LISTENING</span><p class="brain-line"></p></div>`, 'plane-brain', i, L, p);
    case 'text': return shell(`<div class="text-plane">${lab}<h3>${L.heading}</h3>${L.items.map(([b, s]) => `<div class="tp-item"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('')}<span class="tp-last">${esc(L.last)}</span></div>`, 'plane-text', i, L, p);
    case 'steps': return shell(`<div class="steps-plane">${lab}<h3>${L.heading}</h3>${L.steps.map(([a, b], n) => `<div class="sp-step"><i>${pad(n + 1)}</i><span>${esc(a)} — ${esc(b)}</span></div>`).join('')}</div>`, 'plane-steps', i, L, p);
  }
  return shell('', '', i, L, p);
}
function mount(index) {
  stopBrain();
  state.current = index; const p = projects[index];
  scene.innerHTML = p.layers.map((L, i) => layerHTML(L, i, p)).join('');
  planes = $$('.plane', scene); hot = -1; hotAmt = [0, 0, 0, 0];
  planes.forEach((el, i) => {
    el.style.zIndex = String(4 - i);
    el.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') setHot(i); });
    el.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse' && hot === i) setHot(-1); });
    el.addEventListener('focus', () => setHot(i)); el.addEventListener('blur', () => { if (hot === i) setHot(-1); });
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openCase(index, { layer: i, from: el, src: 'layers' }); } });
  });
  $('#ghost').textContent = p.no;
  const tape = (p.tape || [p.title]).map(esc).join(' <i>/</i> ');
  $('#strip-track').innerHTML = `<span>${tape} <i>/</i> </span><span>${tape} <i>/</i> </span><span>${tape} <i>/</i> </span><span>${tape} <i>/</i> </span>`;
  $('#sc-kicker').textContent = `${p.no} — ${p.kicker} / ${p.industry} / ${p.year}`;
  $('#sc-title').textContent = p.title; $('#sc-sub').textContent = p.subtitle;
  $('#sc-tags').innerHTML = p.tags.map(t => `<li><button type="button" class="${TAG[t].group === 'field' ? 'is-field' : ''}" data-tag="${t}">${esc(TAG[t].label)}</button></li>`).join('');
  const head = $('.sc-head'); head.classList.remove('entering'); void head.offsetWidth; head.classList.add('entering');
  scene.classList.remove('revealing'); requestAnimationFrame(() => scene.classList.add('revealing'));
  markPlist(); measure();
  if (p.layers.some(l => l.type === 'brain')) startBrain();
  syncPlayback();
  if (location.hash.startsWith('#w-') || location.hash === '#works') history.replaceState(null, '', `#w-${p.id}`);
}
$('#sc-tags').addEventListener('click', e => { const b = e.target.closest('[data-tag]'); if (b) filterByTag(b.dataset.tag, 'layers'); });
$('#case-cta').addEventListener('click', e => openCase(state.current, { from: planes[0] || e.currentTarget, src: 'layers' }));
function setHot(i) {
  hot = i; planes.forEach((el, k) => { el.classList.toggle('hot', k === i); el.style.zIndex = k === i ? '9' : String(4 - k); });
  if (reduced) drawScene();
}
function selectProject(index, force) {
  if (index === state.current && !force && planes.length) return;
  clearTimeout(switchTimer); switching = true; stage.classList.add('changing');
  switchTimer = setTimeout(() => { mount(index); stage.classList.remove('changing'); switching = false; }, reduced ? 0 : 380);
}
function step(delta) { const vis = visibleProjects(); if (!vis.length) return; const at = Math.max(0, vis.findIndex(x => x.i === state.current)); selectProject(vis[(at + delta + vis.length) % vis.length].i); announce(`${projects[vis[(at + delta + vis.length) % vis.length].i].title}を表示しました。`); }
$$('.stage-steps [data-step]').forEach(b => b.addEventListener('click', () => step(+b.dataset.step)));

function measure() { stageW = stage.clientWidth; stageH = stage.clientHeight; computeFit(); drawScene(); if (brain) brain.resize(); }
// 4枚の面を扇状に置く。全体の倍率と位置（fit）は、動きを除いた基本の形から一度だけ決める。
// 毎フレーム決め直すと、浮遊やホバーのたびに全体が伸び縮みして、狙った面が逃げてしまうため。
const LAYOUT = { pc: { spread: [.40, .32, .28, .25], spots: [.02, .31, .56, .77] }, sp: { spread: [.66, .56, .48, .40], spots: [.01, .22, .46, .66] } };
const TILT = [-9, 9, -7, 11], TOPS = [.13, .06, .29, .15], HEIGHTS = [.76, .70, .59, .72];
function geom(i, L, h) {
  const g = innerWidth <= 720 ? LAYOUT.sp : LAYOUT.pc;
  const height = HEIGHTS[i] * stageH * (1 + h * .1);
  let width = g.spread[i] * stageW * (1 + h * .1);
  if (isPortrait(L)) width = Math.min(width, height * (1 / Math.min(L.ratio, 1.78)) * 1.02);
  return { width, height, x: g.spots[i] * stageW - width * h * .05, y: TOPS[i] * stageH - h * 14 };
}
function computeFit() {
  if (!planes.length || !stageW) return;
  const p = projects[state.current], mobile = innerWidth <= 720;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  planes.forEach((el, i) => {
    const g = geom(i, p.layers[i] || {}, 0), m = new DOMMatrix(`perspective(1100px) rotateY(-14deg) rotateZ(${TILT[i]}deg)`);
    for (const [cx, cy] of [[0, 0], [g.width, 0], [g.width, g.height], [0, g.height]]) {
      const q = m.transformPoint(new DOMPoint(cx - g.width / 2, cy - g.height / 2)); const px = g.x + g.width / 2 + q.x / q.w, py = g.y + g.height / 2 + q.y / q.w;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  });
  const pad0 = mobile ? 16 : 30, bottom = mobile ? 58 : 46;
  const fit = Math.min(1, (stageW - pad0 * 2) / (maxX - minX), (stageH - pad0 - bottom) / (maxY - minY)) * .94;
  const ox = (stageW - (maxX - minX) * fit) / 2 - minX * fit, oy = pad0 + (stageH - pad0 - bottom - (maxY - minY) * fit) / 2 - minY * fit;
  scene.style.transform = `translate3d(${ox.toFixed(1)}px,${oy.toFixed(1)}px,0) scale(${fit.toFixed(4)})`;
}
let calm = 0, overStage = false;
function drawScene() {
  if (!planes.length) return;
  const mobile = innerWidth <= 720, t = clock * .001;
  // ポインタがステージに乗っている間は、浮遊を弱めて狙いやすくする。乗っている面はその場で止める
  calm += ((overStage ? 1 : 0) - calm) * (reduced ? 1 : .08);
  const live = reduced ? 0 : (mobile ? .6 : 1), wob = live * (1 - calm * .7);
  const breathe = reduced ? 1 : .94 + Math.sin(t * .42) * .06 * (1 - calm * .7);
  const rx = -my * 10 * live + Math.sin(t * .73) * 6 * wob, ry = mx * 15 * live + Math.sin(t * .61) * 10 * wob;
  const p = projects[state.current];
  planes.forEach((el, i) => {
    hotAmt[i] += ((hot === i ? 1 : 0) - hotAmt[i]) * (reduced ? 1 : .16);
    const h = hotAmt[i], still = 1 - h, L = p.layers[i] || {}, g = geom(i, L, h);
    const phase = t * (.77 + i * .075) + i * 1.7;
    const x = g.x + (mx * (4 - i) * 7 * live + Math.cos(phase * .65) * 9 * wob) * still;
    const y = g.y + (Math.sin(phase) * 18 * wob + my * (3 - i) * 5 * live) * still;
    const ax = (rx + Math.cos(phase * .67) * 3 * wob) * (1 - h * .7), ay = (ry - 14 * breathe + Math.cos(phase * .81) * 4 * wob) * (1 - h * .75);
    const az = (TILT[i] * breathe + Math.sin(phase) * 4 * wob) * (1 - h * .8);
    el.style.width = g.width.toFixed(1) + 'px'; el.style.height = g.height.toFixed(1) + 'px';
    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) perspective(1100px) rotateX(${ax.toFixed(2)}deg) rotateY(${ay.toFixed(2)}deg) rotateZ(${az.toFixed(2)}deg)`;
  });
  $('#ghost').style.transform = `translate3d(${-mx * 22 * live - Math.sin(t * .43) * 12 * wob}px,${my * 14 * live + Math.cos(t * .38) * 12 * wob}px,0) rotate(${Math.sin(t * .32) * -3 * wob}deg)`;
}
function frame(now) {
  raf = 0; if (!running || document.hidden) return;
  const dt = Math.min((now - last) / 1000 || .016, .05); last = now;
  if (inView && !document.documentElement.classList.contains('case-open')) {
    if (!reduced) { clock += dt * 1000; mx += (tx - mx) * (1 - Math.exp(-6 * dt)); my += (ty - my) * (1 - Math.exp(-6 * dt)); }
    drawScene();
  }
  raf = requestAnimationFrame(frame);
}
function startStage() { if (running) return; running = true; last = performance.now(); measure(); if (!raf) raf = requestAnimationFrame(frame); syncPlayback(); }
function stopStage() { running = false; cancelAnimationFrame(raf); raf = 0; syncPlayback(); }
stage.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const r = stage.getBoundingClientRect(); tx = clamp((e.clientX - r.left) / r.width) * 2 - 1; ty = clamp((e.clientY - r.top) / r.height) * 2 - 1; });
stage.addEventListener('pointerleave', () => { tx = ty = 0; overStage = false; });
stage.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') overStage = true; });
// クリック（タップ）で事例の詳細。スマホは左右のスワイプで前後の事例へ
let swipe = null;
stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') swipe = { x: e.clientX, y: e.clientY, t: performance.now() }; });
stage.addEventListener('pointerup', e => { if (!swipe) return; const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; if (Math.abs(dx) > 60 && Math.abs(dy) < 50 && performance.now() - swipe.t < 700) { swipe.used = true; step(dx < 0 ? 1 : -1); } setTimeout(() => { swipe = null; }, 0); });
stage.addEventListener('click', e => {
  if (swipe && swipe.used) return;
  const el = e.target.closest('.plane'); if (!el || switching) return;
  openCase(state.current, { layer: +el.dataset.plane, from: el, src: 'layers' });
});
new ResizeObserver(() => measure()).observe(stage);
new IntersectionObserver(es => { inView = es.some(x => x.isIntersecting); syncPlayback(); }, { rootMargin: '80px 0px' }).observe(stage);
document.addEventListener('visibilitychange', () => { if (!document.hidden && running && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } syncPlayback(); });

/* ナヴィの脳（実際の描画コードを遅延読み込み） */
const BRAIN_SCRIPT = [
  { issues: [{ text: '誰の、どんな場面か' }], say: [{ text: '場面を3つに絞って比べましょう' }], people: [{ name: '企画リード' }, { name: '調査担当' }], research: [{ kind: 'case', title: '場面起点の訴求' }], line: '企画リード：新商品の訴求は、機能より利用場面から考えたい。' },
  { issues: [{ text: '比較する条件を揃える' }], say: [{ text: '期間と対象を揃えないと判断できません' }], flags: [{ type: 'risk', text: '連休で休日の数値が膨らむ' }], people: [{ name: '企画リード' }, { name: '調査担当' }], research: [{ kind: 'term', title: '比較条件の統制' }, { kind: 'kpi', title: '想起率と検討意向' }], line: '調査担当：まずは平日と休日で、反応の違いを比べてみよう。' },
  { issues: [{ text: '使う場面を見せる' }], say: [{ text: '冒頭2秒を場面ごとに作り分けましょう' }], recall: [{ text: '前回は店頭の場面も候補' }], people: [{ name: '企画リード' }], research: [{ kind: 'market', title: '短尺動画の視聴傾向' }], line: '企画リード：広告では、実際に使っている場面を短い動画で見せたい。' },
  { issues: [{ text: '企画を次の行動へ' }], say: [{ text: '候補は3つ。次回までに検証設計をまとめます' }], decisions: [{ text: '訴求候補を3つに絞る' }], flags: [{ type: 'commitment', text: '検証設計を共有する' }], people: [{ name: '調査担当' }], line: '調査担当：次の打ち合わせで、企画案と検証方法を確認しよう。' }
];
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); }); }
function ensureBrainLib() { if (window.NaviBrain) return Promise.resolve(); if (!brainLoading) brainLoading = loadScript('vendor/three.min.js').then(() => loadScript('vendor/brain-site.js')); return brainLoading; }
function stopBrain() { clearInterval(brainTimer); brainTimer = 0; if (brain) { try { brain.dispose(); } catch (e) { } brain = null; } }
function brainFeed() {
  if (!brain) return; const st = BRAIN_SCRIPT[brainStep % BRAIN_SCRIPT.length]; brainStep++;
  brain.update(st); brain.setMode('thinking'); setTimeout(() => brain && brain.setMode('listening'), 1400);
  brain.setLevel(.45); setTimeout(() => brain && brain.setLevel(0), 900);
  const line = $('.brain-line', scene); if (line) line.textContent = st.line;
}
function startBrain() {
  const canvas = $('.brain-canvas', scene); if (!canvas) return;
  ensureBrainLib().then(() => {
    if (!canvas.isConnected || brain) return;
    try { brain = window.NaviBrain({ canvas, labels: $('.brain-labels', scene), mobile: innerWidth <= 720, camY: 2.3, camZ: -1.45, points: innerWidth <= 720 ? 4200 : 6200 }); } catch (e) { canvas.closest('.plane').classList.add('brain-failed'); return; }
    brain.resize(); brainStep = 0; brainFeed(); setTimeout(syncPlayback, 900);
    brainTimer = setInterval(() => { if (!reduced && inView && running && !document.hidden && !caseOpen) brainFeed(); }, 5200);
  }).catch(() => { const pl = canvas.closest('.plane'); if (pl) pl.classList.add('brain-failed'); });
}
function syncPlayback() {
  const play = !reduced && inView && running && !document.hidden && !caseOpen;
  $$('video', scene).forEach(v => { if (play) { if (v.preload !== 'auto') v.preload = 'auto'; const pr = v.play(); if (pr) pr.catch(() => { }); } else v.pause(); });
  if (brain) { if (play) brain.resume(); else brain.pause(); }
}

/* ================= カード（GRID） ================= */
const wallOf = src => String(src || '').replace('assets/works/', 'assets/wall/').replace('assets/crydope-', 'assets/wall/crydope-');
/* カード・一覧の事例は、事例のページ（/works/<id>/。tools/build_pages.py が書き出す）への本物のリンクにする。
 * ふつうに押すと、これまでどおりこのページの中で「事例の詳細」を開く。⌘/Ctrl/Shift を押しながら・中ボタンなら、事例のページを開く。 */
const pageOf = p => `/works/${encodeURIComponent(p.id)}/`;
const plainClick = e => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e.button && e.button !== 0));
const grid = $('#grid');
let cardObserver = null;
function coverOf(p) { const L = p.layers.find(l => l.type === 'image' || l.type === 'video'); return L || (p.gallery || [])[0]; }
function cardHTML({ p, i }) {
  const c = coverOf(p); const tone = c ? c.tone : 'dark';
  const media = c ? (c.type === 'video' || c.kind === 'video' ? `<img src="${esc(wallOf(c.poster))}" alt="" loading="lazy" decoding="async" style="object-position:${esc(c.focus || '50% 50%')}"><video muted loop playsinline preload="none" data-src="${esc(c.src)}" style="object-position:${esc(c.focus || '50% 50%')}"></video>` : `<img src="${esc(wallOf(c.src))}" alt="" loading="lazy" decoding="async" style="object-position:${esc(c.focus || '50% 50%')}">`) : '';
  const kinds = p.layers.map(l => l.tag).filter(Boolean); const kind = kinds[0] || '';
  return `<article class="card" data-i="${i}">
      <a class="card-hit" href="${pageOf(p)}" aria-haspopup="dialog" aria-label="${esc(p.label)}（${esc(p.title)}）の事例の詳細を開く" data-cursor="詳しく見る"></a>
      <div class="card-media tone-${esc(tone)}">${media}<span class="card-no">${p.no}</span>${kind ? `<span class="card-kind">${esc(kind)}</span>` : ''}</div>
      <div class="card-body"><p class="card-en">${esc(p.title)}</p><h3>${esc(p.label)}</h3><p class="card-meta">${esc(p.industry)}<i>/</i>${esc(p.year)}</p>
      ${PA[p.id].length ? `<p class="card-areas">${esc(areaText(PA[p.id]))}</p>` : ''}<span class="card-cta" aria-hidden="true">詳しく見る<i>↗</i></span></div></article>`;
}
/* スマホ：注目の2件を大きなカードで見せ、そのほかは小さなサムネと事例名の一覧で続ける。絞り込み中は一覧だけ（いまの条件は上の帯と見出しに出る） */
const narrow = matchMedia('(max-width: 720px)');
const PICK = 2;
function rowHTML({ p, i }) {
  const c = coverOf(p), thumb = c ? wallOf(c.poster || c.src) : '';
  const vid = c && (c.type === 'video' || c.kind === 'video') ? c.src : '';
  return `<li><a class="sp-row" href="${pageOf(p)}" data-i="${i}" aria-haspopup="dialog">
    <span class="sp-thumb">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async">` : ''}${vid ? `<video muted loop playsinline preload="none" data-src="${esc(vid)}"></video>` : ''}</span>
    <span class="sp-text"><small>${p.no}<span>${esc(p.title)}</span></small><b>${esc(p.label)}</b><em>${esc(p.industry)} / ${esc(p.year)}</em></span><i aria-hidden="true">↗</i></a></li>`;
}
function renderSpGrid(vis) {
  if (filtered()) { grid.innerHTML = `<ol class="sp-list">${vis.map(rowHTML).join('')}</ol>`; return; }
  const pick = vis.slice(0, PICK), rest = vis.slice(PICK);
  grid.innerHTML = `<p class="sp-k">注目の事例</p><div class="sp-pick">${pick.map(cardHTML).join('')}</div>` + (rest.length ? `<p class="sp-k">そのほかの事例</p><ol class="sp-list">${rest.map(rowHTML).join('')}</ol>` : '');
  $$('.card', grid).forEach(c => c.classList.add('in'));
}
function renderGrid() {
  const vis = visibleProjects(), sp = narrow.matches;
  grid.classList.toggle('sp', sp);
  if (cardObserver) cardObserver.disconnect();
  if (sp) { renderSpGrid(vis); watchCovers(); applyMore(); return; }
  grid.innerHTML = vis.map(cardHTML).join('');
  cardObserver = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.style.transitionDelay = `${(+x.target.dataset.k % 3) * 70}ms`; x.target.classList.add('in'); cardObserver.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.card', grid).forEach((c, k) => { c.dataset.k = k; if (reduced) c.classList.add('in'); else cardObserver.observe(c); });
  watchCovers(); applyMore();
}
/* 動画の事例は、カードのサムネも動かす（見えている間だけ。動きを止める設定・事例の詳細を開いている間・タブが裏にある間は止める） */
let coverIO = null;
function coverPlay(v) {
  const c = v.closest('.card, .sp-row');
  if (v._vis && !reduced && !document.hidden && !caseOpen) {
    if (!v.querySelector('source')) v.innerHTML = `<source src="${esc(v.dataset.src)}" type="video/webm"><source src="${esc(mp4(v.dataset.src))}" type="video/mp4">`;
    v.preload = 'auto'; const pr = v.play(); if (pr) pr.then(() => { if (c) c.classList.add('playing'); }).catch(() => { });
  } else v.pause();
}
function watchCovers() {
  if (coverIO) coverIO.disconnect();
  coverIO = new IntersectionObserver(es => es.forEach(x => { x.target._vis = x.isIntersecting; coverPlay(x.target); }), { threshold: .35 });
  $$('.card-media video, .sp-thumb video', grid).forEach(v => coverIO.observe(v));
}
function syncCovers() { $$('.card-media video, .sp-thumb video', grid).forEach(coverPlay); }
document.addEventListener('visibilitychange', syncCovers);
new MutationObserver(syncCovers).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

narrow.addEventListener('change', () => { if (state.view === 'grid') renderGrid(); });
grid.addEventListener('click', e => {
  if (!plainClick(e)) return; // ⌘/Ctrl/Shift を押しながら：事例のページ（/works/…/）を新しいタブで開く
  const row = e.target.closest('.sp-row'); if (row) { e.preventDefault(); openCase(+row.dataset.i, { from: $('.sp-thumb', row), focusTo: row, src: 'card' }); return; }
  const c = e.target.closest('.card'); if (c) { e.preventDefault(); openCase(+c.dataset.i, { from: $('.card-media', c), focusTo: $('.card-hit', c), src: 'card' }); }
});
grid.addEventListener('pointerout', e => { const c = e.target.closest('.card'); if (!c || c.contains(e.relatedTarget)) return; c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); });
grid.addEventListener('pointermove', e => {
  if (!fine.matches || reduced) return; const c = e.target.closest('.card'); if (!c) return;
  const r = c.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
  c.style.setProperty('--ry', (px * 7).toFixed(2) + 'deg'); c.style.setProperty('--rx', (-py * 6).toFixed(2) + 'deg');
});

/* ================= 一覧（LIST） ================= */
const lv = $('#lv'), pv = $('#hover-preview'), pimg = pv && $('img', pv);
function renderList() {
  lv.innerHTML = listItems().map(x => {
    if (x.kind === 'case') {
      const p = x.p, c = coverOf(p);
      const vid = c && (c.type === 'video' || c.kind === 'video') ? c.src : '';
      return `<li class="lv-row is-case"><a class="lv-hit" href="${pageOf(p)}" data-i="${x.i}" data-thumb="${esc(c ? (c.poster || c.src) : '')}" data-vid="${esc(vid)}" aria-haspopup="dialog">
        <span class="lv-no">${p.no}</span><span class="lv-title"><b><span class="lv-kind">事例</span>${esc(p.label)}</b><span class="lv-en">${esc(p.title)}</span><span class="lv-meta">${esc(p.industry)} / ${esc(p.year)}</span></span>
        <span class="lv-ind">${esc(p.industry)}</span><span class="lv-year">${esc(p.year)}</span><span class="lv-tags">${esc(areaText(x.areas))}</span><span class="lv-arrow" aria-hidden="true">↗</span></a></li>`;
    }
    const a = x.a, id = `lvd-${a.no}`;
    return `<li class="lv-row is-arch"><button type="button" class="lv-hit" aria-expanded="false" aria-controls="${id}">
      <span class="lv-no">${a.no}</span><span class="lv-title"><b><span class="lv-kind">${esc(a.kind)}</span>${esc(a.title)}</b><span class="lv-meta">${esc(a.industry)} / ${esc(a.year)}</span></span>
      <span class="lv-ind">${esc(a.industry)}</span><span class="lv-year">${esc(a.year)}</span><span class="lv-tags">${esc(areaText(x.areas))}</span><span class="lv-arrow" aria-hidden="true">+</span></button>
      <div class="lv-detail" id="${id}"><div><div class="lv-detail-in"><p>${esc(a.detail)}</p>${a.results && a.results.length ? `<ul class="lv-results"><li class="lr-label">RESULT</li>${a.results.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div></div></div></li>`;
  }).join('');
  applyMore();
}
lv.addEventListener('click', e => {
  const b = e.target.closest('.lv-hit'); if (!b) return;
  if (b.dataset.i != null) { if (!plainClick(e)) return; e.preventDefault(); openCase(+b.dataset.i, { from: b, src: 'list' }); return; }
  const row = b.closest('.lv-row'), on = !row.classList.contains('open'); row.classList.toggle('open', on); b.setAttribute('aria-expanded', String(on));
});
/* ================= 閉じた一覧（カード・一覧の「すべての事例を見る」） =================
 * PC のカードは2行ぶん、スマホは注目の2件＋3行（絞り込み中は6行）、一覧は10行を見せる。少し余るだけなら閉じない。 */
const MORE = { gridRows: 2, spRows: 3, spFiltered: 6, list: 10 };
function moreBar(after, id) {
  let bar = document.getElementById(id);
  if (!bar) {
    bar = document.createElement('div'); bar.className = 'more-bar'; bar.id = id;
    bar.innerHTML = `<button type="button" class="more-btn" aria-expanded="false" aria-controls="${after.id}"><span class="more-t"></span><i aria-hidden="true">↓</i></button>`;
    after.after(bar);
    bar.firstElementChild.addEventListener('click', e => toggleMore(bar, e.detail === 0));
  }
  return bar;
}
function moreSet() {
  if (state.view === 'list') return { items: $$('#lv > .lv-row'), limit: MORE.list, slack: 2, bar: moreBar(lv, 'lv-more'), label: 'すべての事例・取り組みを見る' };
  if (narrow.matches) return { items: $$('#grid .sp-list > li'), limit: filtered() ? MORE.spFiltered : MORE.spRows, slack: 2, bar: moreBar(grid, 'grid-more'), label: 'すべての事例を見る' };
  const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
  return { items: $$('#grid > .card'), limit: cols * MORE.gridRows, slack: 1, bar: moreBar(grid, 'grid-more'), label: 'すべての事例を見る' };
}
function applyMore() {
  if (state.view === 'layers') return null;
  const m = moreSet(), can = m.items.length > m.limit + m.slack;
  m.items.forEach((el, k) => { el.hidden = can && !more && k >= m.limit; });
  m.bar.hidden = !can; m.bar.classList.toggle('open', more);
  const btn = m.bar.firstElementChild;
  btn.setAttribute('aria-expanded', String(more));
  $('.more-t', btn).textContent = more ? '閉じる' : m.label;
  const other = document.getElementById(state.view === 'list' ? 'grid-more' : 'lv-more'); if (other) other.hidden = true;
  return { ...m, can };
}
function toggleMore(bar, byKey) {
  const btn = bar.firstElementChild, before = btn.getBoundingClientRect().top;
  more = !more;
  const m = applyMore();
  if (!more) {
    // 閉じたら、押したボタンが画面の同じ位置に来るように戻す（下の方で閉じても、見ていた場所を見失わない）
    window.scrollBy({ top: btn.getBoundingClientRect().top - before, behavior: 'instant' });
  } else if (byKey && m) {
    // キーボードで開いたときは、新しく出た最初の項目へ移る
    const first = m.items[m.limit], t = first && ($('.card-hit, .sp-row, .lv-hit', first) || first);
    if (t) t.focus();
  }
  announce(more ? 'すべてを表示しました。' : '一覧を閉じました。');
  if (more) track('open_more', { view_mode: state.view });
}
// 画面の幅が変わってカードの列の数が変わったら、見せる数も合わせる
let moreW = 0;
new ResizeObserver(() => { const w = grid.clientWidth; if (w && w !== moreW) { moreW = w; if (state.view === 'grid') applyMore(); } }).observe(grid);

if (pv) {
  let px = 0, py = 0, vx = 0, rr = 0, prevX = 0;
  // 動画の事例は、浮かぶサムネも動画にする
  const pvid = document.createElement('video'); pvid.muted = true; pvid.loop = true; pvid.playsInline = true; pvid.setAttribute('muted', ''); pvid.setAttribute('playsinline', ''); pvid.hidden = true; pv.appendChild(pvid);
  const pvOff = () => { pv.classList.remove('on'); pvid.pause(); };
  lv.addEventListener('pointerover', e => {
    const b = e.target.closest('.lv-hit[data-thumb]'); if (!b || !fine.matches || !b.dataset.thumb) { pvOff(); return; }
    pimg.src = b.dataset.thumb; const v = b.dataset.vid;
    if (v && !reduced) { if (pvid.dataset.src !== v) { pvid.dataset.src = v; pvid.poster = b.dataset.thumb; pvid.innerHTML = `<source src="${esc(v)}" type="video/webm"><source src="${esc(mp4(v))}" type="video/mp4">`; pvid.load(); } pvid.hidden = false; const pr = pvid.play(); if (pr) pr.catch(() => { }); }
    else { pvid.hidden = true; pvid.pause(); }
    pv.classList.add('on');
  });
  lv.addEventListener('pointerleave', pvOff);
  lv.addEventListener('pointermove', e => {
    if (!fine.matches) return; vx = e.clientX - prevX; prevX = e.clientX; rr = reduced ? -3 : clamp(vx * .6, -14, 14) - 3;
    px = e.clientX + 34; py = e.clientY - 60; pv.style.setProperty('--x', px + 'px'); pv.style.setProperty('--y', py + 'px'); pv.style.setProperty('--r', rr.toFixed(1) + 'deg');
    if (!e.target.closest('.lv-hit[data-thumb]')) pvOff();
  });
}

/* ================= 事例の詳細（CASE） ================= */
const dlg = $('#case'), body = $('#case-body'), scroller = $('#case-scroll'), cut = $('#cut'), fly = $('#fly');
let caseOpen = false, caseIndex = 0, caseOrigin = null, caseObserver = null, caseList = [], caseScrollY = 0;
function mediaHTML(a, opts = {}) {
  const pos = esc(a.focus || '50% 50%');
  if (a.kind === 'video' || a.type === 'video') return `<video muted loop playsinline ${opts.autoplay && !reduced ? 'autoplay' : ''} preload="${opts.eager ? 'auto' : 'none'}" poster="${esc(a.poster || '')}" aria-label="${esc(a.alt || a.title)}" style="object-position:${pos}"><source src="${esc(a.src)}" type="video/webm"><source src="${esc(mp4(a.src))}" type="video/mp4"></video>`;
  return `<img src="${esc(a.src)}" alt="${esc(a.alt || a.title)}" loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async" style="object-position:${pos}">`;
}
function splitTitle(t) { let k = 0; return t.split(' ').map(w => `<span class="w">${[...w].map(ch => `<span class="ch" style="--i:${k++}">${esc(ch)}</span>`).join('')}</span>`).join('<span class="sp"> </span>'); }
function heroOf(p, layer) {
  const L = layer != null ? p.layers[layer] : null;
  if (L && (L.type === 'image' || L.type === 'video')) { const g = (p.gallery || []).find(a => a.src === L.src); return g || { ...L, kind: L.type }; }
  const g = p.gallery || []; return g.find(a => a.kind === 'video') || g[0] || null;
}
let caseFrom = 'other';
function renderCase(index, layer) {
  const p = projects[index], g = p.gallery || [], hero = heroOf(p, layer);
  track('view_case', { case_id: p.id, case_name: p.label, case_industry: p.industry, ui_from: caseFrom });
  const rest = g.filter(a => !hero || a.src !== hero.src);
  const portraitCount = rest.filter(isPortrait).length, manyPortrait = portraitCount >= 3;
  const figures = rest.map((a, k) => {
    const portrait = isPortrait(a), wide = manyPortrait ? !portrait && a.ratio < .9 : (!portrait && k % 5 === 0);
    return `<figure class="cf-fig ${a.kind === 'video' ? 'is-video' : ''} ${wide ? 'wide' : ''} ${portrait ? 'portrait' : ''} tone-${esc(a.tone)}"><button type="button" class="cf-frame" data-k="${k}" aria-label="${esc(a.title)}を大きく見る" data-cursor="${a.kind === 'video' ? '再生' : '拡大'}" data-cursor-mark="${a.kind === 'video' ? '▶' : '＋'}">${mediaHTML(a)}</button><figcaption><b>${pad(k + 2)} — ${esc(a.title)}</b><span>${esc(a.caption)}</span></figcaption></figure>`;
  }).join('');
  const vis = caseList, at = vis.indexOf(index), next = projects[vis[(at + 1) % vis.length]];
  const heroCls = hero ? (isPortrait(hero) ? 'portrait' : (hero.tone === 'light' ? 'fit' : '')) : 'cf-hero-type';
  const tagBtns = p.tags.map(t => `<button type="button" class="tag-btn" data-tag="${t}">${esc(TAG[t].label)}</button>`).join('');
  body.innerHTML = `
  <header class="cf-hero ${heroCls === 'fit' ? 'stack' : 'overlay'}">
    <div class="cf-hero-media ${heroCls}" ${hero && isPortrait(hero) ? `style="--bg:url('${esc(hero.poster || hero.src)}')"` : ''}>${hero ? mediaHTML(hero, { eager: true, autoplay: true }) : `<b aria-hidden="true">${esc(p.title)}</b>`}</div>
    <div class="cf-hero-text"><p class="cf-kicker">${p.no} — ${esc(p.kicker)} / ${esc(p.industry)} / ${esc(p.year)}</p><h2 id="case-title" aria-label="${esc(p.title)}">${splitTitle(p.title)}</h2><p class="cf-sub">${esc(p.subtitle)}</p></div>
    ${hero ? `<p class="cf-hero-cap">01 — ${esc(hero.title)}：${esc(hero.caption)}</p>` : ''}
  </header>
  <div class="cf-tagbar"><span>タグで探す</span>${tagBtns}</div>
  <section class="cf-intro">
    <p class="cf-summary">${esc(p.summary)}</p>
    <dl class="cf-meta"><div><dt>業種</dt><dd>${esc(p.industry)}</dd></div><div><dt>時期</dt><dd>${esc(p.year)}</dd></div></dl>
  </section>
  <section class="cf-sec"><h3 class="cf-h"><b>WHAT WE DO</b>この領域でできること</h3><ol class="cf-can">${p.can.map((x, k) => `<li><i>${pad(k + 1)}</i><span>${esc(x)}</span></li>`).join('')}</ol></section>
  ${p.results && p.results.length ? `<section class="cf-sec"><h3 class="cf-h"><b>RESULTS</b>結果</h3><ul class="cf-results">${p.results.map(r => `<li><span>${esc(r)}</span></li>`).join('')}</ul></section>` : ''}
  <section class="cf-sec"><h3 class="cf-h"><b>PROCESS</b>担当したこと</h3><ol class="cf-process">${p.process.map((x, k) => `<li><span>${pad(k + 1)}</span><p>${esc(x)}</p></li>`).join('')}</ol></section>
  ${figures ? `<section class="cf-sec"><h3 class="cf-h"><b>MATERIALS</b>実物の画面と資料</h3><div class="cf-gallery ${manyPortrait ? 'has-portrait' : ''}">${figures}</div></section>` : ''}
  ${teamSection(p)}
  <section class="cf-foot">
    <p class="cf-note">${esc(p.note)}</p>
    ${p.own ? '' : `<p class="cf-disclaimer">画像はイメージです。実際のお客様の名前やデータなどは、すべて削除・加工を施しています。</p>`}
    <div class="cf-links">${(p.links || []).map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}<a href="#contact" data-case-contact>この領域について相談する ↗</a></div>
    ${vis.length > 1 ? `<button type="button" class="cf-next" data-case-next data-cursor="次の事例" data-cursor-mark="→"><small>次の事例 ${next.no}</small><b>${esc(next.title)}</b><span>${esc(next.subtitle)}</span><i>→</i></button>` : ''}
    <button type="button" class="cf-close-end" data-case-close><span>CLOSE</span><b>事例の詳細を閉じる</b><i aria-hidden="true">×</i></button>
  </section>`;
  $('#case-label').textContent = `CASE ${p.no} — ${p.label}`;
  $('#case-prev').disabled = $('#case-next').disabled = vis.length < 2;
  scroller.scrollTop = 0; syncFab();
  if (caseObserver) caseObserver.disconnect();
  caseObserver = new IntersectionObserver(es => es.forEach(x => { const v = x.target; if (x.isIntersecting && !reduced) { v.preload = 'auto'; const pr = v.play(); if (pr) pr.catch(() => { }); } else v.pause(); }), { root: scroller, threshold: .2 });
  $$('video', body).forEach(v => caseObserver.observe(v));
  body._rest = rest; body._p = p;
  if (location.hash !== `#case-${p.id}` || !(history.state && history.state.slashCase)) history.replaceState(casePushed ? { slashCase: p.id } : null, '', `#case-${p.id}`);
  casePick = null; const net = $('.cf-net', body); if (net && window.SlashTeam) { window.SlashTeam.paint(net, new Set(p.team), null); if (window.SlashTeam.animate) window.SlashTeam.animate(net); if (window.SlashTeam.sky) window.SlashTeam.sky($('.cf-teambox', body), 4200); }
  announce(`${p.title}の事例の詳細を開きました。`);
}
// 事例の詳細の中の体制図：その事例の役割が光った状態で出す。役割を選ぶと、説明とほかの事例をその場で表示する
let casePick = null;
function teamSection(p) {
  const T = window.SlashTeam; if (!T) return '';
  return `<section class="cf-sec cf-team-sec"><h3 class="cf-h"><b>TEAM</b>この案件の体制</h3>
  <div class="cf-teambox">
    <div class="team-net cf-net">${T.netHTML('この案件')}</div>
    <div class="cft-side">
      <p class="cft-count"><b>${pad(p.team.length)}</b><span>/ ${pad((D.roles || []).length)} ROLES</span></p>
      <p class="cft-text">約20名の専門家の中から、この案件では${p.team.length}つの役割で組みました。役割を選ぶと、担当する内容と、その役割が入ったほかの事例を表示します。</p>
      <ul class="cft-list">${p.team.map(r => ROLE[r] ? `<li><button type="button" data-team-role="${r}" aria-pressed="false"><b>${esc(ROLE[r].en)}</b><span>${esc(ROLE[r].label)}</span></button></li>` : '').join('')}</ul>
      <div class="cft-detail" aria-live="polite"></div>
      ${T.legend()}
    </div>
  </div></section>`;
}
function pickTeamRole(id) {
  const T = window.SlashTeam, p = projects[caseIndex], net = $('.cf-net', body); if (!T || !net) return;
  casePick = id; T.paint(net, new Set(p.team), id);
  $$('[data-team-role]', body).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.teamRole === id)));
  const box = $('.cft-detail', body); if (!box) return;
  if (!id) { box.innerHTML = ''; return; }
  const r = T.role(id), inCase = p.team.includes(id), all = T.usedBy(id), others = all.filter(x => x.id !== p.id);
  box.innerHTML = `<p class="cftd-k">${esc(r.en)} — ${inCase ? 'この案件の体制' : 'この案件には入っていない役割'}</p><h4>${esc(r.label)}</h4><p>${esc(r.note)}。</p>` +
    (all.length === projects.length ? '<p class="cftd-k">すべての事例に入る役割です</p>' :
      others.length ? `<p class="cftd-k">この役割が入ったほかの事例</p><ul>${others.map(x => `<li><button type="button" data-case-open="${x.id}">${esc(x.title)} <span>${esc(x.label)}</span> ↗</button></li>`).join('')}</ul>` : '');
}
function rectOfHero(hero) {
  const bar = innerWidth <= 720 ? 52 : 58, stack = hero && hero.tone === 'light' && !isPortrait(hero);
  return { left: 0, top: bar, width: innerWidth, height: stack ? Math.min(innerHeight * .64, 700) : Math.min(innerHeight * (innerWidth <= 720 ? .58 : .72), 760), stack };
}
function animateCut(dir) {
  // 斜めの帯で画面を覆う（dir=in）／開ける（dir=out）
  const a = $('.cut-a', cut), b = $('.cut-b', cut);
  const full = 'polygon(-20% -10%,120% -10%,120% 110%,-20% 110%)';
  const ins = [{ clipPath: 'polygon(-30% 110%,-30% 110%,-30% 110%,-30% 110%)' }, { clipPath: 'polygon(-30% 110%,60% -10%,130% -10%,40% 110%)', offset: .45 }, { clipPath: 'polygon(-30% 110%,-30% -10%,130% -10%,130% 110%)' }];
  if (dir === 'in') { cut.classList.add('on'); b.animate(ins, { duration: 360, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' }); return a.animate(ins, { duration: 400, delay: 40, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' }).finished; }
  const outs = [{ clipPath: full }, { clipPath: 'polygon(130% -10%,130% -10%,130% 110%,130% 110%)' }];
  b.animate(outs, { duration: 340, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
  return a.animate(outs, { duration: 380, delay: 40, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' }).finished.then(() => { cut.classList.remove('on'); a.getAnimations().forEach(x => x.cancel()); b.getAnimations().forEach(x => x.cancel()); });
}
function flyFrom(fromEl, hero) {
  if (!fromEl || !hero || !fly) return Promise.resolve();
  const r = fromEl.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) return Promise.resolve();
  const t = rectOfHero(hero);
  const src = hero.kind === 'video' || hero.type === 'video' ? (hero.poster || '') : hero.src;
  const contain = isPortrait(hero) || hero.tone === 'light';
  fly.style.background = hero.tone === 'light' && !isPortrait(hero) ? '#f2f1ea' : '#0b0b0a';
  fly.style.padding = t.stack ? 'clamp(10px,2vw,28px)' : '0';
  fly.innerHTML = `<img src="${esc(src)}" alt="" style="object-fit:${contain ? 'contain' : 'cover'};object-position:${esc(hero.focus || '50% 50%')}">`;
  Object.assign(fly.style, { left: t.left + 'px', top: t.top + 'px', width: t.width + 'px', height: t.height + 'px' });
  fly.classList.add('on');
  const top = clamp(r.top - t.top, 0, t.height), left = clamp(r.left - t.left, 0, t.width), right = clamp(t.left + t.width - r.right, 0, t.width), bottom = clamp(t.top + t.height - r.bottom, 0, t.height);
  return fly.animate([{ clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px)`, opacity: .4 }, { clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px)`, opacity: 1, offset: .15 }, { clipPath: 'inset(0px 0px 0px 0px)', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' }).finished;
}
// 開くときに履歴を1つ積み、ブラウザの「戻る」（スマホの戻る操作）で事例の詳細を閉じられるようにする
let casePushed = false, zoomPushed = false, afterClose = null, openToken = 0, pendingOpen = null;
/* こちらから「戻る」を呼んだ回数（popstate が届くまで）。連打や、ブラウザが自分で閉じた場合に「戻る」が重なって
 * サイトの外（前のページ）まで戻ってしまわないよう、数えて扱う */
let internalBacks = 0;
const goBack = () => { internalBacks++; history.back(); };
const runPendingOpen = () => { if (pendingOpen) { const [i, o] = pendingOpen; pendingOpen = null; openCase(i, o); } };
function openCase(index, opts = {}) {
  if (internalBacks > 0) { pendingOpen = [index, opts]; return; } // 「戻る」で閉じている途中なら、閉じ終わってから開く
  caseFrom = opts.src || 'other';
  if (caseOpen) { swapCase(index, opts.layer); return; }
  caseList = visibleProjects().map(x => x.i); if (!caseList.includes(index)) caseList = projects.map((_, i) => i);
  // 閉じたあとに焦点を戻す先：押したボタン（カードは画像ではなく、カードのボタン）
  const focusable = el => el && el.matches && el.matches('a[href],button,input,select,textarea,[tabindex]');
  caseIndex = index; caseOrigin = opts.focusTo || (focusable(opts.from) ? opts.from : document.activeElement); caseOpen = true; caseScrollY = scrollY;
  const token = ++openToken;
  if (!opts.noPush) { try { history.scrollRestoration = 'manual'; } catch (e) { } history.pushState({ slashCase: projects[index].id }, '', `#case-${projects[index].id}`); casePushed = true; }
  document.body.classList.add('reading'); syncPlayback();
  const hero = heroOf(projects[index], opts.layer);
  const show = () => {
    if (token !== openToken || !caseOpen) return; // 開く途中で閉じられた
    renderCase(index, opts.layer);
    if (!dlg.open) dlg.showModal();
    scroller.scrollTop = 0;
    document.documentElement.classList.add('case-open');
    dlg.classList.remove('leave');
  };
  // ページを切り替えず、いまのページの上に事例の詳細を重ねる（PCは右から、スマホは下からのシート。後ろのページは暗く透けて見え、押すと閉じる）
  show(); if (!reduced) { dlg.classList.remove('enter'); void dlg.offsetWidth; dlg.classList.add('enter'); }
}
function swapCase(index, layer, src) {
  caseIndex = index; if (src) caseFrom = src;
  body.classList.remove('case-body-swap'); void body.offsetWidth; renderCase(index, layer); if (!reduced) body.classList.add('case-body-swap');
  scroller.scrollTop = 0;
}
function stepCase(d) { const at = caseList.indexOf(caseIndex); swapCase(caseList[(at + d + caseList.length) % caseList.length], undefined, d < 0 ? 'case_prev' : 'case_next'); }
// 閉じる：履歴を積んでいれば「戻る」で閉じる（popstate で実際に閉じる）
function closeCase(then) {
  if (!caseOpen) return;
  if (internalBacks > 0) { if (then) afterClose = then; return; } // すでに閉じている途中（連打）
  if (casePushed && history.state && history.state.slashCase) { afterClose = then || null; goBack(); return; }
  closeNow(then);
}
function closeNow(then, keep = !then) {
  casePushed = false;
  if (!dlg.open) { caseOpen = false; document.body.classList.remove('reading'); cut.classList.remove('on'); fly.classList.remove('on'); syncPlayback(); if (then) then(); return; }
  const done = () => { dlg.classList.remove('leave'); dlg.close(); afterClosed(keep); if (then) then(); };
  if (reduced) { done(); return; }
  dlg.classList.remove('enter'); dlg.classList.add('leave');
  let finished = false; const fin = () => { if (finished) return; finished = true; done(); };
  const sheet = $('#cf-sheet') || dlg; sheet.addEventListener('animationend', fin, { once: true }); setTimeout(fin, 520);
}
addEventListener('popstate', e => {
  const st = e.state || {};
  const internal = internalBacks > 0; if (internal) internalBacks--;
  if (zoomPushed && !st.zoom) { zoomPushed = false; closeZoomNow(); }
  if (!st.slashCase) {
    // 事例の外の項目に戻った：開いていれば閉じる（こちらの「戻る」でも、ブラウザの戻るでも）
    const t = afterClose; afterClose = null;
    if (caseOpen) closeNow(() => { if (t) t(); runPendingOpen(); }, !t);
    else if (internalBacks === 0) { if (t) t(); runPendingOpen(); }
    return;
  }
  // 事例の項目に来た
  if (!caseOpen) {
    if (internal) { goBack(); return; } // 閉じたあとに残った事例の項目（ブラウザが自分で閉じた場合など）は、続けて戻って消す
    const i = projects.findIndex(p => p.id === st.slashCase); if (i >= 0) { casePushed = true; openCase(i, { noPush: true, src: 'history' }); } // 「進む」で来た
  }
});
const scrim = $('#cf-scrim'); if (scrim) scrim.addEventListener('click', () => closeCase());
dlg.addEventListener('cancel', e => { e.preventDefault(); if (!zoom.hidden) { closeZoom(); return; } closeCase(); });
// 閉じたあとの片付け。close イベントは少し遅れて届くので、自分で閉じたときはその場で済ませる
function afterClosed(keepScroll = true) {
  if (!caseOpen) return;
  if (caseObserver) caseObserver.disconnect(); $$('video', body).forEach(v => { v.pause(); v.removeAttribute('src'); v.load && v.load(); });
  body.innerHTML = ''; document.documentElement.classList.remove('case-open'); caseOpen = false; closeZoomNow(); zoomPushed = false; syncFab();
  document.body.classList.remove('reading'); syncPlayback();
  // ブラウザが自分で閉じた場合（戻る操作など）も、積んだ履歴を残さない
  if (casePushed) { casePushed = false; if (internalBacks === 0 && history.state && history.state.slashCase) goBack(); } // 「戻る」がすでに進んでいれば重ねない
  else if (location.hash.startsWith('#case-')) history.replaceState(null, '', '#works');
  // 焦点を、開いたときに押したものへ戻す。「戻る」の直後はブラウザが URL の #… への移動で焦点を外すことがあるので、外れていたらもう一度戻す
  // 見ていた位置も戻す（初めに開いた URL へ「戻る」と、ブラウザが #works の頭へ送ることがあるため）。閉じたあとに別の場所へ移る操作（相談するなど）のときは戻さない
  const origin = caseOrigin, keepY = caseScrollY;
  const refocus = () => {
    if (caseOpen) return;
    if (keepScroll && Math.abs(scrollY - keepY) > 2) window.scrollTo({ top: keepY, behavior: 'instant' });
    const a = document.activeElement; if (origin && origin.isConnected && (!a || a === document.body || a.matches('section'))) origin.focus({ preventScroll: true });
  };
  if (origin && origin.isConnected) origin.focus({ preventScroll: true });
  addEventListener('hashchange', () => setTimeout(refocus, 0), { once: true }); setTimeout(refocus, 150); requestAnimationFrame(refocus);
  setTimeout(() => { if (!caseOpen) { try { history.scrollRestoration = 'auto'; } catch (e) { } } }, 600);
}
dlg.addEventListener('close', () => { if (!dlg.open) afterClosed(); });
$('#case-close').addEventListener('click', () => closeCase());
$('#case-prev').addEventListener('click', () => stepCase(-1));
$('#case-next').addEventListener('click', () => stepCase(1));
dlg.addEventListener('keydown', e => { if (e.target.closest('input,textarea')) return; if (e.key === 'ArrowRight' && zoom.hidden) stepCase(1); if (e.key === 'ArrowLeft' && zoom.hidden) stepCase(-1); });
body.addEventListener('click', e => {
  const t = e.target.closest('[data-tag]'); if (t) { const id = t.dataset.tag; closeCase(() => filterByTag(id, 'case')); return; }
  const tr = e.target.closest('[data-team-role], .cf-net .role'); if (tr) { const id = tr.dataset.teamRole || tr.dataset.role; pickTeamRole(id === casePick ? null : id); return; }
  const oc = e.target.closest('[data-case-open]'); if (oc) { const i = projects.findIndex(p => p.id === oc.dataset.caseOpen); if (i >= 0) swapCase(i, undefined, 'case_related'); return; }
  if (e.target.closest('[data-case-next]')) { stepCase(1); return; }
  if (e.target.closest('[data-case-close]')) { closeCase(); return; }
  if (e.target.closest('[data-case-contact]')) { e.preventDefault(); track('nav_click', { section: 'contact', ui_from: 'case' }); closeCase(() => { const c = $('#contact'); if (c) c.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }); }); return; }
  const f = e.target.closest('.cf-frame'); if (f) { openZoom(body._rest[+f.dataset.k]); track('zoom_media', { case_id: projects[caseIndex].id, case_name: projects[caseIndex].label }); }
});
// 下へ読み進めたら、右下に「閉じる」を出し続ける（末尾の「閉じる」が見えている間と、拡大表示の間は隠す）
const fab = $('#cf-fab'); let fabRaf = 0;
function syncFab() {
  fabRaf = 0; if (!fab) return;
  const end = $('.cf-close-end', body), endVis = !!end && end.getBoundingClientRect().top < innerHeight - 30;
  const show = caseOpen && scroller.scrollTop > 240 && !endVis && (!zoom || zoom.hidden);
  if (show === fab.classList.contains('on')) return;
  fab.classList.toggle('on', show); fab.setAttribute('aria-hidden', String(!show)); fab.tabIndex = show ? 0 : -1;
}
scroller.addEventListener('scroll', () => { if (!fabRaf) fabRaf = requestAnimationFrame(syncFab); }, { passive: true });
if (fab) fab.addEventListener('click', () => closeCase());
// 拡大表示（これも「戻る」で閉じる）
const zoom = $('#cf-zoom'), zoomStage = $('#cf-zoom-stage');
function openZoom(a) {
  if (!a) return;
  zoomStage.classList.remove('full');
  zoomStage.innerHTML = a.kind === 'video' ? `<video muted loop playsinline autoplay controls poster="${esc(a.poster || '')}"><source src="${esc(a.src)}" type="video/webm"><source src="${esc(mp4(a.src))}" type="video/mp4"></video>` : `<img src="${esc(a.src)}" alt="${esc(a.alt || a.title)}">`;
  $('#cf-zoom-cap').textContent = `${a.title}：${a.caption}`;
  zoom.hidden = false; syncFab(); $('#cf-zoom-close').focus();
  if (!zoomPushed) { history.pushState({ slashCase: projects[caseIndex].id, zoom: true }, '', location.hash); zoomPushed = true; }
}
function closeZoom() { if (!zoom || zoom.hidden || internalBacks > 0) return; if (zoomPushed && history.state && history.state.zoom) { goBack(); return; } closeZoomNow(); }
function closeZoomNow() { if (!zoom || zoom.hidden) return; $$('video', zoomStage).forEach(v => v.pause()); zoomStage.innerHTML = ''; zoom.hidden = true; syncFab(); }
$('#cf-zoom-close').addEventListener('click', closeZoom);
zoomStage.addEventListener('click', e => { if (e.target.tagName === 'IMG') { if (e.target.naturalWidth > zoomStage.clientWidth * 1.2) zoomStage.classList.toggle('full'); else closeZoom(); } else if (e.target === zoomStage) closeZoom(); });

/* ================= 横に並ぶ一覧は、マウスのホイールでも横に送れるようにする ================= */
function wheelToX(el) {
  if (!el) return;
  el.addEventListener('wheel', e => {
    if (!fine.matches || Math.abs(e.deltaX) > Math.abs(e.deltaY) || el.scrollWidth <= el.clientWidth + 2) return;
    const max = el.scrollWidth - el.clientWidth, next = clamp(el.scrollLeft + e.deltaY, 0, max);
    if (next === el.scrollLeft) return; e.preventDefault(); el.scrollLeft = next;
  }, { passive: false });
}
wheelToX(plist); wheelToX($('#team-cases'));

/* ================= 動きの設定・外部から呼ぶ ================= */
document.addEventListener('slash:motion', e => { reduced = !!e.detail.reduced; if (reduced) { mx = my = tx = ty = 0; } drawScene(); syncPlayback(); });
window.SlashWorks = {
  open(id, from, src) { const i = projects.findIndex(p => p.id === id); if (i >= 0) openCase(i, { from, src: src || 'other' }); },
  select(id) { const i = projects.findIndex(p => p.id === id); if (i < 0) return; state.area = state.field = state.tag = null; if (state.view !== 'layers') { state.view = 'layers'; } renderFilters(); renderView(); selectProject(i, true); const w = $('#works'); if (w) w.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }); },
  filter: filterByTag,
  // 業務領域の節から：その領域で絞って、実績の操作の帯へ移る
  area(id) { if (!AREA[id]) return; setFilters({ area: id, field: null, tag: null }, { noScroll: true, fallback: true }); track('filter_works', { filter_type: 'area', filter_value: AREA[id].name, ui_from: 'services' }); jumpToBar(); },
  projects
};

/* ================= 初期表示 ================= */
const startHash = location.hash;
const fromHash = location.hash.startsWith('#w-') ? projects.findIndex(p => p.id === location.hash.slice(3)) : -1;
state.current = fromHash >= 0 ? fromHash : 0;
syncViewButtons(); renderFilters();
if (state.view === 'layers') { renderPlist(); mount(state.current); startStage(); } else renderView();
if (location.hash.startsWith('#case-')) { const i = projects.findIndex(p => p.id === location.hash.slice(6)); if (i >= 0) setTimeout(() => openCase(i, { noPush: true, src: 'link' }), 300); }
// 以前の「1件ずつ」の URL（#w-…）で来たときは、その事例の詳細を開く（初めの表示はカード）
else if (fromHash >= 0 && state.view !== 'layers') setTimeout(() => openCase(fromHash, { noPush: true, src: 'link' }), 300);
// 「1件ずつ」は URL を #w-… に書き換えるため、ブラウザのアンカー移動が効かない。#works・#w-… で来たときは自分で実績へ送る
if (startHash === '#works' || startHash.startsWith('#w-')) {
  let userMoved = false; ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => addEventListener(t, () => { userMoved = true; }, { once: true, passive: true }));
  const go = () => { if (userMoved) return; const w = $('#works'); if (!w) return; const top = w.getBoundingClientRect().top; if (top < 0 || top > 120) w.scrollIntoView({ behavior: 'instant', block: 'start' }); };
  requestAnimationFrame(go);
  if (document.readyState === 'complete') setTimeout(go, 60); else addEventListener('load', go, { once: true });
}
});
