/* s/ash — 計測（Google アナリティクス 4、測定ID G-1QMPV3ZY1P）。
 * ・本番（www.slashslash.jp）だけで読み込む。プレビュー・ローカルでは読み込まない（?ga=force で強制。強制時は確認用の印つき）。
 * ・この端末を計測から外す：?ga=off（戻す：?ga=on）。端末のブラウザに保存する。
 * ・確認用：?ga_debug=1（GA の DebugView に出る。開発者トラフィックとしてレポートからは除く）。外した端末でも、確認用なら読み込む。
 * ・お名前・メールアドレス・相談内容など、入力された内容は送らない。
 * 事例の詳細・絞り込み・節の到達などは site.js / works-ui.js / page.js から window.slashTrack(イベント名, パラメータ) で送る。
 *
 * 「どこを見ていたか」の計測（2026-10-21）
 * ・slashPage(パス, 題)：トップの上に重ねて開く「事例の詳細」を、その事例のページ（/works/<id>/）の閲覧として数える（page_view）。
 *   閉じたら slashPage() でトップに戻す（数えない）。開いている間に送るイベントは、その事例のページのものになる。
 * ・slashPlace(イベント名, パラメータ)：いま見ている場所（トップの節、または事例）を切り替える。前の場所を見ていた秒数を
 *   section_time / case_time の engaged_sec（秒）で送る。タブが裏にある間と、90秒以上なにも操作がない間は数えない。
 * ・slashDwell(要素の一覧, 届いたとき, ミリ秒, スクロールする親)：要素が画面に十分見えたまま一定時間とどまったら、1回だけ知らせる
 *   （事例の中の図・動画 view_material、実績やAIのカード view_card に使う）。 */
(function () {
  'use strict';
  var ID = 'G-1QMPV3ZY1P';
  var q = location.search;
  var store = function (k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { }
    return null;
  };
  if (/[?&]ga=off(&|$)/.test(q)) store('slash-ga', 'off');
  if (/[?&]ga=on(&|$)/.test(q)) store('slash-ga', null);
  var forced = /[?&]ga=force(&|$)/.test(q);
  var debug = forced || /[?&]ga_debug=1(&|$)/.test(q);
  var prod = /^(www\.)?slashslash\.jp$/.test(location.hostname);
  var noop = function () { return null; };
  window.slashTrack = noop; window.slashPage = noop; window.slashPlace = noop; window.slashDwell = noop;
  if (!(prod || forced) || (store('slash-ga') === 'off' && !debug)) return;
  window.dataLayer = window.dataLayer || [];
  var gtag = function () { window.dataLayer.push(arguments); };
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID, debug ? { debug_mode: true } : {});
  var s = document.createElement('script');
  s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
  // 値は文字列にし、長すぎるものは切る（GA の上限は100文字）
  var send = window.slashTrack = function (name, params) {
    try {
      var p = {};
      Object.keys(params || {}).forEach(function (k) { var v = params[k]; if (v == null || v === '') return; p[k] = typeof v === 'number' ? v : String(v).slice(0, 100); });
      gtag('event', name, p);
    } catch (e) { }
  };

  /* ---- 事例の詳細を、その事例のページとして数える ---- */
  var base = { loc: location.href.split('#')[0], title: document.title };
  window.slashPage = function (path, title) {
    try {
      if (!path) { gtag('set', { page_location: base.loc, page_title: base.title }); return; }
      var loc = location.origin + path;
      gtag('set', { page_location: loc, page_title: title });
      gtag('event', 'page_view', { page_location: loc, page_title: title, page_referrer: base.loc });
    } catch (e) { }
  };

  /* ---- いま見ている場所と、見ていた秒数 ---- */
  var cur = null, acc = 0, lastAct = Date.now(), IDLE = 90000;
  var wake = function () { lastAct = Date.now(); };
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (t) { addEventListener(t, wake, { passive: true, capture: true }); });
  setInterval(function () { if (cur && document.visibilityState === 'visible' && Date.now() - lastAct < IDLE) acc += 1; }, 1000);
  var flush = function () {
    if (cur && acc >= 2) send(cur.ev, Object.assign({ engaged_sec: acc }, cur.p)); // 通り過ぎただけ（2秒未満）は送らない
    acc = 0;
  };
  window.slashPlace = function (ev, params) {
    var key = ev ? ev + '|' + JSON.stringify(params || {}) : '';
    if (cur && cur.key === key) return;
    flush(); wake();
    cur = ev ? { ev: ev, p: params || {}, key: key } : null;
  };
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); else wake(); });
  addEventListener('pagehide', flush);

  /* ---- 十分に見えたまま、しばらくとどまった要素 ---- */
  // done(el) が false を返したとき（事例の詳細の後ろに隠れているなど）は数えず、見えている間は少しあとで確かめ直す
  window.slashDwell = function (els, done, ms, scrollRoot) {
    if (!('IntersectionObserver' in window) || !els || !els.length) return null;
    var timers = new Map(), fired = new Set(), wait = ms || 1000;
    var arm = function (el) {
      timers.set(el, setTimeout(function () {
        timers.delete(el); if (fired.has(el)) return;
        var r; try { r = done(el); } catch (e) { }
        if (r === false) { arm(el); return; }
        fired.add(el); io.unobserve(el);
      }, wait));
    };
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) {
        var el = x.target, vh = x.rootBounds ? x.rootBounds.height : innerHeight;
        var enough = x.isIntersecting && (x.intersectionRatio >= .5 || x.intersectionRect.height >= vh * .4);
        if (enough && !fired.has(el) && !timers.has(el)) arm(el);
        else if (!enough && timers.has(el)) { clearTimeout(timers.get(el)); timers.delete(el); }
      });
    }, { root: scrollRoot || null, threshold: [0, .25, .5, .75] });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
    return { stop: function () { io.disconnect(); timers.forEach(function (t) { clearTimeout(t); }); timers.clear(); } };
  };
})();
