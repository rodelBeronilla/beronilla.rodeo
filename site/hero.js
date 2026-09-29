/* beronilla.rodeo hero: a particle field that settles from noise into a lattice.
   WebGPU compute when the browser has it; the original WebGL shader otherwise.
   Vocabulary: hover slowly to settle, move fast to stir, click or tap to pulse,
   scroll to crystallize, flick to shake it, and an idle sweep now and then.
   Particles draw through a persistence buffer, so motion leaves light behind. */
(function () {
  "use strict";
  var original = document.getElementById("shader");
  if (!original) return;
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var fieldBox = original.parentElement;                      /* fixed backdrop behind the whole page */
  var hero = document.querySelector(".hero") || fieldBox;      /* the first screen: sweeps, intro, hints */

  function themeIsLight() { return root.getAttribute("data-theme") === "light"; }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* Shared state: pointer, theme, scroll, and the "order" of the field */
  var pointer = { x: 0.5, y: 0.35, tx: 0.5, ty: 0.35, active: false, lastMove: 0, vx: 0, vy: 0 };
  var stir = [0, 0];
  var pulse = { x: 0.5, y: 0.5, t: -1 };
  var t0 = performance.now(), last = t0;
  var sweep = { active: false, start: 0, next: t0 + 5200, x: -100 };
  var light = themeIsLight() ? 1 : 0, lightTarget = light;
  var scroll = 0, lens = 0, settleK = 0, settleUntil = 0, energy = 0;
  var lastScrollY = window.scrollY, lastScrollT = t0;
  var visible = true, running = false, raf = 0, renderer = null;
  var fps = { frames: 0, since: t0, value: 0, low: 0 };
  var vendorName = "";

  function heroPoint(cx, cy) { var r = fieldBox.getBoundingClientRect(); return [(cx - r.left) / r.width, 1 - (cy - r.top) / r.height]; }
  function aspect() { return renderer && renderer.aspect ? renderer.aspect() : 1; }
  function touched() { sweep.next = performance.now() + 14000; }
  function firePulse(nx, ny) {
    if (reduce) return;
    pulse.x = nx; pulse.y = ny; pulse.t = performance.now(); kick();
    document.dispatchEvent(new CustomEvent("field:pulsed"));
  }
  function startSweep() { if (reduce || sweep.active) return; sweep.active = true; sweep.start = performance.now(); kick(); }

  new MutationObserver(function () { lightTarget = themeIsLight() ? 1 : 0; kick(); })
    .observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  /* The field answers the pointer anywhere on the page; pulses come from the first screen only */
  window.addEventListener("pointermove", function (e) {
    var p = heroPoint(e.clientX, e.clientY), now = performance.now();
    if (pointer.lastMove) {
      var dt = Math.max(8, now - pointer.lastMove) / 1000, a = aspect();
      pointer.vx = (p[0] - pointer.tx) * 2 * a / dt;
      pointer.vy = (p[1] - pointer.ty) * 2 / dt;
    }
    pointer.tx = p[0]; pointer.ty = p[1]; pointer.lastMove = now; pointer.active = true;
    touched(); kick();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", function () { pointer.active = false; pointer.vx = 0; pointer.vy = 0; kick(); });
  window.addEventListener("pointerdown", function (e) {
    var p = heroPoint(e.clientX, e.clientY);
    pointer.tx = p[0]; pointer.ty = p[1]; pointer.active = true;
    var t = e.target && e.target.closest ? e.target : null;
    if (t && t.closest(".hero") && !t.closest("a, button, input")) {
      firePulse(p[0], p[1]);
      if (e.pointerType === "touch" && navigator.vibrate) { try { navigator.vibrate(6); } catch (err) { /* ignore */ } }
    }
    touched(); kick();
  }, { passive: true });
  /* Tilt to stir: a change in how the phone is held pushes the field, then it relaxes. Android only;
     iOS would need a permission prompt, and a visitor should not be asked for that on a personal page. */
  var tilt = [0, 0], tiltBase = [0, 0], tiltRaw = [0, 0], tiltSeen = false;
  if (!reduce && window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission !== "function") {
    window.addEventListener("devicemotion", function (e) {
      var g = e.accelerationIncludingGravity;
      if (!g || g.x === null || g.y === null) return;
      tiltRaw[0] = -g.x / 9.81; tiltRaw[1] = -g.y / 9.81;
      if (!tiltSeen) { tiltSeen = true; tiltBase[0] = tiltRaw[0]; tiltBase[1] = tiltRaw[1]; }
      kick();
    }, { passive: true });
  }
  document.addEventListener("field:settle", function () { settleUntil = performance.now() + 3600; touched(); kick(); });
  document.addEventListener("field:sweep", function () { startSweep(); });
  document.addEventListener("field:pulse", function (e) {
    var d = e.detail || {};
    if (typeof d.x === "number" && typeof d.y === "number" && visible) { var p = heroPoint(d.x, d.y); firePulse(p[0], p[1]); }
  });
  ["wheel", "touchmove", "keydown"].forEach(function (ev) { window.addEventListener(ev, touched, { passive: true }); });

  function telemetry() {
    if (!renderer || renderer.kind !== "webgpu") return;
    var el = document.getElementById("uh-field");
    if (el) el.textContent = "WebGPU field, " + renderer.count().toLocaleString("en-CA") + " particles, " + fps.value + " fps" + (vendorName ? ", " + vendorName + " GPU" : "");
    /* Grace under pressure: a GPU that cannot hold the frame rate gets a lighter field, quietly */
    var secs = (performance.now() - t0) / 1000;
    if (running && visible && !document.hidden && secs > 4 && fps.value < 38) fps.low++; else fps.low = 0;
    if (fps.low >= 2 && renderer.degrade) { renderer.degrade(); fps.low = 0; }
  }

  function frame(now) {
    raf = 0;
    if (!renderer) return;
    var dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000));
    last = now;
    pointer.x += (pointer.tx - pointer.x) * 0.12;
    pointer.y += (pointer.ty - pointer.y) * 0.12;
    light += (lightTarget - light) * 0.08;
    var sc = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
    scroll += (sc - scroll) * 0.1;
    var sdt = (now - lastScrollT) / 1000;
    if (sdt > 0.03) {
      var sv = Math.abs(window.scrollY - lastScrollY) / Math.max(1, window.innerHeight) / sdt;
      lastScrollY = window.scrollY; lastScrollT = now;
      var et = Math.min(1, sv / 2.5);
      energy += (et - energy) * (et > energy ? 0.5 : 0.06);
    }
    var moving = now - pointer.lastMove < 90;
    stir[0] += ((moving ? pointer.vx : 0) - stir[0]) * 0.2;
    stir[1] += ((moving ? pointer.vy : 0) - stir[1]) * 0.2;
    lens += ((pointer.active && !reduce ? 1 : 0) - lens) * 0.08;
    settleK += ((now < settleUntil ? 1 : 0) - settleK) * 0.06;
    var secs = (now - t0) / 1000;
    var intro = reduce ? 1 : 1 - smooth(0.6, 2.6, secs);
    var order = Math.max(intro, smooth(0.02, 0.55, scroll), settleK);
    if (!reduce && running && !sweep.active && !pointer.active && now >= sweep.next && secs > 4.5) startSweep();
    if (sweep.active) {
      var sp = (now - sweep.start) / 8000;
      if (sp >= 1) { sweep.active = false; sweep.x = -100; sweep.next = now + 26000; }
      else { var a = aspect(); sweep.x = -a - 0.3 + (2 * a + 1.3) * sp; }
    }
    var pt = pulse.t < 0 ? -1 : (now - pulse.t) / 1000;
    if (pt > 1.8) { pulse.t = -1; pt = -1; }
    if (tiltSeen) {
      tiltBase[0] += (tiltRaw[0] - tiltBase[0]) * 0.012; tiltBase[1] += (tiltRaw[1] - tiltBase[1]) * 0.012;
      tilt[0] += ((tiltRaw[0] - tiltBase[0]) * 2.2 - tilt[0]) * 0.15; tilt[1] += ((tiltRaw[1] - tiltBase[1]) * 2.2 - tilt[1]) * 0.15;
    }
    renderer.render(now, dt, {
      order: order, lens: lens, light: light, scroll: scroll, secs: secs, pointer: pointer,
      stir: stir, energy: energy, pulse: pulse, pulseT: pt, sweep: sweep.x, sweepW: 0.12, tilt: tilt
    });
    fps.frames++;
    if (now - fps.since >= 1000) {
      if (running && visible && !reduce) { fps.value = Math.round(fps.frames * 1000 / (now - fps.since)); telemetry(); }
      fps.frames = 0; fps.since = now;
    }
    var settling = Math.abs(light - lightTarget) > 0.005 || Math.abs(sc - scroll) > 0.002 || settleK > 0.01 || energy > 0.01 ||
      pt >= 0 || sweep.active || Math.abs(stir[0]) + Math.abs(stir[1]) > 0.01 || Math.abs(tilt[0]) + Math.abs(tilt[1]) > 0.01 ||
      (renderer.needsFrames && renderer.needsFrames());
    if ((!reduce && visible && running) || settling) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && renderer) { fps.frames = 0; fps.since = performance.now(); last = fps.since; raf = requestAnimationFrame(frame); }
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      running = visible && !document.hidden;
      if (running) kick();
    }, { threshold: 0.02 }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () { running = visible && !document.hidden; if (running) kick(); });
  window.addEventListener("resize", function () { if (renderer) renderer.resize(); kick(); }, { passive: true });
  window.addEventListener("scroll", function () { kick(); }, { passive: true });

  function announce(kind, detail) {
    root.setAttribute("data-field", kind);
    var el = document.getElementById("uh-field");
    if (el) el.textContent = detail;
    var hint = document.getElementById("field-hint");
    if (hint && kind === "webgpu" && !reduce) {
      if (!fine) hint.textContent = "Tap to pulse. Scroll to settle.";
      hint.classList.add("is-on");
    }
  }

  /* ---------- WebGPU: compute-driven particles through a persistence buffer ---------- */
  var WGSL_U = [
    "struct U {",
    "  res: vec2f, pointer: vec2f,",
    "  time: f32, dt: f32, order: f32, light: f32,",
    "  cols: f32, rows: f32, count: f32, lens: f32,",
    "  size: f32, seed: f32, aspect: f32, energy: f32,",
    "  stir: vec2f, pulse: vec2f,",
    "  pulseT: f32, sweep: f32, sweepW: f32, fade: f32,",
    "  tilt: vec2f, pad2: vec2f,",
    "};",
    "@group(0) @binding(0) var<uniform> u: U;",
    "fn hash21(p: vec2f) -> f32 {",
    "  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);",
    "  p3 = p3 + dot(p3, vec3f(p3.y, p3.z, p3.x) + 33.33);",
    "  return fract((p3.x + p3.y) * p3.z);",
    "}",
    "fn bgColor(light: f32) -> vec3f { return mix(vec3f(0.07, 0.07, 0.09), vec3f(0.975, 0.97, 0.96), light); }",
    "fn sweepBand(ds: f32, w: f32) -> f32 { return select(exp(-ds * ds / (w * w)), select(exp((ds + 0.35) / 0.3), 1.0, ds > -0.35), ds < 0.0); }"
  ].join("\n");

  var WGSL_STEP = WGSL_U + "\n" + [
    "@group(0) @binding(1) var<storage, read_write> P: array<vec4f>;",
    "fn grad(i: vec2f) -> vec2f { let a = hash21(i) * 6.2831853; return vec2f(cos(a), sin(a)); }",
    "fn gnoise(p: vec2f) -> f32 {",
    "  let i = floor(p); let f = fract(p); let w = f * f * (3.0 - 2.0 * f);",
    "  let a = dot(grad(i), f);",
    "  let b = dot(grad(i + vec2f(1.0, 0.0)), f - vec2f(1.0, 0.0));",
    "  let c = dot(grad(i + vec2f(0.0, 1.0)), f - vec2f(0.0, 1.0));",
    "  let d = dot(grad(i + vec2f(1.0, 1.0)), f - vec2f(1.0, 1.0));",
    "  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);",
    "}",
    "fn curl(p: vec2f) -> vec2f {",
    "  let e = 0.03;",
    "  let dx = gnoise(p + vec2f(e, 0.0)) - gnoise(p - vec2f(e, 0.0));",
    "  let dy = gnoise(p + vec2f(0.0, e)) - gnoise(p - vec2f(0.0, e));",
    "  return vec2f(dy, -dx) / (2.0 * e);",
    "}",
    "@compute @workgroup_size(64)",
    "fn step(@builtin(global_invocation_id) gid: vec3u) {",
    "  let i = gid.x;",
    "  if (f32(i) >= u.count) { return; }",
    "  let p = P[i];",
    "  let cols = u32(u.cols);",
    "  let cx = f32(i % cols); let cy = f32(i / cols);",
    "  let home = vec2f(((cx + 0.5) / u.cols * 2.0 - 1.0) * u.aspect, (cy + 0.5) / u.rows * 2.0 - 1.0);",
    "  let pos = p.xy;",
    "  var vel = p.zw;",
    "  let sx = 2.0 * u.aspect / u.cols; let sy = 2.0 / u.rows;",
    "  let nearest = vec2f((floor((pos.x + u.aspect) / sx) + 0.5) * sx - u.aspect, (floor((pos.y + 1.0) / sy) + 0.5) * sy - 1.0);",
    "  let m = vec2f((u.pointer.x / u.res.x * 2.0 - 1.0) * u.aspect, u.pointer.y / u.res.y * 2.0 - 1.0);",
    "  let d = distance(pos, m);",
    "  let sp = length(u.stir);",
    "  let slow = 1.0 - smoothstep(0.2, 1.4, sp);",
    "  let lens = u.lens * slow * (1.0 - smoothstep(0.0, 0.5, d));",
    "  let ds = pos.x - u.sweep;",
    "  let sweepK = sweepBand(ds, u.sweepW);",
    "  let beam = vec2f(-ds, 0.0) * 1.6 * (1.0 - smoothstep(0.0, 1.0, abs(ds)));",
    "  let local = max(lens, sweepK);",
    "  let order = clamp(u.order + local * (1.0 - u.order), 0.0, 1.0);",
    "  let t = u.time * 0.09;",
    "  let breath = 1.0 + 0.15 * sin(u.time * 0.35);",
    "  let flow = curl(pos * 1.3 + vec2f(t, -0.6 * t) + vec2f(u.seed, u.seed * 0.37)) * 0.9 * breath * (1.0 + 2.5 * u.energy);",
    "  let goal = mix(nearest, home, u.order);",
    "  let spring = (goal - pos) * 9.0;",
    "  let reach = u.lens * slow * (1.0 - smoothstep(0.15, 0.95, d));",
    "  let gather = (m - pos) * 1.4 * reach;",
    "  let dir = u.stir / max(sp, 0.0001);",
    "  let rel = pos - m;",
    "  let side = sign(dir.x * rel.y - dir.y * rel.x);",
    "  let wake = (dir * 0.6 + vec2f(-dir.y, dir.x) * side) * (1.0 - smoothstep(0.0, 0.7, d)) * smoothstep(0.15, 1.2, sp) * min(sp, 3.0) * 1.1;",
    "  let acc = mix(flow, spring, order) + gather * (1.0 - order) + wake + beam + flow * u.energy * 1.5 + u.tilt * (1.0 - order);",
    "  let damp = pow(mix(0.95, 0.78, order), u.dt * 60.0);",
    "  vel = vel * damp + acc * u.dt;",
    "  if (u.pulseT >= 0.0) {",
    "    let pp = vec2f((u.pulse.x / u.res.x * 2.0 - 1.0) * u.aspect, u.pulse.y / u.res.y * 2.0 - 1.0);",
    "    let prel = pos - pp; let pd = length(prel);",
    "    let ring = u.pulseT * 1.6;",
    "    let band = exp(-pow((pd - ring) / 0.12, 2.0));",
    "    let fade = 1.0 - smoothstep(0.0, 1.6, u.pulseT);",
    "    vel = vel + (prel / max(pd, 0.0001)) * band * fade * 6.0 * u.dt;",
    "  }",
    "  var np = pos + vel * u.dt;",
    "  let lim = u.aspect + 0.06;",
    "  if (np.x < -lim) { np.x = np.x + 2.0 * lim; }",
    "  if (np.x > lim) { np.x = np.x - 2.0 * lim; }",
    "  if (np.y < -1.06) { np.y = np.y + 2.12; }",
    "  if (np.y > 1.06) { np.y = np.y - 2.12; }",
    "  P[i] = vec4f(np, vel);",
    "}"
  ].join("\n");

  var WGSL_DRAW = WGSL_U + "\n" + [
    "struct VOut {",
    "  @builtin(position) pos: vec4f, @location(0) uv: vec2f,",
    "  @location(1) calm: f32, @location(2) lit: f32, @location(3) fast: f32, @location(4) tint: f32, @location(5) bright: f32",
    "};",
    "@group(0) @binding(1) var<storage, read> P: array<vec4f>;",
    "@vertex fn vmain(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {",
    "  let p = P[ii];",
    "  var corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));",
    "  let c = corners[vi];",
    "  let fi = f32(ii);",
    "  let h1 = hash21(vec2f(fi, 7.3)); let h2 = hash21(vec2f(fi, 19.1)); let h3 = hash21(vec2f(fi, 41.7));",
    "  let ndc = vec2f(p.x / u.aspect, p.y);",
    "  let sz = vec2f(u.size / u.res.x, u.size / u.res.y) * 2.0 * (0.65 + 0.9 * h1);",
    "  var o: VOut;",
    "  o.pos = vec4f(ndc + c * sz, 0.0, 1.0);",
    "  o.uv = c;",
    "  let sx = 2.0 * u.aspect / u.cols; let sy = 2.0 / u.rows;",
    "  let nearest = vec2f((floor((p.x + u.aspect) / sx) + 0.5) * sx - u.aspect, (floor((p.y + 1.0) / sy) + 0.5) * sy - 1.0);",
    "  let near = 1.0 - smoothstep(0.0, 0.4 * sy, distance(p.xy, nearest));",
    "  let speed = length(p.zw);",
    "  let still = 1.0 - smoothstep(0.02, 0.15, speed);",
    "  o.calm = near * still;",
    "  o.fast = smoothstep(0.35, 1.3, speed);",
    "  let ds = p.x - u.sweep;",
    "  o.lit = exp(-ds * ds / 0.012) + 0.45 * sweepBand(ds, 0.22);",
    "  o.tint = h2;",
    "  o.bright = 0.7 + 0.6 * h3;",
    "  return o;",
    "}",
    "@fragment fn fmain(v: VOut) -> @location(0) vec4f {",
    "  let r = length(v.uv);",
    "  if (r > 1.0) { discard; }",
    "  let soft = smoothstep(1.0, 0.3, r);",
    "  let L = u.light;",
    "  let violet = mix(vec3f(0.70, 0.62, 1.0), vec3f(0.42, 0.25, 0.84), L);",
    "  let cool = mix(vec3f(0.55, 0.80, 1.0), vec3f(0.20, 0.42, 0.85), L);",
    "  let spark = mix(vec3f(0.94, 0.92, 1.0), vec3f(0.22, 0.10, 0.50), L);",
    "  let calm = mix(vec3f(0.58, 0.92, 0.38), vec3f(0.16, 0.50, 0.14), L);",
    "  let beam = mix(vec3f(0.90, 1.0, 0.82), vec3f(0.10, 0.40, 0.10), L);",
    "  let lit = clamp(v.lit, 0.0, 1.0);",
    "  var col = mix(violet, cool, v.tint * 0.7);",
    "  col = mix(col, spark, v.fast);",
    "  col = mix(col, calm, v.calm);",
    "  col = mix(col, beam, lit * 0.8);",
    "  let a = soft * min(1.0, (mix(0.30, 0.9, v.calm) + 0.4 * v.fast + 0.6 * lit) * v.bright) * mix(1.0, 0.78, L);",
    "  return vec4f(col * a, a);",
    "}"
  ].join("\n");

  var WGSL_FADE = WGSL_U + "\n" + [
    "@vertex fn vmain(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {",
    "  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));",
    "  return vec4f(p[vi], 0.0, 1.0);",
    "}",
    "@fragment fn fmain() -> @location(0) vec4f { let f = u.fade; return vec4f(bgColor(u.light) * f, f); }"
  ].join("\n");

  var WGSL_BLIT = [
    "struct BV { @builtin(position) pos: vec4f, @location(0) uv: vec2f };",
    "@group(0) @binding(0) var samp: sampler;",
    "@group(0) @binding(1) var tex: texture_2d<f32>;",
    "@vertex fn vmain(@builtin(vertex_index) vi: u32) -> BV {",
    "  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));",
    "  var o: BV; o.pos = vec4f(p[vi], 0.0, 1.0); o.uv = vec2f(p[vi].x * 0.5 + 0.5, 0.5 - p[vi].y * 0.5); return o;",
    "}",
    "@fragment fn fmain(v: BV) -> @location(0) vec4f { return vec4f(textureSample(tex, samp, v.uv).rgb, 1.0); }"
  ].join("\n");

  function startGPU(canvas) {
    if (!navigator.gpu || typeof navigator.gpu.requestAdapter !== "function") return Promise.resolve(null);
    return navigator.gpu.requestAdapter({ powerPreference: "low-power" }).then(function (adapter) {
      if (!adapter || adapter.isFallbackAdapter) return null;
      var info = adapter.info || null;
      var v = info && info.vendor ? String(info.vendor).toLowerCase() : "";
      var names = { nvidia: "NVIDIA", amd: "AMD", intel: "Intel", apple: "Apple", qualcomm: "Qualcomm", arm: "Arm", google: "", microsoft: "" };
      vendorName = names[v] !== undefined ? names[v] : (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");
      return adapter.requestDevice().then(function (device) {
        var ctx = canvas.getContext("webgpu");
        if (!ctx) return null;
        var format = navigator.gpu.getPreferredCanvasFormat();
        ctx.configure({ device: device, format: format, alphaMode: "opaque" });

        var scale = Math.min(window.devicePixelRatio || 1, 2);
        var W = 1, H = 1, aspectV = 1, cols = 1, rows = 1, count = 0;
        var rect = canvas.getBoundingClientRect();
        var N0 = Math.min(90000, Math.max(6000, Math.round(rect.width * rect.height * 0.02)));
        var N = N0;
        var seed = Math.random() * 100;

        var ubuf = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        var pbuf = device.createBuffer({ size: N0 * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, mappedAtCreation: true });
        function layout() {
          aspectV = W / H;
          cols = Math.max(1, Math.round(Math.sqrt(N * aspectV)));
          rows = Math.max(1, Math.floor(N / cols));
          count = cols * rows;
        }
        function resize() {
          var r = canvas.getBoundingClientRect();
          var w = Math.max(1, Math.round(r.width * scale)), h = Math.max(1, Math.round(r.height * scale));
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          W = w; H = h; layout();
        }
        resize();
        (function seedHomes() {
          var a = new Float32Array(pbuf.getMappedRange());
          var c0 = cols, r0 = Math.ceil(N0 / c0);
          for (var i = 0; i < N0; i++) {
            var cx = i % c0, cy = Math.floor(i / c0);
            a[i * 4] = ((cx + 0.5) / c0 * 2 - 1) * aspectV;
            a[i * 4 + 1] = (cy + 0.5) / r0 * 2 - 1;
            a[i * 4 + 2] = 0; a[i * 4 + 3] = 0;
          }
          pbuf.unmap();
        })();

        var cLayout = device.createBindGroupLayout({ entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
          { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
        ] });
        var rLayout = device.createBindGroupLayout({ entries: [
          { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
          { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } }
        ] });
        var bLayout = device.createBindGroupLayout({ entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} }
        ] });
        var over = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" } };
        var cPipe = device.createComputePipeline({
          layout: device.createPipelineLayout({ bindGroupLayouts: [cLayout] }),
          compute: { module: device.createShaderModule({ code: WGSL_STEP }), entryPoint: "step" }
        });
        var drawMod = device.createShaderModule({ code: WGSL_DRAW });
        var rPipe = device.createRenderPipeline({
          layout: device.createPipelineLayout({ bindGroupLayouts: [rLayout] }),
          vertex: { module: drawMod, entryPoint: "vmain" },
          fragment: { module: drawMod, entryPoint: "fmain", targets: [{ format: format, blend: over }] },
          primitive: { topology: "triangle-list" }
        });
        var fadeMod = device.createShaderModule({ code: WGSL_FADE });
        var fadePipe = device.createRenderPipeline({
          layout: device.createPipelineLayout({ bindGroupLayouts: [rLayout] }),
          vertex: { module: fadeMod, entryPoint: "vmain" },
          fragment: { module: fadeMod, entryPoint: "fmain", targets: [{ format: format, blend: over }] },
          primitive: { topology: "triangle-list" }
        });
        var blitMod = device.createShaderModule({ code: WGSL_BLIT });
        var blitPipe = device.createRenderPipeline({
          layout: device.createPipelineLayout({ bindGroupLayouts: [bLayout] }),
          vertex: { module: blitMod, entryPoint: "vmain" },
          fragment: { module: blitMod, entryPoint: "fmain", targets: [{ format: format }] },
          primitive: { topology: "triangle-list" }
        });
        var cGroup = device.createBindGroup({ layout: cLayout, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: pbuf } }] });
        var rGroup = device.createBindGroup({ layout: rLayout, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: { buffer: pbuf } }] });
        var sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
        var trail = null, trailView = null, blitGroup = null, trailW = 0, trailH = 0, fresh = true;
        function ensureTrail() {
          if (trail && trailW === W && trailH === H) return;
          if (trail) trail.destroy();
          trail = device.createTexture({ size: [W, H], format: format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
          trailView = trail.createView(); trailW = W; trailH = H; fresh = true;
          blitGroup = device.createBindGroup({ layout: bLayout, entries: [{ binding: 0, resource: sampler }, { binding: 1, resource: trailView }] });
        }
        var uni = new Float32Array(28);
        var lost = false;
        device.lost.then(function () { lost = true; });
        device.addEventListener("uncapturederror", function (e) {
          console.warn("WebGPU error, falling back to WebGL:", e.error && e.error.message);
          lost = true;
        });

        return {
          kind: "webgpu",
          count: function () { return count; },
          aspect: function () { return aspectV; },
          resize: resize,
          degrade: function () { if (N > 9000) { N = Math.max(6000, Math.floor(N * 0.65)); layout(); } },
          needsFrames: function () { return false; },
          isLost: function () { return lost; },
          render: function (now, dt, s) {
            if (lost) return;
            ensureTrail();
            var L = s.light;
            uni[0] = W; uni[1] = H;
            uni[2] = s.pointer.x * W; uni[3] = s.pointer.y * H;
            uni[4] = reduce ? 12 : s.secs; uni[5] = reduce ? 1 / 60 : dt;
            uni[6] = s.order; uni[7] = L;
            uni[8] = cols; uni[9] = rows; uni[10] = count; uni[11] = s.lens;
            uni[12] = 1.5 * scale; uni[13] = seed; uni[14] = aspectV; uni[15] = s.energy;
            uni[16] = s.stir[0]; uni[17] = s.stir[1]; uni[18] = s.pulse.x * W; uni[19] = s.pulse.y * H;
            uni[20] = s.pulseT; uni[21] = s.sweep; uni[22] = s.sweepW; uni[23] = reduce ? 1 : 0.085 + 0.05 * L;
            uni[24] = s.tilt ? s.tilt[0] : 0; uni[25] = s.tilt ? s.tilt[1] : 0; uni[26] = 0; uni[27] = 0;
            device.queue.writeBuffer(ubuf, 0, uni);
            var bg = { r: 0.07 + (0.975 - 0.07) * L, g: 0.07 + (0.97 - 0.07) * L, b: 0.09 + (0.96 - 0.09) * L, a: 1 };
            var enc = device.createCommandEncoder();
            var cp = enc.beginComputePass();
            cp.setPipeline(cPipe); cp.setBindGroup(0, cGroup);
            cp.dispatchWorkgroups(Math.ceil(count / 64));
            cp.end();
            var p1 = enc.beginRenderPass({ colorAttachments: [{ view: trailView, loadOp: (fresh || reduce) ? "clear" : "load", storeOp: "store", clearValue: bg }] });
            fresh = false;
            if (!reduce) { p1.setPipeline(fadePipe); p1.setBindGroup(0, rGroup); p1.draw(3); }
            p1.setPipeline(rPipe); p1.setBindGroup(0, rGroup); p1.draw(6, count);
            p1.end();
            var p2 = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: bg }] });
            p2.setPipeline(blitPipe); p2.setBindGroup(0, blitGroup); p2.draw(3);
            p2.end();
            device.queue.submit([enc.finish()]);
          }
        };
      });
    }).catch(function () { return null; });
  }

  /* ---------- WebGL fallback: the original flowing-noise shader ---------- */
  function startGL(canvas) {
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false });
    if (!gl) return null;
    var VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    var FS = [
      "precision highp float;",
      "uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;uniform float u_scroll;uniform float u_light;",
      "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
      "vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}",
      "vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}",
      "float snoise(vec2 v){",
      " const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);",
      " vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);",
      " vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);",
      " vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);",
      " vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));",
      " vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;",
      " vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;",
      " m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);",
      " vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.0*dot(m,g);}",
      "float fbm(vec2 p){float f=0.0;float a=0.5;for(int i=0;i<3;i++){f+=a*snoise(p);p=p*1.9+vec2(1.7,9.2);a*=0.5;}return f;}",
      "vec3 pal(float t){return 0.5+0.4*cos(6.28318*(vec3(0.8,0.9,1.0)*t+vec3(0.0,0.15,0.3)));}",
      "void main(){",
      " vec2 uv=(gl_FragCoord.xy-0.5*u_res)/min(u_res.x,u_res.y);",
      " vec2 m=(u_mouse-0.5*u_res)/min(u_res.x,u_res.y);",
      " float t=u_time*0.05;",
      " vec2 p=uv*0.9;p.y+=u_scroll*0.4;",
      " vec2 q=vec2(fbm(p+vec2(0.0,t*0.6)),fbm(p+vec2(3.1,1.7)-t*0.4));",
      " vec2 r=vec2(fbm(p+1.6*q+vec2(1.7,9.2)+t*0.25),fbm(p+1.6*q+vec2(8.3,2.8)-t*0.2));",
      " float f=fbm(p+1.4*r)*0.5+0.5;",
      " float d=length(uv-m);f+=0.18*exp(-d*d*4.0);",
      " vec3 col=pal(f*0.7+0.1+u_scroll*0.1);",
      " float lum=dot(col,vec3(0.299,0.587,0.114));col=mix(vec3(lum),col,0.75);",
      " col+=0.12*pow(clamp(r.x*0.5+0.5,0.0,1.0),6.0);",
      " vec3 dark=col*0.62+0.05;vec3 light=mix(col,vec3(1.0),0.6);col=mix(dark,light,u_light);",
      " float vig=smoothstep(1.35,0.3,length(uv*vec2(0.85,1.1)));",
      " vec3 base=mix(vec3(0.07,0.07,0.09),vec3(0.975,0.97,0.96),u_light);",
      " col=mix(base,col,vig*0.9);",
      " gl_FragColor=vec4(col,1.0);}"
    ].join("\n");
    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ["u_res", "u_time", "u_mouse", "u_scroll", "u_light"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    var scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
    var W = 0, H = 0;
    function resize() {
      var r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width * scale));
      H = Math.max(1, Math.round(r.height * scale));
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); }
    }
    return {
      kind: "webgl",
      aspect: function () { return H ? W / H : 1; },
      resize: resize,
      needsFrames: function () { return false; },
      isLost: function () { return gl.isContextLost(); },
      render: function (now, dt, s) {
        resize();
        gl.uniform2f(U.u_res, W, H);
        gl.uniform1f(U.u_time, reduce ? 12.0 : s.secs);
        gl.uniform2f(U.u_mouse, s.pointer.x * W, s.pointer.y * H);
        gl.uniform1f(U.u_scroll, s.scroll);
        gl.uniform1f(U.u_light, s.light);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  }

  /* ---------- Boot: try WebGPU on a fresh canvas, else WebGL on the original ---------- */
  function bootGL() {
    renderer = startGL(original);
    if (!renderer) { original.remove(); root.setAttribute("data-field", "none"); return; }
    announce("webgl", "WebGL shader (WebGPU where available)");
    running = true; kick();
  }
  var gpuCanvas = document.createElement("canvas");
  gpuCanvas.className = original.className;
  gpuCanvas.id = "shader";
  gpuCanvas.setAttribute("aria-hidden", "true");
  original.id = "shader-gl";
  original.parentNode.insertBefore(gpuCanvas, original);
  startGPU(gpuCanvas).then(function (r) {
    if (r) {
      original.remove();
      renderer = r;
      announce("webgpu", "WebGPU field, " + r.count().toLocaleString("en-CA") + " particles" + (vendorName ? ", " + vendorName + " GPU" : ""));
      running = true; kick();
      var watch = setInterval(function () {
        if (r.isLost()) { clearInterval(watch); renderer = null; gpuCanvas.replaceWith(original); original.id = "shader"; bootGL(); }
      }, 2000);
    } else {
      gpuCanvas.remove();
      original.id = "shader";
      bootGL();
    }
  });
})();
