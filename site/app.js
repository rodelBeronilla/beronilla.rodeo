(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function buzz(ms) { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }

  /* Theme: instant swap; the browser chrome follows the toggle */
  var themeBtn = document.getElementById("theme-btn");
  function paintChrome() {
    var dark = root.getAttribute("data-theme") !== "light";
    Array.prototype.forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) { m.setAttribute("content", dark ? "#101216" : "#f7f7f4"); });
  }
  function labelTheme() {
    var dark = root.getAttribute("data-theme") !== "light";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  function toggleTheme() {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
    labelTheme(); paintChrome();
  }
  paintChrome();
  /* The key cap says what the keyboard actually has */
  var keyCap = document.getElementById("cmd-key");
  if (keyCap) {
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (!/mac|iphone|ipad|ipod/i.test(plat)) keyCap.textContent = "Ctrl K";
  }
  if (themeBtn) { labelTheme(); themeBtn.addEventListener("click", toggleTheme); }

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
  var actions = [
    { t: "How I work", k: "section", run: function () { go("how"); } },
    { t: "Experience", k: "section", run: function () { go("experience"); } },
    { t: "Built", k: "section", run: function () { go("built"); } },
    { t: "Off the clock", k: "section", run: function () { go("life"); } },
    { t: "Contact", k: "section", run: function () { go("contact"); } },
    { t: "Group the months by year", k: "page", run: function () { var b = document.querySelector('.pivot-ctrl button[data-view="year"]'); window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); if (b) b.click(); } },
    { t: "Toggle theme", k: "appearance", run: function () { toggleTheme(); } },
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
  function runSel() { var a = filtered[sel]; closeCmd(); if (a) { setTimeout(a.run, 60); } }
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

  /* Measured, not claimed: what this page cost to load */
  var live = document.getElementById("colophon-live");
  try {
    var nav = performance.getEntriesByType("navigation")[0];
    if (live && nav && nav.transferSize) {
      window.addEventListener("load", function () {
        var n = performance.getEntriesByType("navigation")[0];
        var bytes = performance.getEntriesByType("resource").reduce(function (t, r) { return t + (r.transferSize || 0); }, n.transferSize || 0);
        live.textContent = (bytes / 1024).toFixed(1) + " KB over the wire, DOM ready in " + Math.round(n.domContentLoadedEventEnd) + " ms.";
      });
    }
  } catch (e) { /* keep the static text */ }


  /* The pivot: every month of study or work is one record, regrouped on demand.
     A dot holds its colour across groupings, so a regrouping shows where the months came from. */
  var plot = document.getElementById("pivot-plot");
  if (plot) {
    var now = new Date();
    var SPANS = [
      { org: "Ontario Tech", kind: "Study", c: 0, from: [2015, 9], to: [2020, 5] },
      { org: "Celestica", kind: "Internship", c: 1, from: [2018, 5], to: [2019, 8] },
      { org: "Rogers", kind: "Employed", c: 2, from: [2020, 7], to: [2024, 10] },
      { org: "TELUS Health", kind: "Employed", c: 3, from: [2024, 11], to: [now.getFullYear(), now.getMonth() + 1] }
    ];
    var recs = [];
    SPANS.forEach(function (s) {
      var y = s.from[0], m = s.from[1];
      while (y < s.to[0] || (y === s.to[0] && m <= s.to[1])) {
        recs.push({ org: s.org, kind: s.kind, c: s.c, y: y });
        m++; if (m > 12) { m = 1; y++; }
      }
    });
    var years = [];
    recs.forEach(function (r) { if (years.indexOf(r.y) === -1) years.push(r.y); });
    years.sort(function (a, b) { return a - b; });
    var VIEWS = {
      org: { keys: SPANS.map(function (s) { return s.org; }), of: function (r) { return r.org; } },
      year: { keys: years, of: function (r) { return r.y; } },
      kind: { keys: ["Study", "Internship", "Employed"], of: function (r) { return r.kind; } }
    };
    var total = document.getElementById("pivot-n");
    if (total) total.textContent = String(recs.length);

    var nodes = recs.map(function (r) {
      var d = document.createElement("i");
      d.className = "dot c" + r.c;
      d.setAttribute("aria-hidden", "true");
      plot.appendChild(d);
      return d;
    });
    var labelLayer = [];
    var view = "org", W = 0, metrics = null;

    function measure() {
      W = plot.clientWidth || 360;
      var small = W < 400;
      var m = { size: small ? 6 : 7, pitch: small ? 10 : 13, labelW: small ? 92 : 120, gap: small ? 9 : 11 };
      m.perLine = Math.max(1, Math.floor((W - m.labelW) / m.pitch));
      metrics = m;
      nodes.forEach(function (d) { d.style.width = m.size + "px"; d.style.height = m.size + "px"; });
    }
    /* Lay a grouping out on paper first: the plot keeps the tallest view's height so nothing jumps */
    function plan(name) {
      var v = VIEWS[name], m = metrics, y = 0, out = { groups: [], at: [] };
      v.keys.forEach(function (key) {
        var members = [];
        recs.forEach(function (r, i) { if (v.of(r) === key) members.push(i); });
        if (!members.length) return;
        out.groups.push({ text: String(key), count: members.length, y: y });
        members.forEach(function (idx, n) {
          out.at[idx] = [m.labelW + (n % m.perLine) * m.pitch, y + Math.floor(n / m.perLine) * m.pitch];
        });
        y += Math.ceil(members.length / m.perLine) * m.pitch + m.gap;
      });
      out.height = Math.max(0, y - m.gap) + m.size;
      return out;
    }
    function paint(name, animate) {
      var p = plan(name);
      if (!animate) plot.classList.add("no-anim");
      plot.style.height = p.height + "px";
      labelLayer.forEach(function (el) { el.remove(); });
      labelLayer = p.groups.map(function (g) {
        var el = document.createElement("div");
        el.className = "glabel";
        el.style.top = (g.y + Math.round(metrics.size / 2) - 5) + "px";
        el.appendChild(document.createTextNode(g.text + " "));
        var c = document.createElement("span");
        c.textContent = String(g.count);
        el.appendChild(c);
        plot.appendChild(el);
        return el;
      });
      nodes.forEach(function (d, i) {
        var at = p.at[i];
        d.style.transitionDelay = animate ? Math.min(i * 1.1, 180) + "ms" : "0ms";
        d.style.transform = "translate(" + at[0] + "px, " + at[1] + "px)";
      });
      if (!animate) requestAnimationFrame(function () { plot.classList.remove("no-anim"); });
    }
    function fit() { measure(); }
    fit();
    paint(view, false);
    requestAnimationFrame(function () { plot.classList.add("is-in"); });

    Array.prototype.forEach.call(document.querySelectorAll(".pivot-ctrl button"), function (b) {
      b.addEventListener("click", function () {
        var next = b.getAttribute("data-view");
        if (next === view) return;
        view = next;
        Array.prototype.forEach.call(document.querySelectorAll(".pivot-ctrl button"), function (o) {
          o.setAttribute("aria-pressed", o === b ? "true" : "false");
        });
        paint(view, !reduce);
      });
    });
    var fitRaf = 0;
    window.addEventListener("resize", function () {
      clearTimeout(fitRaf);
      fitRaf = setTimeout(function () { fit(); paint(view, false); }, 120);
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
