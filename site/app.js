(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* Theme, with a circular reveal through the View Transitions API */
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

  /* Marquee: duplicate content for a seamless loop */
  var mq = document.getElementById("marquee");
  if (mq && !reduce) mq.innerHTML += mq.innerHTML;

  /* Tiles: tilt and light sweep follow the pointer on desktop */
  if (fine && !reduce) {
    Array.prototype.slice.call(document.querySelectorAll(".tile")).forEach(function (t) {
      t.addEventListener("pointermove", function (e) {
        var r = t.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        t.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
        t.style.setProperty("--my", (y * 100).toFixed(1) + "%");
        t.style.setProperty("--rx", ((0.5 - y) * 5).toFixed(2) + "deg");
        t.style.setProperty("--ry", ((x - 0.5) * 5).toFixed(2) + "deg");
      }, { passive: true });
      t.addEventListener("pointerleave", function () { t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg"); });
    });
  }

  /* Command palette */
  var dlg = document.getElementById("cmdk"), input = document.getElementById("cmdk-input"), list = document.getElementById("cmdk-list");
  function go(id) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }
  function copy(text, label) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast(label + " copied"); }, function () { toast("Copy failed"); });
  }
  var actions = [
    { t: "About", k: "section", run: function () { go("about"); } },
    { t: "Work and expertise", k: "section", run: function () { go("work"); } },
    { t: "Projects", k: "section", run: function () { go("projects"); } },
    { t: "Contact", k: "section", run: function () { go("contact"); } },
    { t: "Toggle theme", k: "appearance", run: function () { toggleTheme(innerWidth - 40, 40); } },
    { t: "Copy LinkedIn link", k: "link", run: function () { copy("https://ca.linkedin.com/in/rodel-beronilla", "LinkedIn link"); } },
    { t: "Copy GitHub link", k: "link", run: function () { copy("https://github.com/rodelBeronilla", "GitHub link"); } },
    { t: "Open LinkedIn", k: "link", run: function () { window.open("https://ca.linkedin.com/in/rodel-beronilla", "_blank", "noopener"); } },
    { t: "Open GitHub", k: "link", run: function () { window.open("https://github.com/rodelBeronilla", "_blank", "noopener"); } },
    { t: "Back to top", k: "section", run: function () { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); } }
  ];
  var filtered = actions.slice(), sel = 0;
  function render() {
    list.innerHTML = "";
    if (!filtered.length) {
      var li = document.createElement("li"); li.className = "empty"; li.textContent = "No matches"; list.appendChild(li); return;
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
  }
  function filter() {
    var v = input.value.trim().toLowerCase();
    filtered = v ? actions.filter(function (a) { return (a.t + " " + a.k).toLowerCase().indexOf(v) !== -1; }) : actions.slice();
    sel = 0; render();
  }
  function openCmd() { if (!dlg || dlg.open) return; input.value = ""; filter(); dlg.showModal(); input.focus(); }
  function closeCmd() { if (dlg && dlg.open) dlg.close(); }
  function runSel() { var a = filtered[sel]; closeCmd(); if (a) setTimeout(a.run, 60); }
  if (dlg) {
    document.getElementById("cmd-open").addEventListener("click", openCmd);
    document.getElementById("fab").addEventListener("click", openCmd);
    input.addEventListener("input", filter);
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, filtered.length); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + filtered.length) % Math.max(1, filtered.length); render(); }
      else if (e.key === "Enter") { e.preventDefault(); runSel(); }
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) closeCmd(); });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg.open ? closeCmd() : openCmd(); }
    });
  }

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
