/* s/ash — 計測（Google アナリティクス 4、測定ID G-1QMPV3ZY1P）。
 * ・本番（www.slashslash.jp）だけで読み込む。プレビュー・ローカルでは読み込まない（?ga=force で強制。強制時は確認用の印つき）。
 * ・この端末を計測から外す：?ga=off（戻す：?ga=on）。端末のブラウザに保存する。
 * ・確認用：?ga_debug=1（GA の DebugView に出る。開発者トラフィックとしてレポートからは除く）。外した端末でも、確認用なら読み込む。
 * ・お名前・メールアドレス・相談内容など、入力された内容は送らない。
 * 事例の詳細・絞り込み・節の到達などは site.js / works-ui.js から window.slashTrack(イベント名, パラメータ) で送る。 */
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
  window.slashTrack = function () { };
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
  window.slashTrack = function (name, params) {
    try {
      var p = {};
      Object.keys(params || {}).forEach(function (k) { var v = params[k]; if (v == null || v === '') return; p[k] = typeof v === 'number' ? v : String(v).slice(0, 100); });
      gtag('event', name, p);
    } catch (e) { }
  };
})();
