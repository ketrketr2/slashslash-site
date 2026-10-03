/* ナヴィの「セカンド脳」描画。左半球＝論理（水色）、右半球＝記憶（紫）。
   情報は神経細胞として脳の上に置かれ、新しく入った情報は発火して中心へ信号が走る。
   声を聞いている間は脳が声に合わせて波打ち、考えている間は明滅し、話している間は声に合わせて光る。
   使い方：var b = NaviBrain({canvas, labels, onTap}); b.update(state); b.setMode('listening'); b.setLevel(0.4); */
(function () {
  "use strict";
  var KIND = {
    issue:    { color: "#ffb531", side: "crown",  label: "論点" },
    logic:    { color: "#3ef0ff", side: "left",   label: "言葉" },
    number:   { color: "#ffd166", side: "left",   label: "数字" },
    say:      { color: "#ffffff", side: "broca",  label: "言うこと" },
    flag:     { color: "#ff4d6d", side: "top",    label: "警報" },
    decision: { color: "#5dffb0", side: "left",   label: "決定" },
    person:   { color: "#d7a6ff", side: "right",  label: "人" },
    memory:   { color: "#a66bff", side: "right",  label: "記憶" },
    research: { color: "#3ef0ff", side: "front",  label: "事情" },
    example:  { color: "#ff3dbe", side: "frontR", label: "型・例" }
  };
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function glowTexture(inner, outer) {
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(0.25, outer); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); var t = new THREE.CanvasTexture(c); return t;
  }
  var VS = [
    "uniform float uTime; uniform float uLevel; uniform float uThink; uniform float uScale;",
    "uniform vec3 uFire[6]; uniform float uFireT[6];",
    "attribute float aSeed; attribute float aSize; attribute vec3 aColor;",
    "varying vec3 vColor; varying float vGlow; varying float vFade;",
    "void main(){",
    "  vec3 p = position;",
    "  float breathe = sin(uTime*1.3 + aSeed*6.2831)*0.010;",
    "  float voice = uLevel*0.11*sin(uTime*9.0 + aSeed*40.0 + p.x*6.0);",
    "  p += normalize(p + vec3(0.0001)) * (breathe + voice);",
    "  float g = 0.0;",
    "  for(int i=0;i<6;i++){",
    "    float dt = uTime - uFireT[i];",
    "    if(dt > 0.0 && dt < 3.2){",
    "      float d = distance(position, uFire[i]);",
    "      g += exp(-pow(d - dt*0.85, 2.0)*80.0) * exp(-dt*1.05);",
    "      g += exp(-d*d*45.0) * exp(-dt*2.6) * 1.6;",
    "    }",
    "  }",
    "  g += uThink*0.45*(0.5+0.5*sin(uTime*13.0 + aSeed*57.0));",
    "  vGlow = g; vColor = aColor;",
    "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
    "  vFade = clamp(1.35 + mv.z*0.28, 0.22, 1.0);",
    "  gl_PointSize = aSize * uScale * (1.0 + g*2.4) * (3.0 / -mv.z);",
    "  gl_Position = projectionMatrix * mv;",
    "}"].join("\n");
  var FS = [
    "precision mediump float;",
    "varying vec3 vColor; varying float vGlow; varying float vFade;",
    "void main(){",
    "  vec2 c = gl_PointCoord - 0.5; float r = length(c);",
    "  if(r > 0.5) discard;",
    "  float a = smoothstep(0.5, 0.0, r);",
    "  vec3 col = vColor*(0.8 + vGlow*1.7) + vec3(1.0)*vGlow*0.55;",
    "  gl_FragColor = vec4(col, a*(0.66 + vGlow*0.9)*vFade);",
    "}"].join("\n");

  function genBrain(N) {
    var pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N), surf = [];
    var cL = new THREE.Color("#3ef0ff"), cL2 = new THREE.Color("#2f6bff"), cR = new THREE.Color("#b98cff"), cR2 = new THREE.Color("#ff3dbe"), cC = new THREE.Color("#5dffb0");
    for (var i = 0; i < N; i++) {
      var part = Math.random(), x, y, z, onSurf = false;
      if (part < 0.8) {
        var u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
        var dx = Math.sin(v) * Math.cos(u), dy = Math.cos(v), dz = Math.sin(v) * Math.sin(u);
        var inner = Math.random() < 0.16 ? 0.35 + Math.random() * 0.55 : 1.0;
        var wr = 1 + 0.055 * Math.sin(u * 9 + v * 3) * Math.sin(v * 11) + 0.03 * Math.sin(u * 23) * Math.cos(v * 17);
        x = dx * 0.9 * wr * inner; y = dy * 0.6 * wr * inner; z = dz * 0.8 * wr * inner;
        if (y < -0.3) y = -0.3 + (y + 0.3) * 0.25;
        if (Math.abs(x) < 0.075) x = (x < 0 ? -1 : 1) * (0.075 + Math.random() * 0.02);
        if (y < -0.05 && Math.abs(x) > 0.5 && z > -0.2) y -= 0.06;
        onSurf = inner === 1.0;
      } else if (part < 0.93) {
        var u2 = Math.random() * Math.PI * 2, v2 = Math.acos(2 * Math.random() - 1);
        x = Math.sin(v2) * Math.cos(u2) * 0.42; y = -0.4 + Math.cos(v2) * 0.18 + 0.015 * Math.sin(v2 * 40); z = -0.52 + Math.sin(v2) * Math.sin(u2) * 0.26;
      } else {
        var t = Math.random(), a = Math.random() * Math.PI * 2, rr = 0.09 * (1 - t * 0.3) * Math.sqrt(Math.random());
        x = Math.cos(a) * rr; z = -0.2 - t * 0.12 + Math.sin(a) * rr; y = -0.3 - t * 0.55;
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      var c = x > 0 ? cL.clone().lerp(cL2, Math.random() * 0.65) : cR.clone().lerp(cR2, Math.random() * 0.45);
      if (part >= 0.8) c = cC.clone().lerp(cL, 0.45);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      seed[i] = Math.random(); size[i] = onSurf ? 0.8 + Math.random() * 1.4 : 0.45 + Math.random() * 0.8;
      if (!onSurf) { col[i * 3] *= 0.6; col[i * 3 + 1] *= 0.6; col[i * 3 + 2] *= 0.6; }
      if (onSurf) surf.push(new THREE.Vector3(x, y, z));
    }
    return { pos: pos, col: col, seed: seed, size: size, surf: surf };
  }
  function regionOf(side, p) {
    switch (side) {
      case "left": return p.x > 0.2;
      case "right": return p.x < -0.2;
      case "front": return p.z > 0.28 && p.y > -0.1;
      case "frontR": return p.z > 0.12 && p.x < -0.12;
      case "broca": return p.x > 0.3 && p.z > 0.15 && p.y < 0.15;
      case "top": return p.y > 0.36;
      case "crown": return Math.abs(p.x) < 0.4 && p.y > 0.4;
      default: return true;
    }
  }

  function NaviBrain(o) {
    if (!window.THREE) throw new Error("three.js が読めていない");
    var canvas = o.canvas, labels = o.labels, mobile = !!o.mobile;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    var DPR = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.75); renderer.setPixelRatio(DPR);
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    var camBase = new THREE.Vector3(0, o.camY || 2.45, o.camZ || -1.5), camOffsetY = 0;
    camera.position.copy(camBase); camera.lookAt(0, -0.05, 0);
    var group = new THREE.Group(); scene.add(group);
    var g = genBrain(o.points || (mobile ? 6200 : 7000));
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(g.pos, 3)); geo.setAttribute("aColor", new THREE.BufferAttribute(g.col, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(g.seed, 1)); geo.setAttribute("aSize", new THREE.BufferAttribute(g.size, 1));
    var fires = []; for (var i = 0; i < 6; i++) fires.push(new THREE.Vector3(0, -9, 0));
    var uni = { uTime: { value: 0 }, uLevel: { value: 0 }, uThink: { value: 0 }, uScale: { value: 1 }, uFire: { value: fires }, uFireT: { value: [-99, -99, -99, -99, -99, -99] } };
    var mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    group.add(new THREE.Points(geo, mat));
    var CORE = new THREE.Vector3(0, 0.12, 0.05);
    var coreTex = glowTexture("rgba(255,255,255,1)", "rgba(120,220,255,0.55)");
    var core = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    core.position.copy(CORE); core.scale.set(0.34, 0.34, 1); group.add(core);
    var halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(120,90,255,0.5)", "rgba(62,240,255,0.15)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.copy(CORE); halo.scale.set(1.5, 1.5, 1); group.add(halo);
    var dotTex = glowTexture("rgba(255,255,255,1)", "rgba(255,255,255,0.35)");
    var nodes = {}, pulses = [], fireIdx = 0, clock = 0, mode = "idle", level = 0, levelS = 0, think = 0, W = 1, H = 1;
    var yaw = 0, pitch = 0, vyaw = 0, vpitch = 0, drag = null, lastInteract = -99, onTap = o.onTap || function () {}, fitK = 1, nextSpark = 1.5;
    function fire(p) { fires[fireIdx].copy(p); uni.uFireT.value[fireIdx] = clock; fireIdx = (fireIdx + 1) % 6; }
    function curveFor(a, b) {
      var mid = a.clone().add(b).multiplyScalar(0.5); mid.add(mid.clone().normalize().multiplyScalar(0.22)); mid.y += 0.12;
      return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    }
    function pickPos(kind, label) {
      var side = (KIND[kind] || KIND.logic).side, cand = g.surf.filter(function (p) { return regionOf(side, p); });
      if (!cand.length) cand = g.surf;
      var idx = Math.floor(hash(kind + "|" + label) * cand.length) % cand.length;
      return cand[idx].clone().multiplyScalar(1.04);
    }
    function addNode(n) {
      var k = KIND[n.kind] || KIND.logic, p = pickPos(n.kind, n.label), color = new THREE.Color(k.color);
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      spr.position.copy(p); spr.scale.set(0.001, 0.001, 1); group.add(spr);
      var cv = curveFor(p, CORE), pts = cv.getPoints(28), lg = new THREE.BufferGeometry().setFromPoints(pts);
      var line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
      group.add(line);
      var el = document.createElement("div"); el.className = "nl k-" + n.kind;
      el.innerHTML = "<i></i><span></span>"; el.querySelector("span").textContent = n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label;
      if (labels) labels.appendChild(el);
      var node = { key: n.key, kind: n.kind, label: n.label, data: n.data, pos: p, spr: spr, line: line, curve: cv, el: el, born: clock, dying: -1, color: color, prio: n.prio || 0 };
      nodes[n.key] = node; return node;
    }
    function removeNode(node) {
      group.remove(node.spr); group.remove(node.line); node.spr.material.dispose(); node.line.geometry.dispose(); node.line.material.dispose();
      if (node.el && node.el.parentNode) node.el.parentNode.removeChild(node.el); delete nodes[node.key];
    }
    function pulse(node, n, reverse) {
      for (var i = 0; i < (n || 1); i++) {
        var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: node.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        s.scale.set(0.05, 0.05, 1); group.add(s); pulses.push({ s: s, node: node, t: -i * 0.18, sp: 0.55 + Math.random() * 0.35, rev: !!reverse });
      }
    }
    function nodesFrom(j) {
      var out = [], tp = j.topic || {}, P = function (kind, label, data, prio) { if (label) out.push({ key: kind + "|" + label, kind: kind, label: String(label), data: data, prio: (prio || 0) - (data && data.past ? 3 : 0) }); };
      (j.issues || []).forEach(function (x) { P("issue", x.text, x, 9); });
      (tp.entities || []).slice(0, 6).forEach(function (e) { P(/[0-9０-９%％万億円]/.test(e) ? "number" : "logic", e, { text: e }, 5); });
      (j.say || []).slice(-1).forEach(function (x) { P("say", "言うこと", x, 8); });
      (j.flags || []).slice(-2).forEach(function (x) { P("flag", ({ contradiction: "矛盾", commitment: "約束", risk: "リスク", forgotten: "忘れ物" })[x.type] || "警報", x, 7); });
      (j.decisions || []).slice(-2).forEach(function (x, i) { P("decision", "決定" + (i + 1), x, 4); });
      (j.people || []).slice(-4).forEach(function (x) { P("person", x.name, x, 8); });
      (j.recall || []).slice(-4).forEach(function (x) { P("memory", (x.text || "").slice(0, 12), x, 6); });
      (j.research || []).slice(-8).forEach(function (x) { var ex = x.kind === "kpi" || x.kind === "know" || x.kind === "term"; P(ex ? "example" : "research", x.title, x, ex ? 5 : 6); });
      return out;
    }
    var first = true;
    function update(j) {
      var want = nodesFrom(j || {}), seen = {}, fresh = [];
      want.forEach(function (n) {
        seen[n.key] = 1; var ex = nodes[n.key];
        if (!ex) { var nn = addNode(n); if (!first) fresh.push(nn); } else { ex.data = n.data; ex.prio = n.prio; if (ex.dying >= 0) ex.dying = -1; }
      });
      Object.keys(nodes).forEach(function (k) { if (!seen[k] && nodes[k].dying < 0) nodes[k].dying = clock; });
      fresh.slice(0, 5).forEach(function (n, i) { setTimeout(function () { fire(n.pos); pulse(n, 4); }, i * 260); });
      first = false; return fresh;
    }
    function setMode(m) { mode = m; }
    function setLevel(v) { level = Math.max(0, Math.min(1, v || 0)); }
    function lift(y) { camOffsetY = y; }
    function burst() { var ks = Object.keys(nodes); for (var i = 0; i < Math.min(6, ks.length); i++) pulse(nodes[ks[i]], 2, true); fire(CORE); }
    function resize() {
      var r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
      uni.uScale.value = DPR * (H / 820) * (mobile ? 6.2 : 5.2);
      fitK = W / H < 0.62 ? 1.85 : (W / H < 0.9 ? 1.35 : (W / H > 1.6 ? 0.86 : 1.0)); camera.position.copy(camBase).multiplyScalar(fitK);
    }
    window.addEventListener("resize", resize); resize();
    // 触って回す・触れて開く
    function pt(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    canvas.addEventListener("pointerdown", function (e) { drag = { p: pt(e), s: pt(e), t: performance.now() }; lastInteract = clock; });
    window.addEventListener("pointermove", function (e) { if (!drag) return; var p = pt(e); vyaw = (p.x - drag.p.x) * 0.006; vpitch = (p.y - drag.p.y) * 0.004; yaw += vyaw; pitch = Math.max(-0.5, Math.min(0.6, pitch + vpitch)); drag.p = p; lastInteract = clock; });
    window.addEventListener("pointerup", function (e) {
      if (!drag) return; var p = pt(e), moved = Math.hypot(p.x - drag.s.x, p.y - drag.s.y); drag = null;
      if (moved < 8) { var best = null, bd = 34; Object.keys(nodes).forEach(function (k) { var n = nodes[k]; if (n.sx === undefined || n.hidden) return; var d = Math.hypot(n.sx - p.x, n.sy - p.y); if (d < bd) { bd = d; best = n; } }); if (best) { fire(best.pos); pulse(best, 3); onTap(best); } }
    });
    var tmp = new THREE.Vector3(), camDir = new THREE.Vector3(), last = performance.now(), running = true;
    document.addEventListener("visibilitychange", function () { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(loop); } });
    function loop(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt * (reduce ? 0.35 : 1); uni.uTime.value = clock;
      levelS += (level - levelS) * 0.25; uni.uLevel.value = mode === "listening" || mode === "speaking" ? levelS : levelS * 0.3;
      think += ((mode === "thinking" ? 1 : 0) - think) * 0.08; uni.uThink.value = think;
      if (!drag) { vyaw *= 0.94; vpitch *= 0.9; yaw += vyaw; if (clock - lastInteract > 4 && !reduce) yaw += (Math.sin(clock * 0.23) * 0.45 - yaw) * 0.004; }
      group.rotation.y = yaw; group.rotation.x = pitch;
      camera.position.y += ((camBase.y * fitK + camOffsetY) - camera.position.y) * 0.06; camera.lookAt(0, -0.05 + camOffsetY * 0.35, 0);
      if (!reduce && clock > nextSpark) { fire(g.surf[Math.floor(Math.random() * g.surf.length)]); nextSpark = clock + (mode === "idle" ? 2.2 + Math.random() * 2.5 : 0.7 + Math.random()); }
      var coreS = 0.3 + 0.04 * Math.sin(clock * 2.2) + (mode === "listening" ? levelS * 0.35 : 0) + (mode === "speaking" ? levelS * 0.5 : 0) + think * 0.08 * Math.sin(clock * 18);
      core.scale.set(coreS, coreS, 1);
      core.material.color.set(mode === "thinking" ? "#d9b8ff" : mode === "speaking" ? "#ffd89a" : mode === "listening" ? "#b8fbff" : "#ffffff");
      halo.material.opacity = 0.55 + 0.25 * Math.sin(clock * 1.4) + think * 0.3;
      if (!reduce && Math.random() < dt * (mode === "thinking" ? 7 : 1.1)) { var ks = Object.keys(nodes); if (ks.length) pulse(nodes[ks[Math.floor(Math.random() * ks.length)]], 1, mode === "speaking"); }
      camera.getWorldDirection(camDir);
      var ordered = Object.keys(nodes).map(function (k) { return nodes[k]; }).sort(function (a, b) { return b.prio - a.prio || b.born - a.born; });
      var maxLabels = mobile ? 12 : 18, placed = [], shown = 0;
      ordered.forEach(function (n, idx) {
        var age = clock - n.born, dying = n.dying >= 0 ? Math.min(1, (clock - n.dying) / 0.8) : 0;
        if (dying >= 1) { removeNode(n); return; }
        var grow = Math.min(1, age / 0.6), pop = age < 0.6 ? 1 + Math.sin(age / 0.6 * Math.PI) * 1.2 : 1;
        var sz = (0.075 + (n.prio >= 8 ? 0.03 : 0)) * grow * pop * (1 - dying) * (1 + 0.12 * Math.sin(clock * 3 + n.born));
        n.spr.scale.set(sz, sz, 1); n.line.material.opacity = (0.16 + (age < 1.5 ? (1.5 - age) * 0.35 : 0)) * (1 - dying);
        tmp.copy(n.pos).applyMatrix4(group.matrixWorld);
        var facing = tmp.clone().sub(camera.position).normalize().dot(tmp.clone().normalize()) ;
        tmp.project(camera);
        n.sx = (tmp.x * 0.5 + 0.5) * W; n.sy = (-tmp.y * 0.5 + 0.5) * H;
        var lw = Math.min(14, n.label.length) * 11.5 + 24, flip = n.sx > W * 0.6, oy = 0, ok = false;
        var off = n.sx < -4 || n.sx > W + 4 || n.sy < -4 || n.sy > H + 4 || tmp.z > 1;
        if (!off && shown < maxLabels) {
          for (var tr = 0; tr < 3 && !ok; tr++) {
            oy = [0, -22, 22][tr]; var x0 = flip ? n.sx - lw - 6 : n.sx + 6, y0 = n.sy - 12 + oy, x1 = x0 + lw, y1 = y0 + 22;
            if (x0 < 2 || x1 > W - 2) continue;
            ok = !placed.some(function (r) { return !(x1 < r[0] || x0 > r[2] || y1 < r[1] || y0 > r[3]); });
            if (ok) { placed.push([x0, y0, x1, y1]); shown++; }
          }
        }
        n.hidden = !ok;
        if (n.el) {
          n.el.classList.toggle("flip", flip); n.el.style.setProperty("--oy", oy + "px");
          n.el.style.transform = "translate(" + n.sx.toFixed(1) + "px," + n.sy.toFixed(1) + "px)";
          n.el.style.opacity = n.hidden ? 0 : String(Math.max(0.25, Math.min(1, grow * (1 - dying) * (facing < 0.25 ? 1 : 0.55))));
          n.el.classList.toggle("fresh", age < 2.5);
        }
      });
      for (var i = pulses.length - 1; i >= 0; i--) {
        var q = pulses[i]; q.t += dt * q.sp;
        if (q.t < 0) { q.s.visible = false; continue; } q.s.visible = true;
        if (q.t >= 1 || !nodes[q.node.key]) { group.remove(q.s); q.s.material.dispose(); pulses.splice(i, 1); if (q.t >= 1 && !q.rev) { halo.scale.set(1.75, 1.75, 1); } continue; }
        var tt = q.rev ? 1 - q.t : q.t; q.s.position.copy(q.node.curve.getPoint(tt)); var ps = 0.045 + 0.03 * Math.sin(q.t * Math.PI); q.s.scale.set(ps, ps, 1);
      }
      halo.scale.x += (1.5 - halo.scale.x) * 0.08; halo.scale.y = halo.scale.x;
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return { update: update, setMode: setMode, setLevel: setLevel, burst: burst, fire: function (n) { if (n) { fire(n.pos); pulse(n, 3); } else fire(CORE); }, lift: lift, resize: resize, nodes: function () { return nodes; }, kinds: KIND };
  }
  window.NaviBrain = NaviBrain;
})();
