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

  /* Theme, with a circular reveal through the View Transitions API; the field pulses from the same point.
     The browser chrome (address bar, status bar) follows the toggle, not only the system setting. */
  var themeBtn = document.getElementById("theme-btn");
  function paintChrome() {
    var dark = root.getAttribute("data-theme") !== "light";
    Array.prototype.forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) { m.setAttribute("content", dark ? "#0f0f13" : "#f5f4f0"); });
  }
  paintChrome();
  function labelTheme() {
    var dark = root.getAttribute("data-theme") !== "light";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  function setTheme(next, x, y) {
    var apply = function () {
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
      labelTheme(); paintChrome();
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
  /* The key cap says what the keyboard actually has */
  var keyCap = document.getElementById("cmd-key");
  if (keyCap) {
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (!/mac|iphone|ipad|ipod/i.test(plat)) keyCap.textContent = "Ctrl K";
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
        s.style.setProperty("--w", 94);
        s.style.setProperty("--wg", 640);
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
            s.style.setProperty("--w", (94 + 6 * k).toFixed(1));
            s.style.setProperty("--wg", Math.round(640 + 120 * k));
          });
        });
      }, { passive: true });
      hero.addEventListener("pointerleave", function () {
        chars.forEach(function (s) { s.style.setProperty("--w", 94); s.style.setProperty("--wg", 640); });
      });
    }
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
      if (clockSub) clockSub.textContent = "Local time, " + wd + ", " + tz;
    };
    tick(); setInterval(tick, 1000);
  }

  /* Standards: each chip opens a popover anchored to itself */
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chips .chip"));
  if (chips.length) {
    var anchorOK = typeof CSS !== "undefined" && CSS.supports && CSS.supports("position-anchor: --a");
    var lastInvoker = null;
    chips.forEach(function (c, idx) {
      c.style.anchorName = "--fw-" + idx;
      c.addEventListener("click", function () { lastInvoker = c; });
    });
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
        if (e.newState === "open" && invoker && !anchorOK) {
          var r = invoker.getBoundingClientRect();
          pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left)) + "px";
          pop.style.top = Math.max(8, r.top - pop.offsetHeight - 10) + "px";
        }
      });
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
    }, { rootMargin: "-30% 0px -55% 0px", threshold: 0 });
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
    { t: "Work", k: "section", run: function () { go("work"); } },
    { t: "Built", k: "section", run: function () { go("built"); } },
    { t: "Path", k: "section", run: function () { go("path"); } },
    { t: "Contact", k: "section", run: function () { go("contact"); } },
    { t: "Settle the field", k: "field", run: function () { fieldAction("field:settle", "Field settled"); } },
    { t: "Run a sweep", k: "field", run: function () { fieldAction("field:sweep", "Sweep running"); } },
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

  /* Tiny toast for confirmations */
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
