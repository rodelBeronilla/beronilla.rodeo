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
    { t: "Projects", k: "section", run: function () { go("projects"); } },
    { t: "Away from the desk", k: "section", run: function () { go("away"); } },
    { t: "Contact", k: "section", run: function () { go("contact"); } },
    { t: "Toggle theme", k: "appearance", run: function () { toggleTheme(); } },
    { t: "Print or save as PDF", k: "page", run: function () { window.print(); } },
    { t: "Copy email address", k: "link", run: function () { copy("rodel.beronilla@gmail.com", "Email address"); } },
    { t: "Email Rodel", k: "link", run: function () { window.location.href = "mailto:rodel.beronilla@gmail.com"; } },
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


  /* The pivot: one record per calendar month since the degree started, regrouped on demand.
     A month keeps its colour when the grouping changes, so a regrouping shows where it went. */
  var plot = document.getElementById("pivot-plot");
  if (plot) {
    var now = new Date();
    var ORGS = [
      { name: "Ontario Tech", kind: "Study", c: 0, from: [2015, 9], to: [2020, 5] },
      { name: "Celestica", kind: "Internship", c: 1, from: [2018, 5], to: [2019, 8] },
      { name: "Rogers", kind: "Employed", c: 2, from: [2020, 7], to: [2024, 10] },
      { name: "TELUS Health", kind: "Employed", c: 3, from: [2024, 11], to: [now.getFullYear(), now.getMonth() + 1] }
    ];
    var MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    function covers(o, y, m) {
      var t = y * 12 + m, lo = o.from[0] * 12 + o.from[1], hi = o.to[0] * 12 + o.to[1];
      return t >= lo && t <= hi;
    }
    /* Every calendar month is exactly one record. Where two things ran at once the month sits with
       the work and carries both colours, so each year still holds twelve dots. */
    var recs = [], y = ORGS[0].from[0], m = ORGS[0].from[1];
    while (y * 12 + m <= now.getFullYear() * 12 + now.getMonth() + 1) {
      var on = ORGS.filter(function (o) { return covers(o, y, m); });
      var lead = on.length ? on[on.length - 1] : null;
      recs.push({
        y: y, m: m,
        org: lead ? lead.name : "Between roles",
        kind: lead ? lead.kind : "Between roles",
        c: lead ? lead.c : null,
        both: on.length > 1
      });
      m++; if (m > 12) { m = 1; y++; }
    }
    var years = [], orgNames = [], kinds = [];
    recs.forEach(function (r) {
      if (years.indexOf(r.y) === -1) years.push(r.y);
      if (orgNames.indexOf(r.org) === -1) orgNames.push(r.org);
      if (kinds.indexOf(r.kind) === -1) kinds.push(r.kind);
    });
    var VIEWS = {
      year: { keys: years, of: function (r) { return r.y; }, cols: 12, slot: function (r) { return r.m - 1; } },
      org: { keys: orgNames, of: function (r) { return r.org; }, cols: 14 },
      kind: { keys: kinds, of: function (r) { return r.kind; }, cols: 14 }
    };
    var total = document.getElementById("pivot-n");
    if (total) total.textContent = String(recs.length);

    var BOX = 16;
    var nodes = recs.map(function (r) {
      var d = document.createElement("i");
      d.className = "dot " + (r.c === null ? "cgap" : "c" + r.c) + (r.both ? " both" : "");
      d.setAttribute("aria-hidden", "true");
      plot.appendChild(d);
      return d;
    });
    var labels = [], view = "year";

    function geom(name) {
      var W = plot.clientWidth || 360;
      var labelW = W < 420 ? 76 : 116;
      var cols = VIEWS[name].cols;
      var pitch = Math.max(9, Math.min(32, (W - labelW) / cols));
      return { W: W, labelW: labelW, cols: cols, pitch: pitch, dot: Math.max(5, pitch * 0.46), gap: pitch * 0.5 };
    }
    /* Lay the grouping out on paper first, then move every dot to where it belongs */
    function plan(name) {
      var v = VIEWS[name], g = geom(name), axis = v.slot ? g.pitch : 0, y0 = axis, out = { g: g, axis: !!v.slot, groups: [], at: [] };
      v.keys.forEach(function (key) {
        var members = [];
        recs.forEach(function (r, i) { if (v.of(r) === key) members.push(i); });
        if (!members.length) return;
        var lines = 1;
        members.forEach(function (idx, n) {
          var slot = v.slot ? v.slot(recs[idx]) : n % g.cols;
          var line = v.slot ? 0 : Math.floor(n / g.cols);
          lines = Math.max(lines, line + 1);
          out.at[idx] = [g.labelW + (slot + 0.5) * g.pitch, y0 + (line + 0.5) * g.pitch];
        });
        out.groups.push({ text: String(key), count: members.length, y: y0 });
        y0 += lines * g.pitch + (v.slot ? 0 : g.gap);
      });
      out.height = y0 + (v.slot ? 0 : -g.gap);
      return out;
    }
    function paint(name, animate) {
      var p = plan(name), g = p.g;
      if (!animate) plot.classList.add("no-anim");
      plot.style.height = Math.round(p.height) + "px";
      labels.forEach(function (el) { el.remove(); });
      labels = [];
      if (p.axis) {
        MONTHS.forEach(function (label, i) {
          var el = document.createElement("div");
          el.className = "maxis";
          el.textContent = label;
          el.style.left = (g.labelW + i * g.pitch) + "px";
          el.style.width = g.pitch + "px";
          plot.appendChild(el);
          labels.push(el);
        });
      }
      p.groups.forEach(function (gr) {
        var el = document.createElement("div");
        el.className = "glabel";
        el.style.top = Math.round(gr.y + g.pitch / 2 - 5) + "px";
        el.appendChild(document.createTextNode(gr.text + " "));
        var c = document.createElement("span");
        c.textContent = String(gr.count);
        el.appendChild(c);
        plot.appendChild(el);
        labels.push(el);
      });
      nodes.forEach(function (d, i) {
        var at = p.at[i], s = (g.dot / BOX).toFixed(3);
        d.style.transitionDelay = animate ? Math.min(i * 1.1, 180) + "ms" : "0ms";
        d.style.transform = "translate(" + (at[0] - BOX / 2).toFixed(1) + "px, " + (at[1] - BOX / 2).toFixed(1) + "px) scale(" + s + ")";
      });
      if (!animate) requestAnimationFrame(function () { plot.classList.remove("no-anim"); });
    }
    paint(view, false);
    requestAnimationFrame(function () { plot.classList.add("is-in"); });

    var buttons = Array.prototype.slice.call(document.querySelectorAll(".pivot-ctrl button"));
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        var next = b.getAttribute("data-view");
        if (next === view) return;
        view = next;
        buttons.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        paint(view, !reduce);
      });
    });
    var reflow = 0;
    window.addEventListener("resize", function () {
      clearTimeout(reflow);
      reflow = setTimeout(function () { paint(view, false); }, 120);
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
