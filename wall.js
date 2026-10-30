/* s/ash — ヒーローの「実績の壁」。手がけた映像と画面を、ブラウン管のテレビを積み上げた壁として流す（WebGL）。
 * ・静止画は2枚のアトラス（assets/hero/wall-a/b.webp、1枚に 256x144 のタイルが112）、映像は 4x3 にまとめた1本（wall-v.mp4、12秒で継ぎ目なく回る）
 * ・テレビ1台ずつ：ベゼル・丸い角・ふくらんだ画面・走査線・画面の光の照り返し。チャンネルが変わるときは砂嵐・カラーバー・CH 表示・縦の流れ・電源の入り切り
 * ・見た目（トンマナ）は7通りを巡回：VECTOR／LED／COLOR TV／VHS／B/W／THERMAL／PRINT の順（スマホは VECTOR なし）。4.5秒ごとに、波のように1台ずつ切り替える。右上の札で次へ送れる
 * ・マウス：レンズ（中は本来の色で拡大）、乗っているタイルの事例名の札と CH 表示、ドラッグで壁が動き（速いと砂嵐＝チューニング）、放すと波紋、
 *   速くなでるとなぞった所がめくれる、押すとそのタイルへ一気に寄って事例の詳細が開く。触らないとレンズが自動で巡回する
 * ・スクロールで下へ進むと、ブラウン管の電源を切るように横一線に縮んで消える
 * ・スマホ：レンズは自動で巡回、横になぞると壁が動く、タップでそのタイルの事例。重い VECTOR は使わない
 * ・動きを止める設定では、止まった1枚（COLOR TV・静止画のみ・レンズなし）。WebGL が使えない端末では、これまでの画像の壁（site.js）に戻す
 * 素材とタイルの対応は tools/hero-wall/build_*.py で作る（下の REEL を書き換える） */
(window.slashInit || function (f) { f(); })(function () {
'use strict';
const hero = document.querySelector('.hero'), cv = document.getElementById('hero-reel'), tip = document.getElementById('reel-tip'), chip = document.getElementById('reel-ch');
if (!hero || !cv) return;
const root = document.documentElement;
const P = (window.SLASH_WORKS && window.SLASH_WORKS.projects) || [];
const REEL = /*REEL*/{"cases":["crydope","ai-visibility","ai-observatory","ai-journey","marketing-command","navi","ai-film","data-agent","clean-room","urban-inbound","wallet-ads","omni-cx","price-research","isp-loyalty","fx-loyalty","owned-media","idea-studio","dealer-demo","condition-ui","taste-learn","reader-site","beauty-app","beauty-ui","music-hall","saas-site","bank-brand","dealer-community"],"stills":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,0,1,2,3,4,5,7,9,10,11,13,14,15,16,17,18,21,25,26,0,1,2,3,4,5,7,9,10,11,13,14,15,16,17,18,25,0,1,2,3,4,5,7,9,10,11,13,14,15,16,17,18,25,0,1,2,3,4,5,7,9,11,13,14,15,16,17,18,0,1,2,3,4,9,11,13,14,15,16,17,18,0,1,2,3,4,9,11,13,14,15,16,17,18,0,1,2,4,9,11,13,14,15,16,17,18,0,1,2,4,9,11,13,14,15,16,17,18,1,2,4,9,11,13,14,15,16,17,1,2,9,13,14,15,16,17,1,2,9,13,14,15,17],"video":{"slots":[0,0,0,6,6,2,2,5,1,17,17,16]}}/*END*/;
const byId = {}; P.forEach((p, i) => { byId[p.id] = i; });
const stillCase = REEL.stills.map(k => REEL.cases[k]);
const slotCase = REEL.video.slots.map(k => REEL.cases[k]);
const STILLS = stillCase.length, PER_ATLAS = 112, BARS = 1000;

let reduced = false;
try { const s = localStorage.getItem('slash-motion'); reduced = s ? s === 'off' : matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; }
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const small = () => innerWidth <= 720;
let failed = false, raf = 0;
function fail(why) {
  if (failed) return; failed = true; cancelAnimationFrame(raf); raf = 0;
  hero.classList.remove('reel-on'); cv.hidden = true; if (tip) tip.hidden = true; root.classList.remove('reel-hover');
  if (video) { video.pause(); video.removeAttribute('src'); video.remove(); }
  document.dispatchEvent(new CustomEvent('slash:reel-fail', { detail: why }));
}
let video = null;

/* ---------- WebGL ---------- */
let gl = null;
try { gl = cv.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
if (!gl || !STILLS) { fail('webgl'); return; }
const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
if (!hp || hp.precision < 20 || gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) < 7) { fail('highp'); return; }

const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
// 見た目の番号：0 COLOR TV／1 VHS／2 B/W／3 THERMAL／4 LED／5 PRINT／6 VECTOR（マスごとに持つので、切り替えは1台ずつ波のように進む）
const FS = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform vec2 uPan;uniform vec2 uPitch;uniform float uBez;uniform vec2 uCen;uniform float uZoom;
uniform vec4 uLens;uniform float uChroma;uniform float uRing;uniform vec3 uHover;uniform vec3 uSpot;uniform float uFade;uniform float uMin;
uniform float uStills;uniform float uVidOn;uniform vec2 uSlotTx;uniform float uGrid;
uniform float uTime;uniform float uTune;uniform float uPower;uniform float uPowerY;uniform float uLed;uniform float uOsdOn;
uniform sampler2D uCellA;uniform sampler2D uCellB;uniform sampler2D uCellC;uniform sampler2D uStillA;uniform sampler2D uStillB;uniform sampler2D uVideo;uniform sampler2D uOsd;
const vec3 ACC=vec3(.412,.851,.933);
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 tapA(vec2 t){return texture2D(uStillA,t).rgb;}
vec3 tapB(vec2 t){return texture2D(uStillB,t).rgb;}
vec3 still(float idx,vec2 uv,float fast){
  float s=mod(idx,112.);float c=mod(s,8.);float r=floor(s/8.);
  vec2 t=(vec2(c*256.+.75,r*144.+.75)+clamp(uv,0.,1.)*vec2(254.5,142.5))/2048.;
  if(uMin>1.25&&fast<.5){vec2 o=vec2(.25*uMin)/2048.;vec2 o2=vec2(o.x,-o.y);
    return idx<112.?(tapA(t+o)+tapA(t-o)+tapA(t+o2)+tapA(t-o2))*.25:(tapB(t+o)+tapB(t-o)+tapB(t+o2)+tapB(t-o2))*.25;}
  return idx<112.?tapA(t):tapB(t);}
vec3 video(float v,vec2 uv){
  float slot=mod(v,12.);float vi=floor(v/12.);
  float z=vi<.5?1.:(vi<1.5?1.55:2.2);
  vec2 off=(fract(vec2(slot*.618+vi*.37,slot*.414+vi*.71))-.5)*(1.-1./z);
  vec2 c=clamp(.5+off+(uv-.5)/z,uSlotTx*1.5,1.-uSlotTx*1.5);
  return texture2D(uVideo,(vec2(mod(slot,4.),floor(slot/4.))+c)/vec2(4.,3.)).rgb;}
vec3 bars(vec2 uv){
  float i=floor(clamp(uv.x,0.,.999)*7.);
  if(uv.y<.67)return i<1.?vec3(.75):i<2.?vec3(.75,.75,0.):i<3.?vec3(0.,.75,.75):i<4.?vec3(0.,.75,0.):i<5.?vec3(.75,0.,.75):i<6.?vec3(.75,0.,0.):vec3(0.,0.,.75);
  if(uv.y<.75)return i<1.?vec3(0.,0.,.75):i<2.?vec3(.08):i<3.?vec3(.75,0.,.75):i<4.?vec3(.08):i<5.?vec3(0.,.75,.75):i<6.?vec3(.08):vec3(.75);
  float j=floor(clamp(uv.x,0.,.999)*6.);return j<1.?vec3(0.,.13,.3):j<2.?vec3(1.):j<3.?vec3(.2,0.,.42):j<5.?vec3(.08):vec3(.03);}
vec3 src(float idx,vec2 uv,float fast){
  if(idx>900.)return bars(uv);
  if(idx<uStills)return still(idx,uv,fast);
  if(uVidOn>.5)return video(idx-uStills,uv);
  return still(mod(idx,112.),uv,fast);}
vec2 kb(vec4 B,vec2 tuv){float kz=1.+B.r*.4;vec2 ko=B.gb*2.-1.;return .5+(tuv-.5)/kz+ko*.5*(1.-1./kz);}
float cidx(vec4 A){return floor(A.r*255.+.5)+floor(A.g*255.+.5)*256.;}
vec3 ironbow(float x){x=clamp(x,0.,1.);
  vec3 c0=vec3(.02,0.,.09);vec3 c1=vec3(.3,0.,.6);vec3 c2=vec3(.9,.12,.38);vec3 c3=vec3(1.,.58,.06);vec3 c4=vec3(1.,.97,.7);
  return x<.25?mix(c0,c1,x*4.):x<.5?mix(c1,c2,x*4.-1.):x<.75?mix(c2,c3,x*4.-2.):mix(c3,c4,x*4.-3.);}
vec3 wall(vec2 q,float clean,out float hov){
  hov=0.;
  vec2 w=uCen+(q-uCen)/uZoom+uPan;
  vec2 cell=floor(w/uPitch);vec2 loc=w-cell*uPitch;
  vec2 tx=(mod(cell,uGrid)+.5)/uGrid;vec4 A=texture2D(uCellA,tx);vec4 B=texture2D(uCellB,tx);vec4 C=texture2D(uCellC,tx);
  float mode=floor(C.r*255./36.+.5);if(clean>.5)mode=0.;
  float tm=mod(floor(uTime*30.),997.);
  float stat=clean>.5?C.g*.5:max(C.g,uTune*(.15+.85*hash(cell+mod(floor(uTime*9.),331.))));
  if(mode>3.5&&mode<4.5){
    // LED：壁全体を1枚の電光掲示板に（点の並びは画面に固定）
    vec2 qc=(floor(q/uLed)+.5)*uLed;vec2 wc=uCen+(qc-uCen)/uZoom+uPan;
    vec2 c2=floor(wc/uPitch);vec2 l2=wc-c2*uPitch;vec2 t2=(mod(c2,uGrid)+.5)/uGrid;
    vec4 A2=texture2D(uCellA,t2);vec4 B2=texture2D(uCellB,t2);vec4 C2=texture2D(uCellC,t2);
    vec2 tuv=l2/uPitch;float sy2=max(A2.b,.002);tuv.y=.5+(tuv.y-.5)/sy2;
    vec3 col=abs(tuv.y-.5)>.5?vec3(0.):src(cidx(A2),kb(B2,tuv),1.);
    col=floor(col*5.+.35)/5.;col*=A2.a*2.;
    col=mix(col,vec3(hash(qc+tm)),max(C2.g,uTune*.6));
    float dd=length(q-qc)/uLed;
    return col*(smoothstep(.47,.3,dd)*1.3+exp(-dd*dd*8.)*.3);
  }
  float bf=mode<.5?1.:mode<1.5?.55:mode<2.5?1.:mode<3.5?.45:mode<5.5?.85:.35;
  float rf=mode<.5?.13:mode<1.5?.06:mode<2.5?.16:mode<3.5?.03:mode<5.5?0.:.02;
  float cf=mode<.5?.1:mode<1.5?.05:mode<2.5?.13:0.;
  float sf=mode<.5?.26:mode<1.5?.2:mode<2.5?.4:mode<3.5?.15:mode<5.5?0.:.18;
  if(clean>.5){sf*=.3;cf*=.5;}
  float sy=max(A.b,.002);
  vec2 hs=uPitch*.5-uBez*bf*.5;vec2 hs2=vec2(hs.x,hs.y*sy);
  vec2 d=loc-uPitch*.5;
  float rad=min(rf*hs.y*2.,hs2.y);
  vec2 qd=abs(d)-(hs2-rad);float sdf=length(max(qd,0.))+min(max(qd.x,qd.y),0.)-rad;
  float px=uDpr*uZoom;float m=clamp(.5-sdf*px,0.,1.);
  vec2 suv=d/hs2;vec2 sc=suv*(1.+cf*dot(suv,suv)*.6);
  float ar=hs.x/hs.y;vec2 cov=ar>1.7778?vec2(1.,1.7778/ar):vec2(ar/1.7778,1.);
  float row=floor(q.y*.5);
  float jx=0.;
  if(mode>.5&&mode<1.5){float band=exp(-pow((q.y/(uRes.y/uDpr)-(fract(uTime*.07)*1.5-.25))*9.,2.));jx=(hash(vec2(row,tm))-.5)*(.006+.07*band);stat=max(stat,band*.16);}
  jx+=(hash(vec2(row*1.7,tm))-.5)*.12*stat;
  vec2 tuv=.5+clamp(sc,-1.,1.)*.5*cov;tuv.x+=jx;
  if(B.a>.002)tuv.y=fract(tuv.y+B.a);
  float idx=cidx(A);vec2 kuv=kb(B,tuv);
  vec3 c;
  if(mode>.5&&mode<1.5){float e=.007;c=vec3(src(idx,kb(B,tuv+vec2(e,0.)),1.).r,src(idx,kuv,0.).g,src(idx,kb(B,tuv-vec2(e,0.)),1.).b);}
  else if(mode>5.5){vec2 e=.6/hs*cov;float l0=luma(src(idx,kuv,1.));
    float gx=luma(src(idx,kb(B,tuv+vec2(e.x,0.)),1.))-luma(src(idx,kb(B,tuv-vec2(e.x,0.)),1.));
    float gy=luma(src(idx,kb(B,tuv+vec2(0.,e.y)),1.))-luma(src(idx,kb(B,tuv-vec2(0.,e.y)),1.));
    float g=length(vec2(gx,gy));vec2 gg=abs(fract(sc*vec2(4.,3.)+.5)-.5);
    float grid=1.-smoothstep(0.,.03,min(gg.x,gg.y));
    c=vec3(.01,.05,.09)+ACC*(smoothstep(.06,.3,g)*.9+grid*.12)+vec3(1.)*smoothstep(.35,.8,g)*.5+ACC*l0*.06;}
  else c=src(idx,kuv,0.);
  vec3 edge=c;
  float n=hash(floor(q*uDpr*.7)+tm*vec2(7.,13.));
  if(mode<.5){c=mix(vec3(luma(c)),c,1.12)*vec3(1.03,1.,.95);c+=.2*c*c*c;
    if(uDpr>1.4){float mx=mod(floor(gl_FragCoord.x),3.);c*=mx<1.?vec3(1.,.91,.91):mx<2.?vec3(.91,1.,.91):vec3(.91,.91,1.);c*=1.07;}}
  else if(mode<1.5){c=mix(vec3(luma(c)),c,.78)*vec3(1.04,.96,1.07)*.92+.035+(n-.5)*.05;}
  else if(mode<2.5){float l=smoothstep(.03,.97,luma(c));c=vec3(l)*vec3(.9,.97,1.06)+(n-.5)*.09;}
  else if(mode<3.5){c=ironbow(luma(c)*.92+.04);
    float ch=(abs(d.x)<.7&&abs(d.y)<hs.y*.16)||(abs(d.y)<.7&&abs(d.x)<hs.y*.16)?1.:0.;c=mix(c,vec3(1.),ch*.55);}
  else if(mode<5.5){vec2 rq=vec2(q.x+q.y,q.y-q.x)*.7071;float hp=uLed*.8;vec2 cc=(fract(rq/hp)-.5)*hp;
    float ink=1.-luma(c);float r=hp*.5*sqrt(ink)*1.2;float dm=smoothstep(r+.7/uDpr,r-.7/uDpr,length(cc));
    c=mix(vec3(.83,.8,.74),vec3(.1,.1,.09),dm)*(.97+.03*n);}
  if(sf>0.){float lines=max(14.,floor(hs2.y*2.*px/2.6));float s=.5+.5*cos(6.2831*(sc.y*.5+.5)*lines);c*=(1.-sf*(1.-s))*(1.+sf*.45);}
  c*=1.-.35*pow(clamp(length(sc*vec2(.92,1.)),0.,1.5),4.)*(mode<2.5?1.:.45);
  if(mode<.5||(mode>1.5&&mode<2.5))c+=vec3(.045)*smoothstep(.2,1.,-(sc.x+sc.y)*.5)*(1.-smoothstep(.6,1.2,length(sc)));
  if(stat>.001){float n2=hash(floor(q*uDpr*.6)+tm*vec2(3.,11.));c=mix(c,vec3(n2)*(.4+.6*hash(vec2(row,tm))),clamp(stat,0.,1.));}
  // 画面の上の文字（CH 番号・▶ PLAY）
  float oa=C.a;float oi=floor(C.b*255.+.5);
  if(oa<.01&&mode>.5&&mode<1.5&&hash(cell*.37)<.3){oa=.85;oi=63.;}
  if(oa>.01&&uOsdOn>.5){vec2 S=hs2*2.;vec2 ps=(sc*.5+.5)*S;float oh=max(9.,S.y*.19);
    vec2 luv=(ps-S*vec2(.06,.08))/vec2(oh*4.,oh);
    if(luv.x>0.&&luv.x<1.&&luv.y>0.&&luv.y<1.){vec4 t=texture2D(uOsd,(vec2(mod(oi,4.),floor(oi/4.))+luv)/vec2(4.,16.));
      vec3 oc=oi>59.5||(mode>2.5&&mode<3.5)?vec3(1.):mode>5.5?ACC:vec3(.45,1.,.55);
      float a=t.a*oa*(.85+.15*hash(vec2(tm,oi)));c=c*(1.-a)+(mode>4.5&&mode<5.5?mix(vec3(.83,.8,.74),vec3(.1,.1,.09),t.r):t.rgb*oc)*a;}}
  c*=A.a*2.;
  if(sy<.999)c+=vec3(.75,.85,1.)*(1.-sy)*.9*(1.-abs(sc.y));
  if(any(greaterThan(abs(sc),vec2(1.))))c=vec3(0.);
  // ベゼル（テレビの縁）：画面の光がかすかに映る
  vec3 bz=mode>4.5&&mode<5.5?vec3(.8,.77,.71):vec3(.05,.05,.047)+.015*(1.-d.y/uPitch.y);
  float gf=mode<.5?.75:mode<1.5?.5:mode<2.5?.55:mode<3.5?.6:mode<5.5?0.:.85;
  bz+=edge*exp(-max(sdf,0.)*.45)*gf*.5*A.a*2.;
  if(mode>4.5&&mode<5.5)bz=mix(bz,vec3(.1,.1,.09),(1.-smoothstep(.6,1.6,abs(sdf)*px))*.85);
  vec3 col=mix(bz,c,m);
  if(uHover.z>0.&&abs(cell.x-uHover.x)<.5&&abs(cell.y-uHover.y)<.5){
    hov=uHover.z;col=mix(col,col*1.08+.03,hov*m);
    col=mix(col,ACC,hov*(1.-smoothstep(.8,2.6,abs(sdf)*px)));}
  return col;}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;
  vec2 res=uRes/uDpr;
  float boost=1.;vec3 halo=vec3(0.);
  if(uPower>.001){
    // ブラウン管の電源を切る：縦に縮んで横一線、最後に点になって消える
    float sy=max(1.-uPower/.8,.006);float sx=uPower>.8?max(1.-(uPower-.8)/.2,.004):1.;
    vec2 c0=vec2(res.x*.5,uPowerY);vec2 r=(p-c0)/vec2(sx,sy);
    float dy=abs(p.y-c0.y);halo=vec3(.7,.85,1.)*exp(-dy/(3.+sy*res.y*.25))*uPower*.55*(1.-smoothstep(0.,res.x*.5*sx+40.,abs(p.x-c0.x)));
    if(abs(r.y)>res.y*.75||abs(r.x)>res.x*.5){gl_FragColor=vec4(halo*uFade,1.);return;}
    p=c0+r;boost=1.+uPower*1.6;}
  vec3 col;float h;
  vec2 d=p-uLens.xy;float r=length(d);float s=r/max(uLens.z,1.);
  if(uLens.z>1.&&s<1.){
    float t=smoothstep(.38,1.,s);float m=mix(1./uLens.w,1.,t);
    vec2 q=uLens.xy+d*m;float k=uChroma*smoothstep(.5,1.,s);
    if(k>.0005){float h1;float h2;col=vec3(wall(uLens.xy+d*m*(1.+k),1.,h1).r,wall(q,1.,h).g,wall(uLens.xy+d*m*(1.-k),1.,h2).b);}
    else{col=wall(q,1.,h);}
    col*=1.05;
    float ring=1.-smoothstep(0.,1.25/uDpr,abs(r-uLens.z+1.));
    col=mix(col,vec3(1.),ring*.75*uRing);
    col+=vec3(.07)*smoothstep(.6,1.,s)*(1.-smoothstep(.95,1.,s))*uRing*max(0.,-dot(d/max(r,1.),vec2(.7071)));
  }else{
    col=wall(p,0.,h);
    if(uLens.z>1.){float o=(r-uLens.z)/20.;col*=1.-.42*uRing*(1.-smoothstep(0.,1.,o));}
  }
  float sp=exp(-dot(p-uSpot.xy,p-uSpot.xy)/(2.*430.*430.));
  col*=mix(1.-uSpot.z,1.,sp);
  vec2 e=p/res;
  col*=mix(.7,1.,smoothstep(0.,.16,e.x)*smoothstep(0.,.16,1.-e.x)*smoothstep(0.,.2,e.y)*smoothstep(0.,.24,1.-e.y));
  col=col*boost+halo;
  gl_FragColor=vec4(col*uFade,1.);
}`;
function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[reel]', gl.getShaderInfoLog(s)); return null; } return s; }
const vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
if (!vs || !fs) { fail('shader'); return; }
const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fail('link'); return; }
gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const aLoc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
const U = {}; ['uRes', 'uDpr', 'uPan', 'uPitch', 'uBez', 'uCen', 'uZoom', 'uLens', 'uChroma', 'uRing', 'uHover', 'uSpot', 'uFade', 'uMin', 'uStills', 'uVidOn', 'uSlotTx', 'uGrid', 'uTime', 'uTune', 'uPower', 'uPowerY', 'uLed', 'uOsdOn', 'uCellA', 'uCellB', 'uCellC', 'uStillA', 'uStillB', 'uVideo', 'uOsd'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
function makeTex(unit, uname, nearest) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const f = nearest ? gl.NEAREST : gl.LINEAR; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([12, 12, 11, 255]));
  gl.uniform1i(U[uname], unit); return t;
}
const T = { cellA: makeTex(0, 'uCellA', true), cellB: makeTex(1, 'uCellB', true), stillA: makeTex(2, 'uStillA'), stillB: makeTex(3, 'uStillB'), video: makeTex(4, 'uVideo'), cellC: makeTex(5, 'uCellC', true), osd: makeTex(6, 'uOsd') };
cv.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('lost'); });
hero.classList.add('reel-on');

/* ---------- 画面の上の文字（OSD）：CH 01〜60、▶ PLAY を1枚に描いておく（4列×16段、1段 256×64） ---------- */
let osdOn = false;
(function makeOsd() {
  try {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d');
    x.font = '700 40px ui-monospace, "SFMono-Regular", Menlo, Consolas, "Courier New", monospace'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const L = []; for (let i = 1; i <= 60; i++) L.push('CH ' + String(i).padStart(2, '0'));
    L[63] = '▶ PLAY';
    L.forEach((s, i) => { if (!s) return; const cx = (i % 4) * 256 + 12, cy = Math.floor(i / 4) * 64 + 33; x.lineWidth = 8; x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText(s, cx, cy); x.fillStyle = '#fff'; x.fillText(s, cx, cy); });
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, T.osd); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); osdOn = true;
  } catch (e) { osdOn = false; }
})();

/* ---------- 素材 ---------- */
const lite = small() || !fine.matches; // スマホ・タブレット：アトラスは1枚、映像は小さい版、重い見た目（VECTOR）は使わない
let stillCount = 0, vidOn = false, vidFrame = false, slotTx = [1 / 384, 1 / 216];
function loadAtlas(src, which) {
  return new Promise(res => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { if (failed) return res(false); gl.activeTexture(gl.TEXTURE0 + (which ? 3 : 2)); gl.bindTexture(gl.TEXTURE_2D, which ? T.stillB : T.stillA); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); res(true); };
    im.onerror = () => res(false);
    im.src = src;
  });
}
function startVideo() {
  if (video || reduced || failed || !slotCase.length) return;
  const c = navigator.connection; if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return; // 通信を節約する設定では映像を読まない
  video = document.createElement('video');
  video.muted = true; video.defaultMuted = true; video.playsInline = true; video.loop = true; video.preload = 'auto';
  ['muted', 'playsinline', 'loop'].forEach(a => video.setAttribute(a, ''));
  video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1; video.className = 'reel-src';
  // 画面の中に置く（iPhone の Safari は、画面に無い映像の再生を止めることがある）。壁の絵の下に隠れて見えない
  hero.insertBefore(video, cv);
  // H.264 が使えないブラウザ（一部の Linux 版など）は WebM（VP9）
  video.src = 'assets/hero/wall-v' + (lite ? '-s' : '') + (video.canPlayType('video/mp4; codecs="avc1.640028"') ? '.mp4' : '.webm');
  const onFrame = () => { vidFrame = true; video.requestVideoFrameCallback(onFrame); };
  video.addEventListener('playing', () => {
    if (!vidOn) { vidOn = true; slotTx = lite ? [1 / 192, 1 / 108] : [1 / 384, 1 / 216]; if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(onFrame); }
  });
  const p = video.play(); if (p && p.catch) p.catch(() => { /* 自動再生できない端末（省電力の設定など）は、静止画だけで回す */ });
}

/* ---------- マスの状態（32x32。壁が流れて、はみ出たマスは反対側から同じ状態で戻る） ---------- */
const GRID = 32, N = GRID * GRID;
const dataA = new Uint8Array(N * 4), dataB = new Uint8Array(N * 4), dataC = new Uint8Array(N * 4);
const S = {
  idx: new Int16Array(N), next: new Float32Array(N), start: new Float32Array(N), dur: new Float32Array(N).fill(1),
  z0: new Float32Array(N), z1: new Float32Array(N), x0: new Float32Array(N), x1: new Float32Array(N), y0: new Float32Array(N), y1: new Float32Array(N),
  flip: new Float32Array(N).fill(-1), pend: new Int16Array(N).fill(-1), flash: new Float32Array(N).fill(-9), born: new Float32Array(N).fill(-1), last: new Float32Array(N).fill(-9),
  // テレビらしさ：見た目（モード）・砂嵐・カラーバー・CH 表示・縦の流れ
  mode: new Uint8Array(N), modeNext: new Uint8Array(N), modeAt: new Float32Array(N).fill(-1),
  statT: new Float32Array(N).fill(-9), statD: new Float32Array(N).fill(.2), bars: new Float32Array(N).fill(-9), pend2: new Int16Array(N).fill(-1),
  osdT: new Float32Array(N).fill(-9), osdI: new Uint8Array(N), rollT: new Float32Array(N).fill(-9), rollD: new Float32Array(N).fill(.8)
};
const rnd = (() => { let s = (Date.now() ^ 0x5f3759df) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
const wrap = (v, n) => ((v % n) + n) % n;
const key = (cx, cy) => wrap(cx, GRID) + wrap(cy, GRID) * GRID;
// 映像のマスの出やすさ：人物の映像（音楽・商品動画）は顔が目立つので控えめに、画面の動き（AI検索・司令室・デモ）を多めに
const slotW = slotCase.map(c => c === 'crydope' ? .5 : c === 'ai-film' ? .6 : 1.1), slotSum = slotW.reduce((a, b) => a + b, 0);
function pickSlot() { let r = rnd() * slotSum; for (let i = 0; i < slotW.length; i++) { r -= slotW[i]; if (r <= 0) return i; } return slotW.length - 1; }
function pick(k) {
  // 映像を4割弱混ぜる。上下左右のマスと同じ中身（同じ映像の切り抜き違いも）にならないように選び直す
  const x = k % GRID, y = (k / GRID) | 0;
  const nb = [S.idx[wrap(x + 1, GRID) + y * GRID], S.idx[wrap(x - 1, GRID) + y * GRID], S.idx[x + wrap(y + 1, GRID) * GRID], S.idx[x + wrap(y - 1, GRID) * GRID]];
  let v = 0;
  for (let n = 0; n < 7; n++) {
    v = vidOn && rnd() < .38 ? STILLS + pickSlot() + 12 * ((rnd() * 3) | 0) : (rnd() * stillCount) | 0;
    const vs = v >= STILLS ? (v - STILLS) % 12 : -1;
    if (!nb.some(o => o === v || (vs >= 0 && o >= STILLS && (o - STILLS) % 12 === vs))) break;
  }
  return v;
}
function shot(k, t, idx) {
  S.idx[k] = idx; S.start[k] = t; const d = 3.2 + rnd() * 6.5; S.dur[k] = d; S.next[k] = t + d;
  const zr = idx >= STILLS ? .12 : .34, zin = rnd() < .55, a = rnd() * zr, b = rnd() * zr * .35;
  S.z0[k] = zin ? b : a; S.z1[k] = zin ? a : b;
  S.x0[k] = rnd() * 2 - 1; S.x1[k] = rnd() * 2 - 1; S.y0[k] = rnd() * 2 - 1; S.y1[k] = rnd() * 2 - 1;
}
const FLIP = .5;
function flip(k, t, delay = 0) {
  if (S.flip[k] >= 0 || !stillCount || reduced) return;
  S.flip[k] = t + delay; S.pend[k] = pick(k); S.last[k] = t + delay;
}
function zap(k, t, d) { if (reduced) return; S.statT[k] = t; S.statD[k] = d; } // 砂嵐を d 秒
function osd(k, t) { if (reduced) return; const c = caseOf(S.idx[k]); if (!c) return; S.osdT[k] = t; S.osdI[k] = Math.max(0, Math.min(59, (parseInt(c.p.no, 10) || 1) - 1)); }
// チャンネルを変える：砂嵐をはさんで別の中身へ。ときどきカラーバーをはさむ・CH 番号を出す
function channel(k, t) {
  const r = rnd();
  if (r < .3) { flip(k, t); return; }
  if (r < .38) { S.bars[k] = t + .45 + rnd() * .4; S.pend2[k] = pick(k); S.next[k] = S.bars[k] + 1; zap(k, t, .12); return; }
  shot(k, t, pick(k)); zap(k, t, .14 + rnd() * .2); if (rnd() < .5) osd(k, t + .1);
}

/* ---------- 見た目（トンマナ）の巡回 ---------- */
const LOOK_NAMES = ['COLOR TV', 'VHS', 'B/W', 'THERMAL', 'LED', 'PRINT', 'VECTOR'];
// 巡回の順：VECTOR と LED を先に（2026-10-30 本人の指示）。札の CH 番号はこの順で 1 から
const LOOKS = lite ? [4, 0, 1, 2, 3, 5] : [6, 4, 0, 1, 2, 3, 5];
const LOOK_HOLD = 4.5, LOOK_FIRST = 5.5, LOOK_WAVE = 2200; // 1つの見た目を映す秒数／最初の見た目（電源が入る分を足す）／切り替えの波の速さ（px/秒）
let lookI = 0, look = LOOKS[0], lookNext = 1e9;
function showLook() {
  if (!chip) return;
  const i = chip.querySelector('i'), s = chip.querySelector('span');
  if (i) i.textContent = 'CH ' + (lookI + 1); if (s) s.textContent = LOOK_NAMES[look];
  chip.setAttribute('aria-label', '壁の見た目を切り替える（いま：' + LOOK_NAMES[look] + '）');
  chip.classList.remove('zap'); void chip.offsetWidth; chip.classList.add('zap');
}
function setLook(i, t, ox, oy) {
  lookI = wrap(i, LOOKS.length); look = LOOKS[lookI]; showLook();
  // 波のように1台ずつ切り替える（砂嵐をはさむ）
  visibleCells((cx, cy, k) => {
    if (reduced) { S.mode[k] = look; S.modeAt[k] = -1; return; }
    const [sx, sy] = toScreen((cx + .5) * pitch[0], (cy + .5) * pitch[1]);
    S.modeNext[k] = look; S.modeAt[k] = t + Math.hypot(sx - ox, sy - oy) / LOOK_WAVE + rnd() * .1;
  });
  if (reduced) kick();
}

/* ---------- 大きさと、画面⇔壁の座標 ---------- */
let W = 1, H = 1, dpr = 1, gut = 3, bez = 8, ledP = 5.6, pitch = [128, 75], tileMin = 1, zoom = 1, scrollP = 0, power = 0, powerY = 0;
const copyEl = hero.querySelector('.hero-copy'), factsEl = hero.querySelector('.hero-index, .hero-facts'), howEl = hero.querySelector('.reel-howto');
const NONE = { x0: 0, y0: 1e4, x1: 0, y1: 1e4 };
let avoid = NONE, factsBox = NONE, howBox = NONE, chipBox = NONE, factsTop = 1e4; // レンズの自動巡回と事例名の札が避ける、文字の箱・数字・使い方・見た目の札
function size() {
  const r = hero.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
  const sm = small(); gut = sm ? 2 : 3; bez = sm ? 5 : 8; ledP = sm ? 4.2 : 5.6;
  const tw = sm ? Math.min(118, Math.max(80, W / 4.3)) : Math.min(172, Math.max(104, W / 12.5));
  pitch = [tw, (tw - gut) * 9 / 16 + gut];
  // 描く画素数に上限（4K の画面でも重くしない）
  dpr = Math.min(devicePixelRatio || 1, 2); const cap = sm ? 2.2e6 : 4.6e6; if (W * H * dpr * dpr > cap) dpr = Math.sqrt(cap / (W * H));
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  tileMin = 256 / ((tw - bez) * dpr);
  gl.viewport(0, 0, cv.width, cv.height);
  measure();
}
let measuredAt = -9;
function measure() {
  const r = hero.getBoundingClientRect(); measuredAt = now();
  const box = el => { if (!el) return NONE; const c = el.getBoundingClientRect(); return c.width && c.height ? { x0: c.left - r.left, y0: c.top - r.top, x1: c.right - r.left, y1: c.bottom - r.top } : NONE; };
  avoid = box(copyEl); factsBox = box(factsEl); howBox = box(howEl); chipBox = box(chip); factsTop = factsBox.y0;
}
const pan = { x: 300, y: 120, vx: 0, vy: 0 }, drift = { x: 15, y: 5 }, par = { x: 0, y: 0 }; // par：カーソルと反対へ少しずれる（奥行き）
const lens = { x: 0, y: 0, R: 0, M: 1.8, tx: 0, ty: 0, tR: 0, tM: 1.8, ring: 0 };
const smooth = x => x * x * (3 - 2 * x);
const clamp01 = x => Math.min(1, Math.max(0, x));
function lensMap(px, py) {
  if (lens.R < 1) return [px, py];
  const dx = px - lens.x, dy = py - lens.y, r = Math.hypot(dx, dy), s = r / lens.R;
  if (s >= 1) return [px, py];
  const tt = smooth(clamp01((s - .38) / .62)), m = 1 / lens.M + (1 - 1 / lens.M) * tt;
  return [lens.x + dx * m, lens.y + dy * m];
}
const toWall = (x, y) => [W / 2 + (x - W / 2) / zoom + pan.x + par.x, H / 2 + (y - H / 2) / zoom + pan.y + par.y];
const toScreen = (wx, wy) => [W / 2 + (wx - pan.x - par.x - W / 2) * zoom, H / 2 + (wy - pan.y - par.y - H / 2) * zoom];
function cellAt(px, py) {
  const [qx, qy] = lensMap(px, py), [wx, wy] = toWall(qx, qy);
  const cx = Math.floor(wx / pitch[0]), cy = Math.floor(wy / pitch[1]), lx = wx - cx * pitch[0], ly = wy - cy * pitch[1], e = Math.max(gut, bez * .6) * .5;
  return { cx, cy, k: key(cx, cy), inTile: lx > e && lx < pitch[0] - e && ly > e && ly < pitch[1] - e };
}
function visibleCells(fn) {
  const [ax, ay] = toWall(0, 0), [bx, by] = toWall(W, H);
  const c0 = Math.floor(ax / pitch[0]) - 1, c1 = Math.floor(bx / pitch[0]) + 1, r0 = Math.floor(ay / pitch[1]) - 1, r1 = Math.floor(by / pitch[1]) + 1;
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) fn(cx, cy, key(cx, cy));
}
function caseOf(idx) {
  const id = idx >= STILLS ? slotCase[(idx - STILLS) % 12] : stillCase[idx];
  const i = byId[id]; return i == null ? null : { p: P[i], video: idx >= STILLS };
}

/* ---------- 1フレーム ---------- */
const ptr = { x: -1, y: -1, inside: false, over: false, last: -9, speed: 0, down: false, px: 0, py: 0, moved: 0, t0: 0, tl: 0, id: -1, lx: 0, ly: 0, lt: 0 };
let hoverCell = null, hoverAmt = 0, tipKey = '', lastRipple = 0, born = -1, lastT = 0, tune = 0, tuneT = 0, nextRoll = 0;
let punch = null; // 押したタイルへレンズで一気に寄る
const vis = [];
// 計測：壁を触ったことを、操作の種類ごとに1回だけ送る（操作した場所＝reel_hover / reel_drag / reel_swipe / reel_channel）
const used = {}; let hoverTime = 0;
function use(a) { if (used[a]) return; used[a] = 1; try { if (window.slashTrack) window.slashTrack('reel_use', { ui_from: 'reel_' + a }); } catch (e) { } }
const t0 = performance.now(), now = () => (performance.now() - t0) / 1000;
function step(t) {
  const dt = Math.min(.05, Math.max(0, t - lastT)); lastT = t;
  zoom = 1 - .06 * scrollP;
  power = reduced ? 0 : smooth(clamp01((scrollP - .4) / .5));
  if (t - measuredAt > 1.5) measure(); // 文字の箱は開幕の動きで位置が変わるので、ときどき測り直す
  { const r = hero.getBoundingClientRect(), v0 = Math.max(0, -r.top), v1 = Math.min(H, innerHeight - r.top); powerY = (v0 + Math.max(v0 + 1, v1)) / 2; }
  if (!ptr.down && !reduced) {
    pan.x += (drift.x + pan.vx) * dt; pan.y += (drift.y + pan.vy) * dt;
    const f = Math.exp(-dt * 2.2); pan.vx *= f; pan.vy *= f;
  }
  const mx = GRID * pitch[0], my = GRID * pitch[1]; pan.x = wrap(pan.x, mx); pan.y = wrap(pan.y, my);

  // レンズ：マウスで操作中はカーソルに、そうでなければ自動で巡回（文字の箱を避けて右側・上側）
  const idle = t - ptr.last, manual = fine.matches && ptr.inside && ptr.over; // 壁の上にマウスがある間は、止めていてもレンズはカーソルの所
  if (reduced) { lens.tR = 0; }
  else if (manual) {
    lens.tx = ptr.x; lens.ty = ptr.y;
    const sp = Math.min(1, ptr.speed / 2600), dwell = clamp01((idle - .3) / 1.1), Rb = Math.min(230, Math.max(130, Math.min(W, H) * .2));
    lens.tR = Rb * (1 - .32 * sp) * (1 + .12 * dwell); lens.tM = 1.9 + .55 * dwell - .5 * sp;
  } else if (fine.matches && ptr.inside && !ptr.over && idle < 2.6) { lens.tR = 0; }
  else {
    const sm = small(), a = t * .21, b = t * .13 + 1.7;
    const R = sm ? Math.min(98, Math.max(66, W * .21)) : Math.min(190, Math.max(120, Math.min(W, H) * .17));
    let x0, x1, y0, y1;
    if (sm) { x0 = R * .8; x1 = W - R * .8; y0 = 126 + R * .4; y1 = Math.max(y0 + 20, Math.min(H - R, avoid.y0 - R * .75)); }
    else {
      x1 = W - R - 12; y0 = 70 + R * .55; y1 = Math.max(y0 + 40, Math.min(H - R - 40, factsTop - R - 8));
      if (x1 - (avoid.x1 + R + 12) >= 120) x0 = avoid.x1 + R + 12; // 文字の箱の右側だけを回る
      else { x0 = W * .45; y1 = Math.max(y0 + 30, Math.min(y1, avoid.y0 - R - 8)); } // 幅が足りないときは、文字の箱の上側を回る
    }
    lens.tx = x0 + (x1 - x0) * (.5 + .5 * Math.sin(a)); lens.ty = y0 + (y1 - y0) * (.5 + .5 * Math.sin(b));
    lens.tR = born >= 0 && t - born > 1.1 ? R : 0; lens.tM = 1.85; // 点き始めは壁だけを見せ、少し遅れてレンズが現れる
    if (!sm && born >= 0 && t - born > 4 && t - lastRipple > 11) ripple(lens.x, lens.y, t, 760); // ときどき、レンズの位置から波紋
  }
  if (punch) { if (t - punch.t < .6) { lens.tx = punch.x; lens.ty = punch.y; lens.tR = Math.max(W, H) * .42; lens.tM = 3.6; } else punch = null; }
  if (scrollP > .35) lens.tR = 0;
  const fast = manual || !!punch, kf = 1 - Math.exp(-dt * (fast ? 16 : 2.6)), kr = 1 - Math.exp(-dt * (punch ? 11 : 7));
  if (lens.R < 2) { lens.x = lens.tx; lens.y = lens.ty; } else { lens.x += (lens.tx - lens.x) * kf; lens.y += (lens.ty - lens.y) * kf; }
  lens.R += (lens.tR - lens.R) * kr; lens.M += (lens.tM - lens.M) * kr; lens.ring += ((lens.tR > 4 ? 1 : 0) - lens.ring) * kr;
  if (lens.R < .5 && lens.tR === 0) lens.R = 0;
  ptr.speed *= Math.exp(-dt * 6);
  if (manual) { hoverTime += dt; if (hoverTime > 1.2) use('hover'); }
  const ptx = manual ? (ptr.x / W - .5) * 46 : 0, pty = manual ? (ptr.y / H - .5) * 30 : 0, kp = 1 - Math.exp(-dt * 3);
  par.x += (ptx - par.x) * kp; par.y += (pty - par.y) * kp;
  // チューニング：ドラッグが速いほど砂嵐（すぐ立ち上がり、ゆっくり引く）
  tuneT *= Math.exp(-dt * 7); tune += (tuneT - tune) * (tuneT > tune ? .5 : 1 - Math.exp(-dt * 3)); if (reduced) tune = 0;
  // 見た目の巡回
  if (!reduced && born >= 0 && t >= lookNext) {
    const corner = rnd() < .5;
    setLook(lookI + 1, t, corner ? (rnd() < .5 ? 0 : W) : lens.x || W * .7, corner ? (rnd() < .5 ? 0 : H) : lens.y || H * .4);
    lookNext = t + LOOK_HOLD;
  }

  // 見えているマス：切り替え・めくれ・寄り引き・光・見た目・砂嵐を計算してテクスチャへ
  vis.length = 0;
  visibleCells((cx, cy, k) => {
    vis.push(k);
    if (S.born[k] < 0) {
      // はじめて見えるマス：右寄りの点から順に、テレビの電源が入るように映していく
      const [sx, sy] = toScreen((cx + .5) * pitch[0], (cy + .5) * pitch[1]);
      S.born[k] = reduced ? 0 : (born >= 0 ? Math.max(born, t - 1) : t) + .1 + Math.hypot(sx - W * .68, sy - H * .45) / 1700 + rnd() * .35;
      shot(k, t - rnd() * 5, pick(k)); S.mode[k] = look; S.modeAt[k] = -1; zap(k, S.born[k], .16);
    }
    if (!reduced) {
      if (S.modeAt[k] >= 0 && t >= S.modeAt[k]) { S.mode[k] = S.modeNext[k]; S.modeAt[k] = -1; zap(k, t, .13); }
      if (S.pend2[k] >= 0 && t >= S.bars[k]) { shot(k, t, S.pend2[k]); S.pend2[k] = -1; zap(k, t, .12); osd(k, t); }
      else if (S.flip[k] < 0 && S.pend2[k] < 0 && t >= S.next[k]) channel(k, t);
    }
    let sy = 1;
    if (S.flip[k] >= 0 && t >= S.flip[k]) {
      const a = (t - S.flip[k]) / FLIP;
      if (a >= 1) S.flip[k] = -1;
      else { sy = Math.abs(Math.cos(a * Math.PI)); if (a >= .5 && S.pend[k] >= 0) { shot(k, t, S.pend[k]); S.pend[k] = -1; } }
    }
    const u = reduced ? .5 : clamp01((t - S.start[k]) / S.dur[k]);
    const z = S.z0[k] + (S.z1[k] - S.z0[k]) * u, ox = S.x0[k] + (S.x1[k] - S.x0[k]) * u, oy = S.y0[k] + (S.y1[k] - S.y0[k]) * u;
    let br = 1, st = 0, oa = 0, roll = 0;
    if (!reduced) {
      const bt = t - S.born[k];
      if (bt < 0) { br = 0; sy = .002; } else if (bt < .34) sy = Math.min(sy, Math.max(.002, smooth(bt / .34))); // 電源が入る：横一線から開く
      const ft = t - S.flash[k]; if (ft >= 0 && ft < .34) br += .9 * (1 - ft / .34) * (1 - ft / .34);
      const s0 = t - S.statT[k]; if (s0 >= 0 && s0 < S.statD[k]) st = 1 - Math.pow(s0 / S.statD[k], 3);
      const o0 = t - S.osdT[k]; if (o0 >= 0 && o0 < 1.6) oa = o0 < 1.3 ? (o0 < .12 ? (Math.floor(o0 * 40) % 2 ? .4 : 1) : 1) : 1 - (o0 - 1.3) / .3;
      const r0 = t - S.rollT[k]; if (r0 >= 0 && r0 < S.rollD[k]) roll = smooth(r0 / S.rollD[k]);
    }
    const idx = t < S.bars[k] && S.pend2[k] >= 0 ? BARS : S.idx[k], o = k * 4;
    dataA[o] = idx & 255; dataA[o + 1] = idx >> 8; dataA[o + 2] = Math.round(sy * 255); dataA[o + 3] = Math.min(255, Math.round(br * 127.5));
    dataB[o] = Math.round(clamp01(z / .4) * 255); dataB[o + 1] = Math.round((ox * .5 + .5) * 255); dataB[o + 2] = Math.round((oy * .5 + .5) * 255); dataB[o + 3] = Math.round(roll * 255) % 256;
    dataC[o] = S.mode[k] * 36; dataC[o + 1] = Math.round(st * 255); dataC[o + 2] = S.osdI[k]; dataC[o + 3] = Math.round(clamp01(oa) * 255);
  });
  if (!reduced && born >= 0 && vis.length) {
    // ときどき1台、縦の同期が外れて画面が流れる
    if (t >= nextRoll) { const k = vis[(rnd() * vis.length) | 0]; if (S.flip[k] < 0) { S.rollT[k] = t; S.rollD[k] = .55 + rnd() * .5; } nextRoll = t + 1.6 + rnd() * 2.6; }
    // 速いドラッグ中は、あちこちのチャンネルが勝手に変わる（チューニング中）
    if (tune > .3) for (let i = 0, n = Math.ceil(tune * 3); i < n; i++) { const k = vis[(rnd() * vis.length) | 0]; if (S.flip[k] < 0 && S.pend2[k] < 0) { shot(k, t, pick(k)); zap(k, t, .1 + rnd() * .15); } }
  }

  // 乗っているタイル（マウスなら指している所、自動巡回ならレンズの中心）
  const show = (lens.R > 30 || (reduced && ptr.over && ptr.inside)) && power < .3;
  const hx = manual || reduced ? ptr.x : lens.x, hy = manual || reduced ? ptr.y : lens.y;
  if (show) { const c = cellAt(hx, hy); hoverCell = c.inTile ? c : null; } else hoverCell = null;
  hoverAmt = reduced ? (hoverCell ? 1 : 0) : hoverAmt + ((hoverCell ? 1 : 0) - hoverAmt) * (1 - Math.exp(-dt * 12));
  if (hoverCell && manual && !reduced) { const k = hoverCell.k, o0 = t - S.osdT[k]; if (!(o0 >= 0 && o0 < 1.2)) osd(k, t); else S.osdT[k] = Math.max(S.osdT[k], t - .5); }
  updateTip(manual || reduced);
}
function ripple(x, y, t, maxR = 980) {
  if (reduced) return; lastRipple = t;
  visibleCells((cx, cy, k) => {
    const [sx, sy] = toScreen((cx + .5) * pitch[0], (cy + .5) * pitch[1]), d = Math.hypot(sx - x, sy - y);
    if (d <= maxR) flip(k, t, d / 1350);
  });
}
function draw(t) {
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.cellA); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID, GRID, 0, gl.RGBA, gl.UNSIGNED_BYTE, dataA);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.cellB); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID, GRID, 0, gl.RGBA, gl.UNSIGNED_BYTE, dataB);
  gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, T.cellC); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GRID, GRID, 0, gl.RGBA, gl.UNSIGNED_BYTE, dataC);
  if (vidOn && video.readyState >= 2 && (vidFrame || !video.requestVideoFrameCallback)) {
    vidFrame = false; gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, T.video);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); } catch (e) { vidOn = false; }
  }
  gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uDpr, dpr);
  gl.uniform2f(U.uPan, pan.x + par.x, pan.y + par.y); gl.uniform2f(U.uPitch, pitch[0], pitch[1]); gl.uniform1f(U.uBez, bez);
  gl.uniform2f(U.uCen, W / 2, H / 2); gl.uniform1f(U.uZoom, zoom);
  gl.uniform4f(U.uLens, lens.x, lens.y, lens.R, Math.max(1, lens.M)); gl.uniform1f(U.uChroma, .018); gl.uniform1f(U.uRing, lens.ring);
  gl.uniform3f(U.uHover, hoverCell ? hoverCell.cx : -1e4, hoverCell ? hoverCell.cy : -1e4, hoverAmt);
  const lr = lens.R > 4; gl.uniform3f(U.uSpot, lr ? lens.x : W * .65, lr ? lens.y : H * .45, reduced ? 0 : .06 + .22 * lens.ring);
  const fadeIn = reduced ? 1 : born < 0 ? 0 : Math.min(1, (t - born + .2) / .6);
  gl.uniform1f(U.uFade, fadeIn);
  gl.uniform1f(U.uMin, tileMin); gl.uniform1f(U.uStills, STILLS); gl.uniform1f(U.uVidOn, vidOn ? 1 : 0);
  gl.uniform2f(U.uSlotTx, slotTx[0], slotTx[1]); gl.uniform1f(U.uGrid, GRID);
  gl.uniform1f(U.uTime, reduced ? 0 : t); gl.uniform1f(U.uTune, tune); gl.uniform1f(U.uPower, power); gl.uniform1f(U.uPowerY, powerY);
  gl.uniform1f(U.uLed, ledP); gl.uniform1f(U.uOsdOn, osdOn ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* ---------- 事例名の札（レンズの右下に添える） ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
let reelHover = false, tipSide = 0;
const VISUAL = new Set(['crydope', 'ai-film']);
function setReelHover(v) { if (v !== reelHover) { reelHover = v; root.classList.toggle('reel-hover', v); } }
function updateTip(byPointer) {
  const c = hoverCell && hoverAmt > .2 ? caseOf(S.idx[hoverCell.k]) : null;
  setReelHover(!!c && byPointer && fine.matches);
  if (!tip) return;
  if (!c) { if (tipKey) { tip.classList.remove('on'); tipKey = ''; } return; }
  const k = c.p.id + (c.video ? 'v' : 's');
  if (k !== tipKey) {
    tipKey = k; const p = c.p;
    // 種類：映像のマスは「映像」、静止画は写真・映像が中心の事例なら「ビジュアル」、それ以外は「画面・資料」。英語の名前が日本語の名前と同じ事例は、英語の副題を出す
    const kind = c.video ? '映像' : VISUAL.has(p.id) ? 'ビジュアル' : '画面・資料';
    const sub = String(p.label || '').toUpperCase() === String(p.title || '').toUpperCase() ? p.kicker : p.title;
    tip.innerHTML = `<small><b>${esc(p.no)}</b>${kind}</small><strong>${esc(p.label)}</strong><span>${esc(sub)}<i>${esc(p.industry)}</i></span><em>${fine.matches ? 'クリック' : 'タップ'}で事例を開く <b aria-hidden="true">↗</b></em>`;
    tip.classList.add('on');
  }
  const R = lens.R > 30 ? lens.R : 40, cx = lens.R > 30 ? lens.x : ptr.x, cy = lens.R > 30 ? lens.y : ptr.y;
  const tw = tip.offsetWidth || 240, th = tip.offsetHeight || 90, sm = small(), top = sm ? 118 : 78, g = R * .64;
  // 候補：レンズの斜め4方向（右下・右上・左上・左下）と真上・真下。画面の中に寄せたうえで、
  // 文字の箱・数字・使い方・見た目の札・レンズに重なる面積と、寄せた距離が小さい所。ほぼ同じなら今の位置のまま（ちらつかせない）
  const C = [[cx + g + 12, cy + g + 8], [cx + g + 12, cy - g - 8 - th], [cx - g - 12 - tw, cy - g - 8 - th], [cx - g - 12 - tw, cy + g + 8], [cx - tw / 2, cy - R - 10 - th], [cx - tw / 2, cy + R + 10]];
  const order = sm ? [1, 2, 4, 5, 0, 3] : [0, 1, 2, 3, 4, 5];
  const lb = { x0: cx - R * .78, y0: cy - R * .78, x1: cx + R * .78, y1: cy + R * .78 };
  const ov = (x, y, b) => Math.max(0, Math.min(x + tw, b.x1) - Math.max(x, b.x0)) * Math.max(0, Math.min(y + th, b.y1) - Math.max(y, b.y0));
  const pos = []; let best = order[0], bp = Infinity;
  order.forEach((i, rank) => {
    const x = Math.min(W - tw - 8, Math.max(8, C[i][0])), y = Math.min(H - th - 8, Math.max(top, C[i][1]));
    const oc = ov(x, y, avoid), pen = oc * 6 + ov(x, y, factsBox) * 3 + ov(x, y, howBox) * 3 + ov(x, y, chipBox) * 3 + ov(x, y, lb) + (Math.abs(x - C[i][0]) + Math.abs(y - C[i][1])) * 20 + rank * 40;
    pos[i] = [x, y, pen, oc]; if (pen < bp) { bp = pen; best = i; }
  });
  const cur = pos[tipSide];
  if (cur && cur[2] <= bp + 2500 && !(cur[3] > 0 && pos[best][3] === 0)) best = tipSide; else tipSide = best;
  tip.style.transform = `translate3d(${Math.round(pos[best][0])}px,${Math.round(pos[best][1])}px,0)`;
}

/* ---------- 操作 ---------- */
const at = e => { const r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const onWall = e => e.target === cv;
hero.addEventListener('pointermove', e => {
  const [x, y] = at(e), t = now();
  if (e.pointerType === 'mouse') {
    const dt = Math.max(.008, t - ptr.lt), v = Math.hypot(x - ptr.lx, y - ptr.ly) / dt;
    ptr.speed = Math.max(ptr.speed * .6, Math.min(5000, v)); ptr.lx = x; ptr.ly = y; ptr.lt = t;
    ptr.x = x; ptr.y = y; ptr.inside = true; ptr.over = onWall(e) || ptr.down; ptr.last = t;
    // 速くなでると、なぞった所のタイルがめくれる
    if (ptr.over && !ptr.down && v > 1300) { const c = cellAt(x, y); if (t - S.last[c.k] > 1) { flip(c.k, t); use('swipe'); } }
  }
  if (ptr.down && e.pointerId === ptr.id) {
    const dx = x - ptr.px, dy = y - ptr.py, touch = e.pointerType !== 'mouse'; ptr.px = x; ptr.py = y;
    pan.x -= dx / zoom; if (!touch) pan.y -= dy / zoom; ptr.moved += Math.abs(dx) + (touch ? 0 : Math.abs(dy));
    const dt = Math.max(.008, t - ptr.tl); ptr.tl = t;
    pan.vx = -dx / zoom / dt * .85 - drift.x; pan.vy = touch ? 0 : -dy / zoom / dt * .85 - drift.y;
    if (ptr.moved > 6) { hero.classList.add('reel-drag'); tuneT = Math.max(tuneT, Math.min(1, Math.hypot(dx, touch ? 0 : dy) / dt / 2600)); }
  }
  if (reduced) kick();
}, { passive: true });
hero.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { ptr.inside = false; ptr.over = false; if (reduced) kick(); } });
hero.addEventListener('pointerdown', e => {
  // 開幕の演出の最中（闇を切って明ける操作）や、点き始めの直後の押下は事例を開く操作にしない
  if (!onWall(e) || e.button > 0 || born < 0 || now() - born < .6 || (root.classList.contains('intro-on') && !root.classList.contains('intro-done'))) return;
  const [x, y] = at(e); ptr.down = true; ptr.id = e.pointerId; ptr.px = x; ptr.py = y; ptr.moved = 0; ptr.t0 = now(); ptr.tl = ptr.t0;
  pan.vx = 0; pan.vy = 0;
  // 自動で再生できなかった端末（省電力の設定など）は、触ったときに映像を始める
  if (video && video.paused && !reduced) { const p = video.play(); if (p && p.catch) p.catch(() => { }); }
  if (e.pointerType === 'mouse') { try { cv.setPointerCapture(e.pointerId); } catch (er) { } }
});
function up(e) {
  if (!ptr.down || e.pointerId !== ptr.id) return;
  ptr.down = false; hero.classList.remove('reel-drag'); ptr.over = document.elementFromPoint(e.clientX, e.clientY) === cv;
  if (e.type === 'pointercancel') { pan.vx = 0; pan.vy = 0; return; }
  const [x, y] = at(e), t = now();
  if (ptr.moved < 8 && t - ptr.t0 < .7) { open(x, y); return; }
  if (ptr.moved > 40) { ripple(x, y, t); use('drag'); }
}
hero.addEventListener('pointerup', up); hero.addEventListener('pointercancel', up);
function open(x, y) {
  const c = cellAt(x, y); if (!c.inTile) return;
  const info = caseOf(S.idx[c.k]); if (!info) return;
  // 押したタイルを光らせ、そのタイルの位置から事例の詳細を開く
  S.flash[c.k] = now(); zap(c.k, now(), .1);
  const r = hero.getBoundingClientRect();
  let [x0, y0] = toScreen(c.cx * pitch[0] + bez / 2, c.cy * pitch[1] + bez / 2), w = (pitch[0] - bez) * zoom, h = (pitch[1] - bez) * zoom;
  if (lens.R > 30 && Math.hypot(x - lens.x, y - lens.y) < lens.R) { const m = lens.M; x0 = lens.x + (x0 - lens.x) * m; y0 = lens.y + (y0 - lens.y) * m; w *= m; h *= m; }
  const from = document.createElement('div'); from.className = 'reel-from'; from.setAttribute('aria-hidden', 'true');
  from.style.cssText = `left:${Math.round(r.left + x0)}px;top:${Math.round(r.top + y0)}px;width:${Math.round(w)}px;height:${Math.round(h)}px`;
  document.body.append(from); setTimeout(() => from.remove(), 1600);
  const go = () => { if (typeof window.slashOpenCase === 'function') window.slashOpenCase(info.p.id, { from, src: 'reel' }); else location.hash = '#case-' + info.p.id; };
  if (reduced) { go(); return; }
  const [sx, sy] = toScreen((c.cx + .5) * pitch[0], (c.cy + .5) * pitch[1]); const [lx, ly] = lens.R > 30 && Math.hypot(x - lens.x, y - lens.y) < lens.R ? [x, y] : [sx, sy];
  punch = { t: now(), x: lx, y: ly }; kick(); setTimeout(go, 240);
}
// 見た目の札：押すと次の見た目へ（札の位置から波が広がる）
if (chip) chip.addEventListener('click', () => {
  if (failed || born < 0) return;
  const r = chip.getBoundingClientRect(), h = hero.getBoundingClientRect(), t = now();
  setLook(lookI + 1, t, r.left + r.width / 2 - h.left, r.top + r.height / 2 - h.top); lookNext = t + LOOK_HOLD + 3; use('channel'); kick();
});
window.slashReel = { next: () => { if (!failed && born >= 0) { const t = now(); setLook(lookI + 1, t, W * .7, H * .4); lookNext = t + LOOK_HOLD; kick(); } }, look: () => LOOK_NAMES[look],
  set: i => { if (!failed && born >= 0) { const t = now(); setLook(i, t, W * .7, H * .4); lookNext = 1e9; kick(); } }, // 確認用：その見た目で止める
  hold: () => { lookNext = 1e9; }, // 確認用：自動の切り替えを止める
  debug: () => { let st = 0, osdn = 0, bars = 0; vis.forEach(k => { const o = k * 4; if (dataC[o + 1] > 0) st++; if (dataC[o + 3] > 0) osdn++; if (dataA[o] === (BARS & 255) && dataA[o + 1] === BARS >> 8) bars++; }); return { vis: vis.length, st, osdn, bars, tune, power, t: now(), born }; } };

/* ---------- 見えている間だけ動かす ---------- */
let visible = true, docVisible = !document.hidden;
const playing = () => visible && docVisible && !failed && born >= 0 && !root.classList.contains('case-open');
function loop() {
  raf = 0;
  if (!playing() || reduced) { if (video && !video.paused) video.pause(); return; }
  const t = now(); step(t); draw(t);
  raf = requestAnimationFrame(loop);
}
let pending = false;
function kick() {
  if (failed || born < 0) return;
  if (reduced) { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; if (failed) return; const t = now(); step(t); draw(t); }); } return; }
  if (!raf && playing()) {
    if (video && vidOn && video.paused) { const p = video.play(); if (p && p.catch) p.catch(() => { }); }
    lastT = now(); raf = requestAnimationFrame(loop);
  }
}
new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { rootMargin: '60px 0px' }).observe(hero);
document.addEventListener('visibilitychange', () => { docVisible = !document.hidden; if (docVisible) kick(); });
new MutationObserver(() => { if (!root.classList.contains('case-open')) kick(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
addEventListener('scroll', () => { const r = hero.getBoundingClientRect(); scrollP = clamp01(-r.top / Math.max(1, r.height)); if (reduced) kick(); }, { passive: true });
addEventListener('resize', () => { size(); kick(); });
document.addEventListener('slash:motion', e => {
  reduced = !!(e.detail && e.detail.reduced);
  cancelAnimationFrame(raf); raf = 0;
  if (reduced) { if (video) video.pause(); lens.R = 0; lens.ring = 0; S.flip.fill(-1); S.born.fill(-1); S.bars.fill(-9); S.pend2.fill(-1); tune = tuneT = 0; }
  else { S.born.fill(-1); born = now(); lookNext = born + LOOK_FIRST; startVideo(); }
  kick();
});

/* ---------- はじめる ---------- */
size(); showLook();
loadAtlas('assets/hero/wall-a.webp', 0).then(ok => {
  if (!ok) { fail('atlas'); return; }
  stillCount = Math.min(STILLS, PER_ATLAS);
  const begin = () => { if (born >= 0) return; born = now(); lookNext = born + LOOK_FIRST; S.born.fill(-1); kick(); setTimeout(startVideo, 600); };
  // 開幕の演出があるときは、闇が割れるのに合わせて点ける
  if (root.classList.contains('intro-on') && !root.classList.contains('intro-done')) document.addEventListener('slash:intro-done', begin, { once: true });
  else begin();
  if (!lite && STILLS > PER_ATLAS) loadAtlas('assets/hero/wall-b.webp', 1).then(ok2 => { if (ok2) stillCount = STILLS; });
});
});
