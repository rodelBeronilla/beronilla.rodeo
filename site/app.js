(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  function buzz(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }

  /* Sound is off until a visitor turns it on from the palette; then confirmations are tiny synthesized notes */
  var sound = { on: false, ctx: null };
  try { sound.on = localStorage.getItem("sound") === "on"; } catch (e) { /* ignore */ }
  function chime(freq, dur, gain) {
    if (!sound.on) return;
    try {
      if (!sound.ctx) sound.ctx = new (window.AudioContext || window.webkitAudioContext)();
      var c = sound.ctx;
      if (c.state === "suspended") c.resume();
      var o = c.createOscillator(), g = c.createGain(), t = c.currentTime, d = dur || 0.09;
      o.type = "sine"; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.07, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + d + 0.02);
    } catch (e) { /* no audio, no problem */ }
  }
  function setSound(on) {
    sound.on = on;
    try { localStorage.setItem("sound", on ? "on" : "off"); } catch (e) { /* ignore */ }
    if (on) { chime(660, 0.08); setTimeout(function () { chime(880, 0.12); }, 90); }
  }
  document.addEventListener("field:pulsed", function () { chime(520, 0.16, 0.05); });

  /* Theme, with a circular reveal through the View Transitions API; the field pulses from the same point */
  var themeBtn = document.getElementById("theme-btn");
  function labelTheme() {
    var dark = root.getAttribute("data-theme") !== "light";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  function setTheme(next, x, y) {
    var apply = function () {
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
      labelTheme();
    };
    document.dispatchEvent(new CustomEvent("field:pulse", { detail: { x: x, y: y } }));
    chime(next === "light" ? 784 : 587, 0.14, 0.05);
    if (!document.startViewTransition || reduce) { apply(); return; }
    var vt = document.startViewTransition(apply);
    vt.ready.then(function () {
      var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.animate(
        { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + r + "px at " + x + "px " + y + "px)"] },
        { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(function () {});
  }
  function toggleTheme(x, y) {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    setTheme(next, x, y);
  }
  if (themeBtn) {
    labelTheme();
    themeBtn.addEventListener("click", function (e) {
      var r = themeBtn.getBoundingClientRect();
      toggleTheme(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    });
  }

  /* Kinetic name: split into characters, react to pointer distance */
  var name = document.getElementById("name");
  var chars = [];
  if (name) {
    var i = 0;
    Array.prototype.slice.call(name.querySelectorAll(".line")).forEach(function (line) {
      var text = line.getAttribute("data-text") || line.textContent;
      line.textContent = "";
      line.setAttribute("aria-hidden", "true");
      Array.prototype.forEach.call(text, function (c) {
        var s = document.createElement("span");
        s.className = "ch";
        s.textContent = c;
        s.style.setProperty("--i", i++);
        s.style.setProperty("--w", 92);
        s.style.setProperty("--wg", 680);
        line.appendChild(s);
        chars.push(s);
      });
    });
    if (fine && !reduce) {
      var hero = document.querySelector(".hero");
      var pending = null;
      hero.addEventListener("pointermove", function (e) {
        pending = [e.clientX, e.clientY];
        requestAnimationFrame(function () {
          if (!pending) return;
          var px = pending[0], py = pending[1]; pending = null;
          chars.forEach(function (s) {
            var r = s.getBoundingClientRect();
            var d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
            var k = Math.max(0, 1 - d / 260);
            s.style.setProperty("--w", (92 + 8 * k).toFixed(1));
            s.style.setProperty("--wg", Math.round(680 + 120 * k));
          });
        });
      }, { passive: true });
      hero.addEventListener("pointerleave", function () {
        chars.forEach(function (s) { s.style.setProperty("--w", 92); s.style.setProperty("--wg", 680); });
      });
    }
  }

  /* Statements reveal word by word as they scroll into view */
  function splitWords(el) {
    if (!el) return;
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach(function (w, idx) {
      var s = document.createElement("span");
      s.className = "w"; s.textContent = w; s.style.setProperty("--i", idx);
      el.appendChild(s);
      if (idx < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  }
  if (!reduce) {
    splitWords(document.querySelector(".t-about .lead"));
    splitWords(document.querySelector(".t-contact h2"));
  }

  /* Toronto clock */
  var clock = document.getElementById("clock"), clockSub = document.getElementById("clock-sub");
  if (clock && window.Intl) {
    var tf = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    var df = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "long", timeZoneName: "short" });
    var tick = function () {
      var now = new Date();
      clock.textContent = tf.format(now);
      var parts = df.formatToParts(now);
      var wd = "", tz = "";
      parts.forEach(function (p) { if (p.type === "weekday") wd = p.value; if (p.type === "timeZoneName") tz = p.value; });
      clockSub.textContent = wd + ", " + tz;
    };
    tick(); setInterval(tick, 1000);
  }

  /* Toronto daylight: sunrise and sunset from the solar position, drawn as an arc */
  var sky = document.getElementById("sky"), skyDone = document.getElementById("sky-done"), skySun = document.getElementById("sky-sun"), skyTimes = document.getElementById("sky-times");
  if (sky && skyDone && skySun && skyTimes && window.Intl) {
    var LAT = 43.65, LON = -79.38, ARC = Math.PI * 72;
    var tzDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" });
    var tzTime = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hour12: false });
    var sunTimes = function (jd) {
      var rad = Math.PI / 180, n = jd - 2451545.0 + 0.0008, js = n - LON / 360;
      var M = ((357.5291 + 0.98560028 * js) % 360 + 360) % 360;
      var C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
      var L = ((M + C + 180 + 102.9372) % 360 + 360) % 360;
      var Jt = 2451545.0 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
      var dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
      var cosH = (Math.sin(-0.833 * rad) - Math.sin(LAT * rad) * Math.sin(dec)) / (Math.cos(LAT * rad) * Math.cos(dec));
      if (cosH > 1 || cosH < -1) return null;
      var H = Math.acos(cosH) / rad / 360;
      var toMs = function (j) { return (j - 2440587.5) * 86400000; };
      return { rise: toMs(Jt - H), set: toMs(Jt + H) };
    };
    var jdOf = function (ms) {
      var parts = {};
      tzDate.formatToParts(new Date(ms)).forEach(function (p) { parts[p.type] = p.value; });
      return Math.round(Date.UTC(+parts.year, +parts.month - 1, +parts.day, 12) / 86400000 + 2440587.5);
    };
    var skyTick = function () {
      var now = Date.now(), jd = jdOf(now), today = sunTimes(jd);
      if (!today) { skyTimes.textContent = ""; return; }
      var f, night;
      if (now >= today.rise && now <= today.set) { f = (now - today.rise) / (today.set - today.rise); night = false; }
      else if (now < today.rise) { var y = sunTimes(jd - 1) || today; f = (now - y.set) / (today.rise - y.set); night = true; }
      else { var tm = sunTimes(jd + 1) || today; f = (now - today.set) / (tm.rise - today.set); night = true; }
      f = Math.min(1, Math.max(0, f));
      var ang = Math.PI * f;
      skySun.setAttribute("cx", (100 - 72 * Math.cos(ang)).toFixed(1));
      skySun.setAttribute("cy", (night ? 80 + 22 * Math.sin(ang) : 80 - 72 * Math.sin(ang)).toFixed(1));
      skyDone.setAttribute("stroke-dashoffset", (night ? ARC : ARC * (1 - f)).toFixed(1));
      sky.classList.toggle("is-night", night);
      skyTimes.textContent = "Sunrise " + tzTime.format(new Date(today.rise)) + ", sunset " + tzTime.format(new Date(today.set));
    };
    skyDone.setAttribute("stroke-dasharray", ARC.toFixed(1));
    skyTick(); setInterval(skyTick, 30000);
  }

  /* Frameworks: an auto-scrolling strip you can also drag, wheel or tab through; each chip opens a popover */
  var mq = document.getElementById("marquee"), track = mq ? mq.querySelector(".marquee-track") : null;
  var mqPaused = false, popOpen = false;
  if (track) {
    var chips = Array.prototype.slice.call(track.children);
    var frag = document.createDocumentFragment();
    chips.forEach(function (c, idx) {
      c.style.anchorName = "--fw-" + idx;
      c.setAttribute("aria-describedby", c.getAttribute("popovertarget"));
      var k = c.cloneNode(true);
      k.setAttribute("aria-hidden", "true"); k.setAttribute("tabindex", "-1");
      k.style.anchorName = "--fw-" + idx + "-b";
      frag.appendChild(k);
    });
    track.appendChild(frag);
    var half = 0, pos = 0, userUntil = 0, mqRaf = 0, mqVisible = false, mqLast = 0;
    var measure = function () { half = track.scrollWidth / 2; };
    measure(); window.addEventListener("resize", measure, { passive: true });
    var mqFrame = function (now) {
      mqRaf = 0;
      if (reduce || !mqVisible || document.hidden || mqPaused || popOpen) return;
      var dt = Math.min(0.05, Math.max(0, (now - mqLast) / 1000)); mqLast = now;
      if (now < userUntil) pos = mq.scrollLeft; else pos += 55 * dt;
      if (half > 0 && pos >= half) pos -= half;
      if (pos < 0) pos = 0;
      mq.scrollLeft = pos;
      mqRaf = requestAnimationFrame(mqFrame);
    };
    var mqKick = function () { if (!mqRaf) { mqLast = performance.now(); pos = mq.scrollLeft; mqRaf = requestAnimationFrame(mqFrame); } };
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { mqVisible = en[0].isIntersecting; if (mqVisible) mqKick(); }, { threshold: 0.1 }).observe(mq);
    else { mqVisible = true; mqKick(); }
    if (fine) {
      mq.addEventListener("pointerenter", function () { mqPaused = true; });
      mq.addEventListener("pointerleave", function () { mqPaused = false; mqKick(); });
    }
    mq.addEventListener("focusin", function () { mqPaused = true; });
    mq.addEventListener("focusout", function () { mqPaused = false; mqKick(); });
    ["wheel", "touchstart", "pointerdown"].forEach(function (ev) { mq.addEventListener(ev, function () { userUntil = performance.now() + 2500; mqKick(); }, { passive: true }); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) mqKick(); });

    var anchorOK = typeof CSS !== "undefined" && CSS.supports && CSS.supports("position-anchor: --a");
    var lastInvoker = null;
    track.addEventListener("click", function (e) { var b = e.target.closest("button[popovertarget]"); if (b) lastInvoker = b; });
    Array.prototype.slice.call(document.querySelectorAll(".fw-pop")).forEach(function (pop) {
      var invoker = null;
      pop.addEventListener("beforetoggle", function (e) {
        if (e.newState === "open") {
          invoker = (e.source && e.source.nodeType === 1) ? e.source : lastInvoker;
          if (invoker && anchorOK) pop.style.positionAnchor = invoker.style.anchorName;
          if (invoker) invoker.classList.add("is-open");
        } else if (invoker) {
          invoker.classList.remove("is-open");
        }
      });
      pop.addEventListener("toggle", function (e) {
        popOpen = e.newState === "open";
        if (popOpen && invoker && !anchorOK) {
          var r = invoker.getBoundingClientRect();
          pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left)) + "px";
          pop.style.top = Math.max(8, r.top - pop.offsetHeight - 10) + "px";
        }
        if (!popOpen) mqKick();
      });
    });
  }

  /* Volleyball: a small physics toy. Drag to throw on any pointer; under a fine pointer the tile also tips toward the cursor. */
  var vbTile = document.querySelector(".t-vb"), ball = vbTile ? vbTile.querySelector(".ball") : null;
  var B = null;
  if (ball && !reduce) {
    B = { x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0, r: 0, hx: 0, hy: 0, gx: 0, gy: 0, spin: 0, drag: false, hover: false, live: false, raf: 0, last: 0, px: 0, py: 0, pt: 0 };
    var placeBall = function () {
      ball.style.translate = (B.x - B.r).toFixed(1) + "px " + (B.y - B.r).toFixed(1) + "px";
      ball.style.rotate = B.spin.toFixed(1) + "deg";
    };
    var vbMeasure = function () {
      var tr = vbTile.getBoundingClientRect();
      B.w = tr.width; B.h = tr.height;
      if (!B.live) {
        var cs = getComputedStyle(ball);
        B.r = ball.offsetWidth / 2;
        B.hx = B.w - (parseFloat(cs.right) || 0) - B.r; B.hy = (parseFloat(cs.top) || 0) + B.r;
        B.x = B.hx; B.y = B.hy;
      }
    };
    var vbFrame = function (now) {
      B.raf = 0;
      var dt = Math.min(0.033, Math.max(0.001, (now - B.last) / 1000)); B.last = now;
      if (!B.drag) {
        var ax = B.gx, ay = B.gy;
        if (!B.hover) { ax += (B.hx - B.x) * 30; ay += (B.hy - B.y) * 30; B.vx *= Math.pow(0.02, dt); B.vy *= Math.pow(0.02, dt); }
        B.vx = (B.vx + ax * dt) * Math.pow(0.5, dt);
        B.vy = (B.vy + ay * dt) * Math.pow(0.5, dt);
        B.x += B.vx * dt; B.y += B.vy * dt;
        if (B.x < B.r) { B.x = B.r; B.vx = Math.abs(B.vx) * 0.55; }
        if (B.x > B.w - B.r) { B.x = B.w - B.r; B.vx = -Math.abs(B.vx) * 0.55; }
        if (B.y < B.r) { B.y = B.r; B.vy = Math.abs(B.vy) * 0.55; }
        if (B.y > B.h - B.r) { B.y = B.h - B.r; B.vy = -Math.abs(B.vy) * 0.55; }
      }
      B.spin += (B.vx / Math.max(1, B.r)) * dt * 57.3;
      placeBall();
      var moving = Math.hypot(B.vx, B.vy) > 3 || Math.hypot(B.x - B.hx, B.y - B.hy) > 0.5;
      if (B.drag || B.hover || moving) B.raf = requestAnimationFrame(vbFrame);
      else { B.x = B.hx; B.y = B.hy; B.vx = 0; B.vy = 0; placeBall(); }
    };
    var vbKick = function () { if (!B.raf) { B.last = performance.now(); B.raf = requestAnimationFrame(vbFrame); } };
    var goLive = function () {
      if (!B.live) { vbMeasure(); ball.classList.add("is-live"); B.live = true; }
      else { var tr = vbTile.getBoundingClientRect(); B.w = tr.width; B.h = tr.height; }
    };
    vbTile.addEventListener("pointerenter", function (e) { goLive(); if (e.pointerType !== "touch") { B.hover = true; vbKick(); } });
    vbTile.addEventListener("pointerleave", function () { B.hover = false; B.gx = 0; B.gy = 0; vbKick(); });
    ball.addEventListener("pointerdown", function (e) {
      goLive();
      B.drag = true;
      try { ball.setPointerCapture(e.pointerId); } catch (err) { /* a pointer that is already gone */ }
      B.px = e.clientX; B.py = e.clientY; B.pt = performance.now(); B.vx = 0; B.vy = 0;
      ball.classList.add("is-held"); e.preventDefault(); vbKick();
    });
    ball.addEventListener("pointermove", function (e) {
      if (!B.drag) return;
      var tr = vbTile.getBoundingClientRect(), now = performance.now(), dt = (now - B.pt) / 1000;
      B.x = Math.min(B.w - B.r, Math.max(B.r, e.clientX - tr.left));
      B.y = Math.min(B.h - B.r, Math.max(B.r, e.clientY - tr.top));
      if (dt > 0.004) { B.vx = (e.clientX - B.px) / dt; B.vy = (e.clientY - B.py) / dt; B.px = e.clientX; B.py = e.clientY; B.pt = now; }
    });
    var release = function (e) {
      if (!B.drag) return;
      B.drag = false; ball.classList.remove("is-held");
      if (performance.now() - B.pt > 80) { B.vx = 0; B.vy = 0; }
      if (e && e.pointerType === "touch") { B.hover = true; setTimeout(function () { B.hover = false; vbKick(); }, 2500); buzz(4); }
      vbKick();
    };
    ball.addEventListener("pointerup", release);
    ball.addEventListener("pointercancel", release);
    window.addEventListener("resize", function () {
      if (B.live) { B.live = false; B.hover = false; ball.classList.remove("is-live"); ball.style.translate = ""; ball.style.rotate = ""; }
    }, { passive: true });
  }
  function vbGravity(x, y) { if (B && B.hover && !B.drag) { B.gx = (x - 0.5) * 1600; B.gy = (y - 0.5) * 1600; } }

  /* Tiles: tilt and light sweep follow the pointer on desktop */
  if (fine && !reduce) {
    Array.prototype.slice.call(document.querySelectorAll(".tile")).forEach(function (t) {
      t.addEventListener("pointermove", function (e) {
        var r = t.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        t.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
        t.style.setProperty("--my", (y * 100).toFixed(1) + "%");
        t.style.setProperty("--rx", ((0.5 - y) * 3.5).toFixed(2) + "deg");
        t.style.setProperty("--ry", ((x - 0.5) * 3.5).toFixed(2) + "deg");
        if (t === vbTile) vbGravity(x, y);
      }, { passive: true });
      t.addEventListener("pointerleave", function () { t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg"); });
    });

    /* Magnetic controls: buttons lean toward the cursor and spring back */
    Array.prototype.slice.call(document.querySelectorAll(".btn, .mark, .theme-btn, .cmd-btn")).forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.translate = (dx * 10).toFixed(1) + "px " + (dy * 8).toFixed(1) + "px";
      }, { passive: true });
      el.addEventListener("pointerleave", function () { el.style.translate = ""; });
    });
  }

  /* Section in view: underline in the top nav, highlight in the mobile dock */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".topnav a[href^='#'], .dock a[href^='#']"));
  if (navLinks.length && "IntersectionObserver" in window) {
    var groups = {};
    navLinks.forEach(function (a) { var id = a.getAttribute("href").slice(1); (groups[id] = groups[id] || []).push(a); });
    var currentId = null;
    var setCurrent = function (id) {
      if (currentId === id) return;
      if (currentId) groups[currentId].forEach(function (a) { a.removeAttribute("aria-current"); });
      currentId = id;
      if (id) groups[id].forEach(function (a) { a.setAttribute("aria-current", "true"); });
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting && groups[en.target.id]) setCurrent(en.target.id); });
    }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
    Object.keys(groups).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
    var top = document.getElementById("top");
    if (top) new IntersectionObserver(function (en) { if (en[0].isIntersecting) setCurrent(null); }, { rootMargin: "-60% 0px 0px 0px" }).observe(top);
  }

  /* Mobile dock: slips away while reading down the page, returns on the way back up or at either end */
  var dock = document.querySelector(".dock");
  if (dock) {
    var lastY = window.scrollY, dockRaf = 0;
    window.addEventListener("scroll", function () {
      if (dockRaf) return;
      dockRaf = requestAnimationFrame(function () {
        dockRaf = 0;
        var y = window.scrollY, dy = y - lastY;
        var atEnd = y + innerHeight >= document.documentElement.scrollHeight - 48;
        if (dy > 8 && y > 160 && !atEnd) dock.classList.add("is-hidden");
        else if (dy < -4 || y <= 160 || atEnd) dock.classList.remove("is-hidden");
        lastY = y;
      });
    }, { passive: true });
    dock.addEventListener("click", function (e) { if (e.target.closest("a, button")) buzz(4); });
  }

  /* Command palette */
  var dlg = document.getElementById("cmdk"), input = document.getElementById("cmdk-input"), list = document.getElementById("cmdk-list");
  function go(id) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }
  function copy(text, label) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast(label + " copied"); }, function () { toast("Copy failed"); });
  }
  function fieldAction(eventName, done) {
    if (root.getAttribute("data-field") !== "webgpu") { toast("Needs a browser with WebGPU"); return; }
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    document.dispatchEvent(new CustomEvent(eventName));
    toast(done);
  }
  var actions = [
    { t: "About", k: "section", run: function () { go("about"); } },
    { t: "Work and expertise", k: "section", run: function () { go("work"); } },
    { t: "Projects", k: "section", run: function () { go("projects"); } },
    { t: "Contact", k: "section", run: function () { go("contact"); } },
    { t: "Settle the field", k: "hero", run: function () { fieldAction("field:settle", "Field settled"); } },
    { t: "Run a sweep", k: "hero", run: function () { fieldAction("field:sweep", "Sweep running"); } },
    { t: "Toggle theme", k: "appearance", run: function () { toggleTheme(innerWidth - 40, 40); } },
    { t: "Toggle sound", k: "appearance", run: function () { setSound(!sound.on); toast(sound.on ? "Sound on" : "Sound off"); } },
    { t: "Print or save as PDF", k: "page", run: function () { window.print(); } },
    { t: "Copy LinkedIn link", k: "link", run: function () { copy("https://ca.linkedin.com/in/rodel-beronilla", "LinkedIn link"); } },
    { t: "Copy GitHub link", k: "link", run: function () { copy("https://github.com/rodelBeronilla", "GitHub link"); } },
    { t: "Open LinkedIn", k: "link", run: function () { window.open("https://ca.linkedin.com/in/rodel-beronilla", "_blank", "noopener"); } },
    { t: "Open GitHub", k: "link", run: function () { window.open("https://github.com/rodelBeronilla", "_blank", "noopener"); } },
    { t: "Back to top", k: "section", run: function () { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); } }
  ];
  var filtered = actions.slice(), sel = 0, query = "";
  var canHighlight = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight === "function";
  function paintMatches() {
    if (!canHighlight) return;
    if (!query) { CSS.highlights.delete("cmdk-match"); return; }
    var ranges = [];
    Array.prototype.slice.call(list.querySelectorAll("li[role='option']")).forEach(function (li) {
      var node = li.firstChild;
      if (!node || node.nodeType !== 3) return;
      var text = node.data.toLowerCase(), from = 0, at;
      while ((at = text.indexOf(query, from)) !== -1) {
        var r = new Range(); r.setStart(node, at); r.setEnd(node, at + query.length); ranges.push(r);
        from = at + query.length;
      }
    });
    var hl = new Highlight();
    ranges.forEach(function (r) { hl.add(r); });
    CSS.highlights.set("cmdk-match", hl);
  }
  function render() {
    list.innerHTML = "";
    if (!filtered.length) {
      var li = document.createElement("li"); li.className = "empty"; li.textContent = "No matches"; list.appendChild(li);
      paintMatches(); return;
    }
    filtered.forEach(function (a, idx) {
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", idx === sel ? "true" : "false");
      li.textContent = a.t;
      var s = document.createElement("small"); s.textContent = a.k; li.appendChild(s);
      li.addEventListener("click", function () { sel = idx; runSel(); });
      li.addEventListener("pointermove", function () { if (sel !== idx) { sel = idx; render(); } });
      list.appendChild(li);
    });
    paintMatches();
  }
  function filter() {
    query = input.value.trim().toLowerCase();
    filtered = query ? actions.filter(function (a) { return (a.t + " " + a.k).toLowerCase().indexOf(query) !== -1; }) : actions.slice();
    sel = 0; render();
  }
  function openCmd() { if (!dlg || dlg.open) return; input.value = ""; filter(); dlg.showModal(); input.focus(); }
  function closeCmd() { if (dlg && dlg.open) dlg.close(); if (canHighlight) CSS.highlights.delete("cmdk-match"); }
  function runSel() { var a = filtered[sel]; closeCmd(); if (a) { buzz(5); chime(660, 0.07, 0.04); setTimeout(a.run, 60); } }
  if (dlg) {
    ["cmd-open", "dock-menu"].forEach(function (id) { var b = document.getElementById(id); if (b) b.addEventListener("click", openCmd); });
    input.addEventListener("input", filter);
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, filtered.length); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + filtered.length) % Math.max(1, filtered.length); render(); }
      else if (e.key === "Enter") { e.preventDefault(); runSel(); }
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) closeCmd(); });
    dlg.addEventListener("close", function () { if (canHighlight) CSS.highlights.delete("cmdk-match"); });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg.open ? closeCmd() : openCmd(); }
    });
  }

  var printLink = document.getElementById("print-link");
  if (printLink) printLink.addEventListener("click", function () { window.print(); });

  /* Tiny toast for copy actions */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.setAttribute("role", "status");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add("is-on"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 1800);
  }
})();
