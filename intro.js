/* s/ash — 開幕。闇（煙と星の空）を、ロゴの斜線に沿って一閃で切り裂き、二つに割れてサイトが現れる。
 * 空は WebGL のシェーダーで描く（使えない端末では CSS の暗いグラデーション）。動きを止める設定では出さない。 */
(window.slashInit || function (f) { f(); })(function () {
'use strict';
const root = document.documentElement, intro = document.getElementById('intro');
if (!intro) return;
let reduced = false;
try { const s = localStorage.getItem('slash-motion'); reduced = s ? s === 'off' : matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; }
let raf = 0, gl = null, done = false;
const skies = [];
function finish() {
  if (done) return; done = true; cancelAnimationFrame(raf);
  try { skies.forEach(s => { const ext = s.g.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }); } catch (e) { }
  root.classList.add('intro-done'); intro.remove();
  document.dispatchEvent(new Event('slash:intro-done'));
}
// 動きを止める設定、または #works などへのリンクで来たとき（boot.js が intro-on を付けない）は出さない
if (reduced || !root.classList.contains('intro-on')) { finish(); return; }
const hold = /[?&]intro=hold/.test(location.search); // 確認用：開幕の闇を止めたまま表示する
if (hold) intro.classList.add('hold');
// スクロール・クリック・キー操作があれば、待たせずにすぐ明ける
function skip() { if (done || hold) return; intro.classList.add('skip'); setTimeout(finish, 230); }
['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(t => addEventListener(t, skip, { once: true, passive: true }));

const A = intro.querySelector('.intro-a'), B = intro.querySelector('.intro-b');
const sky = intro.querySelector('.intro-a .intro-sky'), mirror = intro.querySelector('.intro-b .intro-sky');

/* 切り口：ロゴの斜線（約62.8度）に重ねて、画面の中心を通す */
function geometry() {
  const img = intro.querySelector('.intro-a .intro-face img'), lw = (img && img.getBoundingClientRect().width) || 200;
  const W = innerWidth, H = innerHeight, ang = 62.8 * Math.PI / 180, pad = 80, cx = W / 2 - .0082 * lw;
  const dx = (H / 2 + pad) / Math.tan(ang), top = cx + dx, bot = cx - dx;
  A.style.clipPath = `polygon(${-W}px ${-pad}px, ${top + .6}px ${-pad}px, ${bot + .6}px ${H + pad}px, ${-W}px ${H + pad}px)`;
  B.style.clipPath = `polygon(${top - .6}px ${-pad}px, ${2 * W}px ${-pad}px, ${2 * W}px ${H + pad}px, ${bot - .6}px ${H + pad}px)`;
}
geometry(); addEventListener('resize', geometry);

/* 闇：煙（領域をゆがめた fbm ノイズ）と、またたく星 */
const FS = `precision mediump float;
uniform vec2 r; uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int k=0;k<6;k++){v+=a*n(p);p=m*p;a*=.5;}return v;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*r)/r.y;
  vec2 q=vec2(fbm(uv*1.4+t*.03),fbm(uv*1.4+vec2(5.2,1.3)-t*.025));
  vec2 w=vec2(fbm(uv*1.6+4.*q+vec2(1.7,9.2)+t*.05),fbm(uv*1.6+4.*q+vec2(8.3,2.8)-t*.045));
  float f=fbm(uv*1.2+3.2*w);
  vec3 c=mix(vec3(.004,.004,.012),vec3(.09,.12,.40),clamp(f*f*2.2,0.,1.));
  c=mix(c,vec3(.0,.0,.01),clamp(length(q)-.35,0.,1.)*.7);
  c=mix(c,vec3(.38,.82,.96),clamp(pow(w.x,3.4),0.,1.)*.62);
  c=mix(c,vec3(.80,.20,.45),clamp(pow(w.y,3.6),0.,1.)*.5);
  float rid=1.-abs(2.*fbm(uv*2.6+2.*w+t*.04)-1.);
  c+=vec3(.25,.45,.8)*pow(rid,9.)*.35*f;
  c*=(f*1.5+.05)*.92;
  c+=vec3(.03,.05,.12)*exp(-length(uv)*3.2);
  float vg=smoothstep(1.35,.1,length(uv*vec2(.85,1.05)));
  c*=mix(.25,1.,vg);
  float s=h(floor(gl_FragCoord.xy*.7));
  c+=vec3(.85,.92,1.)*step(.9982,s)*(.55+.45*sin(t*2.6+s*91.))*(1.-smoothstep(.4,.8,f));
  c+=(h(gl_FragCoord.xy+fract(t)*91.)-.5)*.025;
  gl_FragColor=vec4(c,1.);
}`;
const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
// 二つに割れる面それぞれに同じ空を描く（画像の読み戻しをしないので、描画が詰まらない）
function makeSky(canvas) {
  const g = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!g) return null;
  const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; };
  const pr = g.createProgram(); g.attachShader(pr, sh(g.VERTEX_SHADER, VS)); g.attachShader(pr, sh(g.FRAGMENT_SHADER, FS)); g.linkProgram(pr);
  if (!g.getProgramParameter(pr, g.LINK_STATUS)) throw new Error('link');
  g.useProgram(pr);
  const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  return { g, canvas, uR: g.getUniformLocation(pr, 'r'), uT: g.getUniformLocation(pr, 't') };
}
try { [sky, mirror].forEach(c => { const s = makeSky(c); if (s) skies.push(s); }); } catch (e) { skies.length = 0; }
if (skies.length === 2) gl = skies[0].g; else skies.length = 0;
function size() {
  const k = Math.min(.5, 760 / Math.max(innerWidth, innerHeight));
  const w = Math.max(2, Math.round(innerWidth * k)), h = Math.max(2, Math.round(innerHeight * k));
  skies.forEach(s => { if (s.canvas.width !== w || s.canvas.height !== h) { s.canvas.width = w; s.canvas.height = h; s.g.viewport(0, 0, w, h); } });
}
const t0 = performance.now();
let slow = 0, prev = 0;
function frame(now) {
  if (done) return; size();
  if (prev && now - prev > 70) slow++; prev = now;
  if (slow > 3) return; // 描画が重い端末では、最後の一枚で止める
  const t = 9 + (now - t0) / 1000;
  skies.forEach(s => { s.g.uniform2f(s.uR, s.canvas.width, s.canvas.height); s.g.uniform1f(s.uT, t); s.g.drawArrays(s.g.TRIANGLES, 0, 3); });
  raf = requestAnimationFrame(frame);
}
if (skies.length) { intro.classList.add('gl'); raf = requestAnimationFrame(frame); }

/* 一閃・割れて飛ぶ動きは CSS が受け持つ。終わったら片付ける */
const halfB = intro.querySelector('.intro-b');
if (!hold) {
  halfB.addEventListener('animationend', e => { if (e.animationName === 'half-b') finish(); });
  setTimeout(finish, Math.max(300, 2000 - performance.now()));
}
});
