/* 描画前に「動きを止める」設定を反映して、ちらつきを防ぐ。動きがあるときは開幕の演出のためにヒーローを待たせる。
 * 事例や見出しへのリンク（#works など）から来たときは、開幕を出さずにすぐ本文を見せる。 */
try{var h=location.hash;if(localStorage.getItem('slash-motion')==='off'||(!localStorage.getItem('slash-motion')&&matchMedia('(prefers-reduced-motion: reduce)').matches))document.documentElement.classList.add('pre-reduced');else if(!h||h==='#'||h==='#top')document.documentElement.classList.add('intro-on')}catch(e){}
