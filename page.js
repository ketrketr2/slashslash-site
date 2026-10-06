/* s/ash — 事例のページ・実績の一覧（/works/。tools/build_pages.py が書き出す静的なページ）の小さな処理。
 * ・端末の「視差効果を減らす」設定がオンなら、見出しの動画を自動で再生しない（再生ボタンを出す）。
 * ・事例のページを見たことを、トップの「事例の詳細」と同じ view_case で送る（ui_from: page）。 */
(function () {
  'use strict';
  function run() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Array.prototype.forEach.call(document.querySelectorAll('video[autoplay]'), function (v) { v.removeAttribute('autoplay'); v.pause(); v.controls = true; });
    }
    var d = document.body.dataset;
    if (d.caseId && window.slashTrack) window.slashTrack('view_case', { case_id: d.caseId, case_name: d.caseName, case_industry: d.caseIndustry, ui_from: 'page' });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
