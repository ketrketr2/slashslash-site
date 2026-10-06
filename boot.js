/* http で開かれたら https へ移す（GitHub の「Enforce HTTPS」が証明書の取り直しで外れている間の保険）。本番のドメインだけ */
if(location.protocol==='http:'&&/(^|\.)slashslash\.jp$/.test(location.hostname))location.replace('https://www.slashslash.jp'+location.pathname+location.search+location.hash);
/* 描画前に「動きを止める」設定を反映して、ちらつきを防ぐ。動きがあるときは開幕の演出のためにヒーローを待たせる。
 * 事例や見出しへのリンク（#works など）から来たときは、開幕を出さずにすぐ本文を見せる。 */
try{var h=location.hash;if(localStorage.getItem('slash-motion')==='off'||(!localStorage.getItem('slash-motion')&&matchMedia('(prefers-reduced-motion: reduce)').matches))document.documentElement.classList.add('pre-reduced');else if(!h||h==='#'||h==='#top')document.documentElement.classList.add('intro-on')}catch(e){}
/* 文字の形（Google Fonts）は、表示を待たせずに読み込む（読み込みの間は代わりの書体で出し、届いたら差し替える）。
 * URL は index.html の <noscript id="fonts-ns"> の中の1か所だけに書く（JSが動かないときは、そちらがそのまま効く） */
try{var fn=document.getElementById('fonts-ns'),fm=fn&&/href="([^"]+)"/.exec(fn.textContent||fn.innerHTML);if(fm){var fl=document.createElement('link');fl.rel='stylesheet';fl.href=fm[1].replace(/&amp;/g,'&');document.head.appendChild(fl);}}catch(e){}
