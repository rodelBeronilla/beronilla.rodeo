(function () {
  "use strict";
  var root = document.documentElement;
  /* Accessibility mode first, before anything paints */
  var a11yPref = null;
  try { a11yPref = localStorage.getItem("a11y"); } catch (e) { /* ignore */ }
  if (a11yPref === "on" || (a11yPref === null && (window.matchMedia("(prefers-contrast: more)").matches || window.matchMedia("(forced-colors: active)").matches))) root.setAttribute("data-a11y", "on");
  function a11yOn() { return root.getAttribute("data-a11y") === "on"; }
  var reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = reduceMq.matches || a11yOn();
  function calcReduce() { reduce = reduceMq.matches || a11yOn(); }
  reduceMq.addEventListener("change", calcReduce);

  /* Theme: Auto follows the OS; Light and Dark are stored and read by the head script */
  var lightMq = window.matchMedia("(prefers-color-scheme: light)");
  function themePref() { try { return localStorage.getItem("theme") || "auto"; } catch (e) { return "auto"; } }
  function osTheme() { root.setAttribute("data-theme", lightMq.matches ? "light" : "dark"); paintChrome(); }
  function paintChrome() {
    var dark = root.getAttribute("data-theme") !== "light";
    Array.prototype.forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) { m.setAttribute("content", dark ? (a11yOn() ? "#0b0c0e" : "#101216") : (a11yOn() ? "#fbfbf8" : "#f7f7f4")); });
  }
  lightMq.addEventListener("change", function () { if (themePref() === "auto") osTheme(); });

  /* Site settings: a stack of pills at the bottom left (cookies, accessibility mode, theme) */
  var ss = document.getElementById("ss"), ssRows = document.getElementById("ss-rows"), ssOpen = document.getElementById("ss-open"), ssOpenChip = document.getElementById("ss-open-chip");
  var ssTheme = document.getElementById("ss-theme"), ssThemeChip = document.getElementById("ss-theme-chip"), ssCookies = document.getElementById("ss-cookies"), ssNote = document.getElementById("ss-note"), ssClear = document.getElementById("ss-clear");
  var a11yInputs = Array.prototype.slice.call(document.querySelectorAll("input[data-a11y-switch]"));
  var EASE = "cubic-bezier(.2,.75,.25,1)";
  var a11yAction = { t: "Accessibility mode: off", k: "appearance", run: function () { toggleA11y(); } };
  var themeAction = { t: "Theme: Auto", k: "appearance", run: function () { cycleTheme(); } };
  var settingsAction = { t: "Site settings", k: "appearance", run: function () { openSS(); } };
  function syncA11y() {
    var on = a11yOn();
    a11yInputs.forEach(function (i) {
      i.checked = on; i.setAttribute("aria-checked", on ? "true" : "false");
      i.parentNode.classList.toggle("is-checked", on);
      var st = i.parentNode.querySelector("[data-a11y-status]"); if (st) st.textContent = on ? "On" : "Off";
    });
    a11yAction.t = "Accessibility mode: " + (on ? "on" : "off");
    if (a11yAction.btn) a11yAction.btn.firstChild.textContent = a11yAction.t;
    paintChrome();
  }
  function toggleA11y() {
    var on = !a11yOn();
    if (on) root.setAttribute("data-a11y", "on"); else root.removeAttribute("data-a11y");
    try { localStorage.setItem("a11y", on ? "on" : "off"); } catch (e) { /* ignore */ }
    calcReduce();
    if (on && document.getAnimations) document.getAnimations().forEach(function (a) { try { a.finish(); } catch (e) { a.cancel(); } });
    syncA11y();
    document.dispatchEvent(new CustomEvent("a11ychange", { detail: { on: on } }));
  }
  function syncTheme() {
    var p = themePref(), label = p === "light" ? "Light" : p === "dark" ? "Dark" : "Auto";
    themeAction.t = "Theme: " + label;
    if (themeAction.btn) themeAction.btn.firstChild.textContent = themeAction.t;
    if (ssTheme) { ssThemeChip.textContent = label; ssTheme.setAttribute("aria-label", "Theme: " + label); ssThemeChip.classList.toggle("set", p !== "auto"); }
  }
  function applyThemePref(p) {
    if (p === "auto") { try { localStorage.removeItem("theme"); } catch (e) { /* ignore */ } osTheme(); }
    else { root.setAttribute("data-theme", p); try { localStorage.setItem("theme", p); } catch (e) { /* ignore */ } paintChrome(); }
    syncTheme();
  }
  function cycleTheme() { var p = themePref(); applyThemePref(p === "auto" ? "light" : p === "light" ? "dark" : "auto"); }
  var ssIsOpen = false;
  function ssItems() { return Array.prototype.slice.call(ssRows.children); }
  function openSS() {
    if (!ss || ssIsOpen) return;
    ssIsOpen = true; ssRows.hidden = false;
    ssOpenChip.textContent = "Close"; ssOpenChip.classList.add("set"); ssOpen.setAttribute("aria-expanded", "true");
    if (!reduce && ssRows.animate) ssItems().slice().reverse().forEach(function (li, i) {
      li.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 160, delay: i * 40, easing: EASE, fill: "backwards" });
    });
    ssRows.querySelector("button, input").focus({ preventScroll: true });
  }
  function closeSS() {
    if (!ss || !ssIsOpen) return;
    ssIsOpen = false; hideNote();
    ssOpenChip.textContent = "Open"; ssOpenChip.classList.remove("set"); ssOpen.setAttribute("aria-expanded", "false");
    if (reduce || !ssRows.animate) { ssRows.hidden = true; return; }
    var last = null;
    ssItems().forEach(function (li, i) { last = li.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px)" }], { duration: 140, delay: i * 40, easing: EASE, fill: "forwards" }); });
    last.onfinish = function () { ssRows.hidden = true; ssItems().forEach(function (li) { li.getAnimations().forEach(function (a) { a.cancel(); }); }); };
  }
  function hideNote() { if (ssNote) { ssNote.hidden = true; ssCookies.setAttribute("aria-expanded", "false"); } }
  if (ss) {
    ssOpen.addEventListener("click", function () { if (ssIsOpen) { closeSS(); ssOpen.focus({ preventScroll: true }); } else openSS(); });
    ssTheme.addEventListener("click", cycleTheme);
    ssCookies.addEventListener("click", function () {
      var show = ssNote.hidden; ssNote.hidden = !show; ssCookies.setAttribute("aria-expanded", show ? "true" : "false");
      if (show && !reduce && ssNote.animate) ssNote.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: EASE });
    });
    ssClear.addEventListener("click", function () {
      try { ["theme", "a11y", "swiped"].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
      if (a11yOn()) toggleA11y();
      osTheme(); syncTheme(); hideNote(); toast("Saved choices cleared");
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ssIsOpen) { closeSS(); ssOpen.focus({ preventScroll: true }); } });
    document.addEventListener("click", function (e) { if (ssIsOpen && !ss.contains(e.target)) closeSS(); });
  }
  a11yInputs.forEach(function (i) { i.addEventListener("change", function () { if (i.checked !== a11yOn()) toggleA11y(); }); });
  syncA11y(); syncTheme();
  paintChrome();
  /* The key cap says what the keyboard actually has */
  var keyCap = document.getElementById("cmd-key");
  if (keyCap) {
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (!/mac|iphone|ipad|ipod/i.test(plat)) keyCap.textContent = "Ctrl K";
  }
  syncA11y();

  /* Views: one section on screen at a time; the nav underline marks it */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".topnav a[href^='#']"));
  var groups = {}, currentId = null, ind = document.querySelector(".nav-ind");
  navLinks.forEach(function (a) { var id = a.getAttribute("href").slice(1); (groups[id] = groups[id] || []).push(a); });
  function placeInd() {
    if (!ind) return;
    var a = currentId && groups[currentId] ? groups[currentId][0] : null;
    if (a) { ind.style.left = a.offsetLeft + "px"; ind.style.width = a.offsetWidth + "px"; }
    ind.classList.toggle("on", !!a);
  }
  function setCurrent(id) {
    if (currentId === id) return;
    if (currentId && groups[currentId]) groups[currentId].forEach(function (a) { a.removeAttribute("aria-current"); });
    currentId = id;
    if (id && groups[id]) groups[id].forEach(function (a) { a.setAttribute("aria-current", "true"); });
    placeInd();
  }
  window.addEventListener("resize", placeInd);
  var views = Array.prototype.slice.call(document.querySelectorAll("main > .page"));
  var viewIds = views.map(function (v) { return v.id; });
  var current = -1, switching = false;
  var xpStep = null, focusOpen = function () { return false; }, firstHow = true, riseWords = null;
  function show(idx, dir) {
    if (idx < 0 || idx >= views.length || idx === current) return;
    var prev = views[current], next = views[idx];
    dir = dir || (idx > current ? 1 : -1);
    current = idx;
    views.forEach(function (v, i) { v.classList.toggle("on", i === idx); });
    if (prev) prev.classList.remove("seen");
    next.scrollTop = 0;
    setCurrent(groups[next.id] ? next.id : null);
    markSwipe(!!prev);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (views[current] !== next) return;
      next.classList.add("seen");
      if (next.id === "how" && firstHow && riseWords) { firstHow = false; riseWords(); }
    }); });
    if (prev && !reduce && next.animate) {
      switching = true;
      next.animate([{ opacity: 0, transform: "translateX(" + (28 * dir) + "px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: "cubic-bezier(.2,.75,.25,1)" }).onfinish = function () { switching = false; };
    }
    next.dispatchEvent(new CustomEvent("viewshow"));
  }
  var swipe = document.getElementById("swipe"), swipeDots = document.getElementById("swipe-dots"), swipeTxt = document.getElementById("swipe-txt"), swipeBtns = [];
  if (swipe && swipeDots) {
    var swiped = false;
    try { swiped = localStorage.getItem("swiped") === "1"; } catch (e) { /* ignore */ }
    views.forEach(function (v, i) {
      var li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-label", v.id === "top" ? "Top" : v.querySelector(".kicker").textContent);
      b.addEventListener("click", function () { go(v.id); });
      li.appendChild(b); swipeDots.appendChild(li); swipeBtns.push(b);
    });
    if (swiped) swipeTxt.hidden = true; else swipe.classList.add("nudge");
  }
  function markSwipe(moved) {
    swipeBtns.forEach(function (b, i) { if (i === current) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
    if (moved && swipeTxt && !swipeTxt.hidden) {
      swipeTxt.hidden = true;
      try { localStorage.setItem("swiped", "1"); } catch (e) { /* ignore */ }
    }
  }
  function idxOf(hash) { var i = viewIds.indexOf((hash || "").replace(/^#/, "")); return i; }
  function go(id) {
    if (location.hash === "#" + id) { show(idxOf(id)); return; }
    location.hash = id;
  }
  function move(dir) {
    var t = current + dir;
    if (t < 0 || t >= views.length) return false;
    go(viewIds[t]);
    return true;
  }
  window.addEventListener("hashchange", function () { var i = idxOf(location.hash); if (i >= 0) show(i); });
  show(Math.max(0, idxOf(location.hash)));
  if (history.replaceState && !location.hash) history.replaceState(null, "", location.pathname);

  /* Command palette */
  var dlg = document.getElementById("cmdk"), input = document.getElementById("cmdk-input"), list = document.getElementById("cmdk-list");
  function copy(text, label) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast(label + " copied"); }, function () { toast("Copy failed"); });
  }
  var actions = [
    { t: "Principles", k: "section", run: function () { go("how"); } },
    { t: "Experience", k: "section", run: function () { go("experience"); } },
    { t: "Projects", k: "section", run: function () { go("projects"); } },
    { t: "Interests", k: "section", run: function () { go("interests"); } },
    { t: "Send a message", k: "section", run: function () { go("contact"); } },
    a11yAction,
    themeAction,
    settingsAction,
    { t: "Print or save as PDF", k: "page", run: function () { window.print(); } },
    { t: "Copy LinkedIn link", k: "link", run: function () { copy("https://ca.linkedin.com/in/rodel-beronilla", "LinkedIn link"); } },
    { t: "Copy GitHub link", k: "link", run: function () { copy("https://github.com/rodelBeronilla", "GitHub link"); } },
    { t: "Open LinkedIn", k: "link", run: function () { window.open("https://ca.linkedin.com/in/rodel-beronilla", "_blank", "noopener"); } },
    { t: "Open GitHub", k: "link", run: function () { window.open("https://github.com/rodelBeronilla", "_blank", "noopener"); } },
    { t: "Back to top", k: "section", run: function () { go("top"); } }
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
  var touch = window.matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !window.matchMedia("(hover: hover)").matches);
  document.addEventListener("a11ychange", function () { if (dlg && dlg.open) filter(); });
  function openCmd() { if (!dlg || dlg.open) return; input.value = ""; filter(); dlg.showModal(); if (touch) input.blur(); else input.focus(); }
  function closeCmd() { if (dlg && dlg.open) dlg.close(); if (canHighlight) CSS.highlights.delete("cmdk-match"); }
  function runSel() { var a = filtered[sel]; closeCmd(); if (a) { setTimeout(a.run, 60); } }
  if (dlg) {
    var opener = document.getElementById("cmd-open");
    if (opener) opener.addEventListener("click", openCmd);
    input.addEventListener("input", filter);
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, filtered.length); render(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + filtered.length) % Math.max(1, filtered.length); render(); }
      else if (e.key === "Enter") { e.preventDefault(); runSel(); }
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) closeCmd(); });
    var closer = document.getElementById("cmdk-close");
    if (closer) closer.addEventListener("click", closeCmd);
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
      { name: "St. Brother Andre CHS", kind: "Study", c: 4, spans: [[[2015, 1], [2015, 6]]] },
      /* the degree is its class terms, September to April; the summers in between were not school */
      { name: "Ontario Tech University", kind: "Study", c: 0, spans: [[[2015, 9], [2016, 4]], [[2016, 9], [2017, 4]], [[2017, 9], [2018, 4]], [[2019, 9], [2020, 4]]] },
      { name: "Walmart Canada", kind: "Part-time work", c: 5, spans: [[[2017, 5], [2018, 4]]] },
      { name: "Celestica International", kind: "Internship", c: 1, spans: [[[2018, 5], [2019, 8]]] },
      { name: "Rogers Communications", kind: "Work", c: 2, spans: [[[2020, 7], [2024, 10]]] },
      { name: "TELUS Health Solutions", kind: "Work", c: 3, spans: [[[2024, 11], [now.getFullYear(), now.getMonth() + 1]]] }
    ];
    var MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    var MNAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function covers(o, y, m) {
      var t = y * 12 + m;
      for (var i = 0; i < o.spans.length; i++) {
        var s = o.spans[i];
        if (t >= s[0][0] * 12 + s[0][1] && t <= s[1][0] * 12 + s[1][1]) return true;
      }
      return false;
    }
    /* Every calendar month is exactly one record. Where two things ran at once the month sits with
       the work and carries both colours, so each year still holds twelve dots. */
    var recs = [], y = ORGS[0].spans[0][0][0], m = ORGS[0].spans[0][0][1];
    while (y * 12 + m <= now.getFullYear() * 12 + now.getMonth() + 1) {
      var on = ORGS.filter(function (o) { return covers(o, y, m); });
      var lead = on.length ? on[on.length - 1] : null;
      recs.push({
        y: y, m: m,
        org: lead ? lead.name : "Between",
        kind: lead ? lead.kind : "Between",
        c: lead ? lead.c : null,
        both: on.length > 1,
        under: on.length > 1 ? on[0].c : -1,
        title: MNAMES[m - 1] + " " + y + ", " + (on.length ? on.map(function (o) { return o.name; }).join(" and ") : "between things")
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
      d.className = "dot " + (r.c === null ? "cgap" : "c" + r.c) + (r.both ? " both b" + r.under : "");
      d.setAttribute("aria-hidden", "true");
      d.title = r.title;
      plot.appendChild(d);
      return d;
    });
    var labels = [], view = "year", cur = [], anims = [];
    function tf(x, y, s) { return "translate(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px) scale(" + s.toFixed(3) + ")"; }
    function readCur(i) {
      var a = anims[i];
      if (a && a.playState === "running") {
        var mm = /matrix\(([^)]+)\)/.exec(getComputedStyle(nodes[i]).transform || "");
        if (mm) { var v = mm[1].split(",").map(Number); return [v[4], v[5], v[0]]; }
      }
      return cur[i];
    }
    /* Each dot flies along a quadratic arc, bending left or right by turn so paths cross,
       and lifts a little at the midpoint. */
    function fly(i, to, opts) {
      var d = nodes[i], from = readCur(i);
      if (anims[i]) { anims[i].cancel(); anims[i] = null; }
      cur[i] = to;
      if (!from || !opts || reduce || typeof d.animate !== "function") { d.style.transform = tf(to[0], to[1], to[2]); return; }
      var dx = to[0] - from[0], dy = to[1] - from[1], dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.5 && Math.abs(to[2] - from[2]) < 0.01) { d.style.transform = tf(to[0], to[1], to[2]); return; }
      var k = 0.22 * (i % 2 ? -1 : 1), cx = (from[0] + to[0]) / 2 - dy * k, cy = (from[1] + to[1]) / 2 + dx * k;
      var frames = [0, 0.25, 0.5, 0.75, 1].map(function (t) {
        var u = 1 - t;
        var x = u * u * from[0] + 2 * u * t * cx + t * t * to[0];
        var y = u * u * from[1] + 2 * u * t * cy + t * t * to[1];
        var s = (from[2] + (to[2] - from[2]) * t) * (1 + 0.18 * Math.sin(Math.PI * t));
        return { transform: tf(x, y, s), offset: t };
      });
      var a = d.animate(frames, { duration: opts.duration, delay: opts.delay || 0, easing: "cubic-bezier(.22,.72,.18,1)", fill: "both" });
      anims[i] = a;
      a.onfinish = function () { d.style.transform = tf(to[0], to[1], to[2]); a.cancel(); if (anims[i] === a) anims[i] = null; };
    }

    function geom(name, cap) {
      var W = plot.clientWidth || 360, small = W < 420, pitch;
      if (VIEWS[name].slot) {
        var labelW = small ? 76 : 116;
        pitch = Math.max(7, Math.min(cap, (W - labelW) / 12));
        return { W: W, labelW: labelW, cols: 12, pitch: pitch, dot: pitch * 0.46, labelH: 0, gap: 0 };
      }
      if (small) {
        pitch = Math.max(7, Math.min(cap, (W - 96) / 18));
        return { W: W, labelW: 96, cols: Math.max(6, Math.floor((W - 96) / pitch)), pitch: pitch, dot: pitch * 0.46, labelH: 0, gap: pitch * 0.5, beside: true };
      }
      var cols = 22;
      pitch = Math.max(7, Math.min(cap, W / cols));
      return { W: W, labelW: 0, cols: cols, pitch: pitch, dot: pitch * 0.46, labelH: 20, gap: pitch * 0.6 };
    }
    /* Lay the grouping out on paper first, then move every dot to where it belongs.
       Grouped by year a row is one year and the label sits beside it; the other groupings
       have names too long for a gutter, so their label sits above a full-width block. */
    function plan(name, cap) {
      var v = VIEWS[name], g = geom(name, cap || 32), side = !!v.slot;
      var y = side ? g.pitch : 0, out = { g: g, axis: side, groups: [], at: [] };
      v.keys.forEach(function (key) {
        var members = [];
        recs.forEach(function (r, i) { if (v.of(r) === key) members.push(i); });
        if (!members.length) return;
        if (side) {
          members.forEach(function (idx) {
            out.at[idx] = [g.labelW + (v.slot(recs[idx]) + 0.5) * g.pitch, y + 0.5 * g.pitch];
          });
          out.groups.push({ text: String(key), count: members.length, top: y + g.pitch / 2 - 5 });
          y += g.pitch;
        } else if (g.beside) {
          out.groups.push({ text: String(key), count: members.length, top: y + g.pitch / 2 - 5, beside: true });
          members.forEach(function (idx, n) {
            out.at[idx] = [g.labelW + (n % g.cols + 0.5) * g.pitch, y + (Math.floor(n / g.cols) + 0.5) * g.pitch];
          });
          y += Math.ceil(members.length / g.cols) * g.pitch + g.gap;
        } else {
          out.groups.push({ text: String(key), count: members.length, top: y });
          y += g.labelH;
          members.forEach(function (idx, n) {
            out.at[idx] = [(n % g.cols + 0.5) * g.pitch, y + (Math.floor(n / g.cols) + 0.5) * g.pitch];
          });
          y += Math.ceil(members.length / g.cols) * g.pitch + g.gap;
        }
      });
      out.height = side ? y : y - g.gap;
      return out;
    }
    var heroPage = document.getElementById("top"), heroGrid = document.querySelector(".hero-grid"), heroInner = document.querySelector(".hero-inner"), fig = document.getElementById("pivot");
    /* The room the plot has: the hero's height less what sits above and beside it */
    function avail() {
      if (!heroPage || !heroPage.clientHeight) return Infinity;
      var cs = getComputedStyle(heroPage), room = heroPage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var pin = heroPage.querySelector(".page-in"); if (pin) { var ps = getComputedStyle(pin); room -= parseFloat(ps.paddingTop) + parseFloat(ps.paddingBottom); }
      room -= fig.offsetHeight - plot.offsetHeight;
      var stacked = heroInner && fig.getBoundingClientRect().top >= heroInner.getBoundingClientRect().bottom - 1;
      if (stacked) room -= heroInner.offsetHeight + (parseFloat(getComputedStyle(heroGrid).rowGap) || 0);
      return Math.max(80, room - 2);
    }
    function tallestAt(cap) {
      var t = { h: 0, pitch: cap };
      Object.keys(VIEWS).forEach(function (k) { var q = plan(k, cap); if (q.height > t.h) { t.h = q.height; t.pitch = q.g.pitch; } });
      return t;
    }
    function paint(name, animate) {
      var cap = 32, t = tallestAt(cap), room = avail(), n = 0;
      while (t.h > room && cap > 7 && n++ < 5) { cap = Math.max(7, Math.floor(t.pitch * room / t.h)); t = tallestAt(cap); }
      var p = plan(name, cap), g = p.g;
      plot.style.height = Math.round(t.h) + "px";
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
        var el = document.createElement("div"), c = document.createElement("span");
        el.className = gr.beside ? "glabel side" : "glabel";
        el.style.top = Math.round(gr.top) + "px";
        c.textContent = String(gr.count);
        if (name === "year" && gr.count === 12 && !gr.beside) { el.textContent = gr.text; plot.appendChild(el); labels.push(el); return; }
        if (gr.beside) { el.title = gr.text + ", " + gr.count; el.appendChild(c); el.appendChild(document.createTextNode(gr.text)); }
        else { el.appendChild(document.createTextNode(gr.text + " ")); el.appendChild(c); }
        plot.appendChild(el);
        labels.push(el);
      });
      nodes.forEach(function (d, i) {
        var at = p.at[i];
        fly(i, [at[0] - BOX / 2, at[1] - BOX / 2, g.dot / BOX], animate ? { duration: 750, delay: Math.min((i % 12) * 14 + Math.floor(i / 12) * 22, 320) } : null);
      });
    }
    paint(view, false);
    /* First sight: every month starts where now is, then the timeline unspools backwards from it */
    var unspooled = reduce || typeof nodes[0].animate !== "function";
    function unspool() {
      unspooled = true;
      paint(view, false);
      var origin = cur[cur.length - 1], targets = cur.slice();
      nodes.forEach(function (d, i) { cur[i] = [origin[0], origin[1], 0]; d.style.transform = tf(origin[0], origin[1], 0); });
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        plot.classList.add("is-in");
        nodes.forEach(function (d, i) { fly(i, targets[i], { duration: 650, delay: (nodes.length - 1 - i) * 8 }); });
      }); });
    }
    if (heroPage) heroPage.addEventListener("viewshow", function () { if (unspooled) paint(view, false); else unspool(); });
    document.addEventListener("a11ychange", function (e) { if (!unspooled) { unspooled = true; plot.classList.add("is-in"); } paint(view, false); });
    if (unspooled) requestAnimationFrame(function () { plot.classList.add("is-in"); });
    else if (heroPage && heroPage.classList.contains("on")) unspool();

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
    (function () {
      var key = document.createElement("ul"); key.className = "pivot-key"; key.setAttribute("aria-label", "Colour key");
      ORGS.forEach(function (o) { var li = document.createElement("li"), sw = document.createElement("i"); sw.className = "sw c" + o.c; li.appendChild(sw); li.appendChild(document.createTextNode(o.name)); key.appendChild(li); });
      var gli = document.createElement("li"), gsw = document.createElement("i"); gsw.className = "sw cgap"; gli.appendChild(gsw); gli.appendChild(document.createTextNode("Between things")); key.appendChild(gli);
      var ctrlEl = document.querySelector(".pivot-ctrl"); if (ctrlEl) ctrlEl.parentNode.insertBefore(key, ctrlEl.nextSibling);
      if (a11yOn()) paint(view, false);
    })();
    var hl = document.getElementById("pivot-hl");
    if (hl && window.matchMedia("(hover: hover)").matches) {
      var tally = {};
      recs.forEach(function (r) {
        var k = r.c === null ? "gap" : "c" + r.c;
        tally[k] = (tally[k] || 0) + 1;
        if (r.both) { tally["c" + r.under] = (tally["c" + r.under] || 0) + 1; }
      });
      var names = { gap: "Between things" };
      ORGS.forEach(function (o) { names["c" + o.c] = o.name; });
      function keyOf(el) {
        var d = el && el.closest ? el.closest(".dot") : null;
        if (!d) return null;
        var m = /(?:^|\s)c(\d)(?:\s|$)/.exec(d.className);
        return m ? "c" + m[1] : "gap";
      }
      plot.addEventListener("pointerover", function (e) {
        var k = keyOf(e.target);
        if (!k) return;
        plot.setAttribute("data-hl", k);
        hl.textContent = names[k] + ", " + tally[k] + (tally[k] === 1 ? " month" : " months");
      });
      plot.addEventListener("pointerout", function (e) {
        if (keyOf(e.relatedTarget)) return;
        plot.removeAttribute("data-hl");
        hl.textContent = "";
      });
    }
    var reflow = 0;
    window.addEventListener("resize", function () {
      clearTimeout(reflow);
      reflow = setTimeout(function () { paint(view, false); }, 120);
    });
  }


  /* Phones: pull the menu down over the page from the top bar, push it back up to close */
  var sheet = document.getElementById("sheet"), sheetList = document.getElementById("sheet-list"), pull = document.getElementById("pull"), topBar = document.querySelector(".top");
  if (sheet && sheetList && topBar) {
    var sheetItems = [];
    actions.forEach(function (a) {
      if (a.t === "Back to top" || a === a11yAction || a.k === "link" && a.t.indexOf("Copy") === 0) return;
      var li = document.createElement("li"), b = document.createElement("button"), s = document.createElement("small");
      b.type = "button"; b.textContent = a.t; s.textContent = a.k; b.appendChild(s);
      b.addEventListener("click", function () { closeSheet(); setTimeout(a.run, 60); });
      li.appendChild(b); sheetList.appendChild(li); sheetItems.push({ li: li, t: a.t }); if (a === a11yAction) a11yAction.btn = b; if (a === themeAction) themeAction.btn = b;
    });
    var sheetOpen = false, pullY = null, pullDy = 0, pushY = null, pushDy = 0;
    function markSheet() {
      var cur = viewIds[current], names = { how: "Principles", experience: "Experience", projects: "Projects", interests: "Interests", contact: "Send a message" };
      sheetItems.forEach(function (it) { it.li.classList.toggle("cur", it.t === names[cur]); });
    }
    function openSheet() {
      sheet.style.transform = ""; sheet.classList.remove("drag"); sheet.classList.add("open");
      sheet.setAttribute("aria-hidden", "false"); sheetOpen = true; markSheet();
      var first = sheetList.querySelector("button"); if (first) first.focus({ preventScroll: true });
    }
    function closeSheet() {
      sheet.style.transform = ""; sheet.classList.remove("drag", "open");
      sheet.setAttribute("aria-hidden", "true"); sheetOpen = false;
    }
    topBar.addEventListener("touchstart", function (e) {
      if (sheetOpen || e.touches.length !== 1 || e.target.closest("button, a")) return;
      pullY = e.touches[0].clientY; pullDy = 0;
    }, { passive: true });
    topBar.addEventListener("touchmove", function (e) {
      if (pullY === null) return;
      pullDy = Math.max(0, e.touches[0].clientY - pullY);
      if (pullDy > 4) { e.preventDefault(); sheet.classList.add("drag"); sheet.style.transform = "translateY(calc(-100% + " + Math.round(pullDy) + "px))"; }
    }, { passive: false });
    topBar.addEventListener("touchend", function () {
      if (pullY === null) return;
      pullY = null;
      if (pullDy > Math.min(140, window.innerHeight * 0.18)) openSheet(); else closeSheet();
    });
    if (pull) pull.addEventListener("click", function () { if (!sheetOpen) openSheet(); });
    sheet.addEventListener("touchstart", function (e) {
      e.stopPropagation();
      if (!sheetOpen || e.touches.length !== 1) return;
      pushY = e.touches[0].clientY; pushDy = 0;
    }, { passive: true });
    sheet.addEventListener("touchmove", function (e) {
      e.stopPropagation();
      if (pushY === null) return;
      pushDy = Math.max(0, pushY - e.touches[0].clientY);
      if (pushDy > 4) { e.preventDefault(); sheet.classList.add("drag"); sheet.style.transform = "translateY(" + (-Math.round(pushDy)) + "px)"; }
    }, { passive: false });
    sheet.addEventListener("touchend", function (e) {
      e.stopPropagation();
      if (pushY === null) return;
      pushY = null;
      if (pushDy > 70) closeSheet(); else if (pushDy > 4) { sheet.classList.remove("drag"); sheet.style.transform = ""; }
    });
    document.getElementById("sheet-close").addEventListener("click", closeSheet);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sheetOpen) closeSheet(); });
  }

  /* Moving between views: arrows, page keys, the wheel past a view's own scroll, and swipes */
  function typing(t) { return t && t.closest && t.closest("input, textarea, select, [contenteditable]"); }
  function busy() { return (dlg && dlg.open) || focusOpen() || (sheet && sheet.classList.contains("open")); }
  function stepOrMove(dir) {
    if (viewIds[current] === "experience" && xpStep && xpStep(dir)) return true;
    return move(dir);
  }
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || busy() || typing(e.target)) return;
    var k = e.key, handled = false;
    if (k === "ArrowRight" || k === "PageDown") handled = move(1);
    else if (k === "ArrowLeft" || k === "PageUp") handled = move(-1);
    else if (k === "ArrowDown") handled = stepOrMove(1);
    else if (k === "ArrowUp") handled = stepOrMove(-1);
    if (handled) e.preventDefault();
  });
  var wheelAt = 0;
  document.addEventListener("wheel", function (e) {
    if (busy() || Math.abs(e.deltaY) < 40 || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    var v = views[current]; if (!v) return;
    var dir = e.deltaY > 0 ? 1 : -1;
    var canScroll = dir > 0 ? v.scrollTop + v.clientHeight < v.scrollHeight - 1 : v.scrollTop > 0;
    if (canScroll) { wheelAt = performance.now(); return; }
    var now = performance.now();
    if (now - wheelAt < 900) return;
    wheelAt = now;
    stepOrMove(dir);
  }, { passive: true });
  var tx = 0, ty = 0, tOn = false;
  document.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1 || busy()) { tOn = false; return; }
    tOn = true; tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (!tOn) return; tOn = false;
    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    move(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* Contact: the message meter and a sending state on the button */
  var msg = document.getElementById("c-msg"), meter = document.getElementById("c-meter"), count = document.getElementById("c-count");
  if (msg && meter && count) {
    var MAX = Number(msg.getAttribute("maxlength")) || 4000;
    var measure = function () {
      var n = msg.value.length;
      meter.style.transform = "scaleX(" + Math.min(1, n / MAX).toFixed(3) + ")";
      count.textContent = n >= MAX - 500 ? n + " / " + MAX : "";
    };
    msg.addEventListener("input", measure);
    measure();
  }
  /* Contact: a small proof of work, solved in the background once someone starts on the form.
     A valid proof lets the relay email the message straight away; without one it waits for the
     hourly digest. Nothing on the form changes, and a failure here never blocks sending. */
  var powHead = (function () {
    var K = new Int32Array([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    var H = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    var W = new Int32Array(64);
    /* The first 32 bits of SHA-256 over an ASCII message of at most 55 bytes (one block). */
    return function (s) {
      var i, len = s.length, a, b, c, d, e, f, g, h, t1, t2, x, y;
      for (i = 0; i < 16; i++) W[i] = 0;
      for (i = 0; i < len; i++) W[i >> 2] |= s.charCodeAt(i) << (24 - (i & 3) * 8);
      W[len >> 2] |= 0x80 << (24 - (len & 3) * 8);
      W[15] = len * 8;
      for (i = 16; i < 64; i++) {
        x = W[i - 15]; y = W[i - 2];
        W[i] = (W[i - 16] + ((x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3)) + W[i - 7] + ((y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ (y >>> 10))) | 0;
      }
      a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (i = 0; i < 64; i++) {
        t1 = (h + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        t2 = (((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      return (a + H[0]) | 0;
    };
  })();
  var mailform = document.querySelector(".mailform"), send = document.getElementById("c-send");
  if (mailform && send) {
    var pow = { state: "idle", ch: null, at: 0, n: 0, waiters: [] };
    var powFresh = function () { return pow.state === "done" && Date.now() - pow.at < 540000; };
    var powSettle = function (state) {
      pow.state = state;
      var w = pow.waiters; pow.waiters = [];
      w.forEach(function (fn) { fn(); });
    };
    var powSolve = function () {
      var prefix = pow.ch.salt + ":", bits = pow.ch.bits, t = performance.now();
      while (performance.now() - t < 10) {
        for (var k = 0; k < 256; k++, pow.n++) {
          if (Math.clz32(powHead(prefix + pow.n)) >= bits) return powSettle("done");
        }
      }
      setTimeout(powSolve, 0);
    };
    var powStart = function () {
      if (pow.state === "fetching" || pow.state === "solving" || powFresh()) return;
      pow.state = "fetching";
      fetch("/contact/challenge", { cache: "no-store", credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error("challenge " + r.status); return r.json(); })
        .then(function (ch) {
          if (!ch || typeof ch.salt !== "string" || ch.salt.length > 48 || !(ch.bits > 0 && ch.bits <= 32)) throw new Error("bad challenge");
          pow.ch = ch; pow.at = Date.now(); pow.n = 0; pow.state = "solving";
          powSolve();
        })
        .catch(function () { powSettle("failed"); });
    };
    var powFields = function () {
      ["salt", "exp", "bits", "sig", "nonce"].forEach(function (k) {
        var input = mailform.querySelector('input[type="hidden"][name="' + k + '"]');
        if (!input) { input = document.createElement("input"); input.type = "hidden"; input.name = k; mailform.appendChild(input); }
        input.value = k === "nonce" ? String(pow.n) : String(pow.ch[k]);
      });
    };
    mailform.addEventListener("focusin", powStart);
    mailform.addEventListener("submit", function (e) {
      send.textContent = "Sending";
      send.setAttribute("aria-busy", "true");
      send.classList.add("sending");
      if (powFresh()) { powFields(); return; }
      /* Not solved yet (or stale): finish inside the sending state, then send. If it fails or
         takes too long, send anyway; the relay holds an unproven message for the digest. */
      e.preventDefault();
      var sent = false;
      var go = function () {
        if (sent) return;
        sent = true;
        if (powFresh()) powFields();
        mailform.submit();
      };
      if (pow.state === "done") pow.state = "idle";
      pow.waiters.push(go);
      powStart();
      setTimeout(go, 8000);
    });
    /* Back from the sent page: the old proof is spent and the button still says Sending */
    window.addEventListener("pageshow", function (e) {
      if (!e.persisted) return;
      pow.state = "idle"; pow.waiters = [];
      send.textContent = "Send"; send.removeAttribute("aria-busy"); send.classList.remove("sending");
    });
  }

  /* Principles: the statement rises a word at a time, once; the text stays one sentence underneath */
  /* Principles: if the four tenets overflow the screen they fold to titles and open one at a time */
  var tenets = document.querySelector(".tenets"), howPage = document.getElementById("how");
  if (tenets && howPage) {
    var tenetItems = Array.prototype.slice.call(tenets.children), fitTimer = 0;
    var fitTenets = function () {
      if (!howPage.classList.contains("on")) return;
      tenets.classList.remove("fold");
      tenetItems.forEach(function (li) { li.classList.remove("open"); });
      if (howPage.scrollHeight > howPage.clientHeight + 2) tenets.classList.add("fold");
    };
    tenetItems.forEach(function (li) {
      li.addEventListener("click", function () {
        if (!tenets.classList.contains("fold")) return;
        var open = li.classList.contains("open");
        tenetItems.forEach(function (o) { o.classList.remove("open"); });
        if (!open) li.classList.add("open");
      });
      li.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && tenets.classList.contains("fold")) { e.preventDefault(); li.click(); } });
    });
    howPage.addEventListener("viewshow", fitTenets);
    document.addEventListener("a11ychange", fitTenets);
    window.addEventListener("resize", function () { clearTimeout(fitTimer); fitTimer = setTimeout(fitTenets, 150); });
    fitTenets();
  }
  riseWords = function () {
    var st = document.querySelector("#how .statement");
    if (!st || reduce || st.classList.contains("rise")) return;
    var words = st.textContent.split(/(\s+)/), n = 0;
    st.textContent = "";
    words.forEach(function (w) {
      if (!w) return;
      if (/^\s+$/.test(w)) { st.appendChild(document.createTextNode(w)); return; }
      var sp = document.createElement("span"); sp.className = "w"; sp.textContent = w;
      sp.style.animationDelay = (n++ * 60) + "ms";
      st.appendChild(sp);
    });
    st.classList.add("rise");
  };
  if (views[current] && views[current].id === "how") { firstHow = false; riseWords(); }

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

  /* Interests: four areas set as one index. Choosing an item keeps its column,
     clears the other three and opens the fact in the space they leave. */
  var field = document.getElementById("ifield"), focus = document.getElementById("ifocus");
  if (field && focus) {
    var EZ = "cubic-bezier(.2,.75,.25,1)";
    var trail = document.createElement("ol"); trail.className = "trail";
    var fact = document.createElement("p"); fact.className = "fact";
    var foot = document.createElement("div"); foot.className = "focus-foot";
    var deeper = document.createElement("button"); deeper.type = "button"; deeper.className = "btn"; deeper.textContent = "Deeper";
    var surface = document.createElement("button"); surface.type = "button"; surface.className = "btn ghost"; surface.textContent = "Surface";
    foot.appendChild(deeper); foot.appendChild(surface);
    focus.appendChild(trail); focus.appendChild(fact); focus.appendChild(foot);

    var wrap = field.parentNode, isec = document.getElementById("interests");
    var cats = Array.prototype.slice.call(field.querySelectorAll(".cat"));
    var nodeEls = Array.prototype.slice.call(field.querySelectorAll(".node"));
    var catOf = nodeEls.map(function (el) { return cats.indexOf(el.closest(".cat")); });
    var narrowMq = window.matchMedia("(max-width: 56rem)");
    var openNode = null, facts = [], depth = 0, hideTimer = 0;

    function paintDepth() {
      var bottom = depth >= facts.length;
      if (!deeper.hidden) { deeper.textContent = bottom ? "That\u2019s the bottom" : "Deeper"; deeper.disabled = bottom; }
    }
    function showFact(animate) {
      fact.innerHTML = facts[depth].innerHTML;
      depth++;
      paintDepth();
      if (animate && !reduce && fact.animate) fact.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: EZ });
    }
    function goDeeper() {
      if (depth >= facts.length) return;
      var li = document.createElement("li"); li.innerHTML = fact.innerHTML; trail.appendChild(li);
      if (!reduce && li.animate) li.animate([{ opacity: 1, transform: "translateY(6px)" }, { opacity: .55, transform: "none" }], { duration: 320, easing: EZ });
      showFact(true);
    }
    /* the chosen column slides to the grid's left edge and the card takes the space the others leave */
    function reflow(ci) {
      var wide = !narrowMq.matches, fr = field.getBoundingClientRect();
      cats.forEach(function (cat, c) {
        cat.classList.toggle("held", c === ci);
        cat.style.removeProperty("--tx"); cat.style.removeProperty("--fd");
        if (c === ci) { if (wide && !reduce) cat.style.setProperty("--tx", (fr.left - cat.getBoundingClientRect().left).toFixed(1) + "px"); return; }
        cat.style.setProperty("--fd", ((Math.abs(c - ci) - 1) * 40) + "ms");
        if (wide && !reduce) cat.style.setProperty("--tx", (c < ci ? -18 : 18) + "px");
      });
      if (!wide || !cats[1] || !openNode) { focus.style.removeProperty("--cardx"); focus.style.removeProperty("--cardy"); return; }
      focus.style.setProperty("--cardx", (cats[1].getBoundingClientRect().left - fr.left).toFixed(1) + "px");
      /* the card hangs from the live item, pulled up only when it would outrun the column */
      focus.style.setProperty("--cardy", "0px");
      var top = openNode.getBoundingClientRect().top - fr.top;
      focus.style.setProperty("--cardy", Math.max(0, Math.min(top, fr.height - focus.getBoundingClientRect().height)).toFixed(1) + "px");
    }
    function zoomIn(node) {
      var top = node.querySelector(".node-top"), i = nodeEls.indexOf(node);
      openNode = node;
      facts = Array.prototype.slice.call(node.querySelectorAll(".node-levels > li"));
      depth = 0;
      trail.innerHTML = "";
      nodeEls.forEach(function (el) { el.classList.remove("live"); });
      node.classList.add("live");
      deeper.hidden = facts.length < 2;
      deeper.disabled = false;
      field.inert = true;
      top.setAttribute("aria-expanded", "true");
      clearTimeout(hideTimer);
      focus.hidden = false;
      showFact(false);
      reflow(catOf[i]);
      field.classList.add("zoomed"); wrap.classList.add("zoomed");
      requestAnimationFrame(function () { requestAnimationFrame(function () { focus.classList.add("on"); }); });
      (deeper.hidden ? surface : deeper).focus({ preventScroll: true });
    }
    function surfaceUp() {
      if (!openNode) return;
      var node = openNode, top = node.querySelector(".node-top");
      openNode = null;
      focus.classList.remove("on");
      field.classList.remove("zoomed"); wrap.classList.remove("zoomed");
      node.classList.remove("live");
      cats.forEach(function (cat) { cat.classList.remove("held"); cat.style.removeProperty("--tx"); cat.style.removeProperty("--fd"); });
      field.inert = false;
      top.setAttribute("aria-expanded", "false");
      hideTimer = setTimeout(function () { if (!openNode) focus.hidden = true; }, reduce ? 0 : 440);
      top.focus({ preventScroll: true });
    }
    nodeEls.forEach(function (node) {
      node.querySelector(".node-top").addEventListener("click", function () { zoomIn(node); });
    });
    deeper.addEventListener("click", goDeeper);
    surface.addEventListener("click", surfaceUp);
    focus.addEventListener("click", function (e) {
      if (e.target.closest("a, button")) return;
      goDeeper();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openNode && !(dlg && dlg.open)) surfaceUp(); });
    focusOpen = function () { return !!openNode; };

    /* arrival: area by area, the rule draws, the label fades, the items land */
    var landTimer = 0;
    function arrive() {
      field.classList.remove("in");
      requestAnimationFrame(function () {
        cats.forEach(function (cat, c) {
          var base = reduce ? 0 : c * 90;
          cat.style.setProperty("--rd", base + "ms");
          Array.prototype.forEach.call(cat.querySelectorAll(".node"), function (el, k) {
            el.style.setProperty("--d", (reduce ? 0 : base + 150 + k * 50) + "ms");
          });
        });
        requestAnimationFrame(function () { field.classList.add("in"); });
        clearTimeout(landTimer);
        landTimer = setTimeout(function () {
          nodeEls.forEach(function (el) { el.style.removeProperty("--d"); });
          cats.forEach(function (cat) { cat.style.removeProperty("--rd"); });
        }, 1400);
      });
    }
    var reTimer = 0;
    function reReflow() { if (openNode) reflow(catOf[nodeEls.indexOf(openNode)]); }
    window.addEventListener("resize", function () { clearTimeout(reTimer); reTimer = setTimeout(reReflow, 120); });
    document.addEventListener("a11ychange", function () { requestAnimationFrame(reReflow); });
    if (isec) isec.addEventListener("viewshow", arrive);
    if (isec && isec.classList.contains("on")) arrive();
  }

  /* Projects: pointing at a tag underlines the same tag on every card; a tap pins it */
  var built = document.querySelector(".built");
  if (built) {
    var tags = Array.prototype.slice.call(built.querySelectorAll(".skills li")), pinned = null;
    var tagKey = function (li) { return li.textContent.trim().toLowerCase(); };
    var lightTag = function (k) { tags.forEach(function (li) { li.classList.toggle("lit", !!k && tagKey(li) === k); }); };
    tags.forEach(function (li) {
      li.addEventListener("pointerenter", function () { if (!pinned) lightTag(tagKey(li)); });
      li.addEventListener("pointerleave", function () { if (!pinned) lightTag(null); });
      li.addEventListener("click", function (e) { e.stopPropagation(); pinned = pinned === tagKey(li) ? null : tagKey(li); lightTag(pinned); });
    });
    document.addEventListener("click", function () { if (pinned) { pinned = null; lightTag(null); } });
  }

  /* Experience: a band of every month since 2015, the four roles as segments on it, one card at a time */
  var stage = document.getElementById("experience");
  if (stage) {
    var roles = Array.prototype.slice.call(stage.querySelectorAll(".xp-roles > li"));
    var band = document.getElementById("band"), bandYears = document.getElementById("band-years"), bandUnder = document.getElementById("band-under"), bandHl = document.getElementById("band-hl");
    var xpPrev = document.getElementById("xp-prev"), xpNext = document.getElementById("xp-next"), xpPos = document.getElementById("xp-pos");
    var segs = [], cells = [], segOf = [];
    if (band && typeof recs !== "undefined" && recs.length) {
      var base = recs[0].y * 12 + recs[0].m, N = recs.length;
      function idx(ym) { if (ym === "now") return N - 1; var p = ym.split("-"); return Number(p[0]) * 12 + Number(p[1]) - base; }
      function pct(i) { return (100 * i / N).toFixed(3) + "%"; }
      roles.forEach(function (li, n) {
        var a = idx(li.getAttribute("data-from")), b = idx(li.getAttribute("data-to"));
        for (var k = a; k <= b; k++) segOf[k] = n;
        var s = document.createElement("button");
        s.type = "button"; s.className = "seg"; s.setAttribute("data-i", String(n));
        s.setAttribute("aria-label", li.querySelector("h3").textContent + ", " + li.querySelector(".tl-role").textContent);
        s.style.left = pct(a); s.style.width = pct(b - a + 1);
        s.addEventListener("click", function () { activate(n); });
        s.addEventListener("pointerenter", function () { if (bandHl) bandHl.textContent = li.querySelector("h3").textContent + ", " + li.querySelector(".tl-role").textContent; runEls.forEach(function (d) { d.classList.toggle("hov", d.getAttribute("data-seg") === String(n)); }); });
        s.addEventListener("pointerleave", function () { if (bandHl) bandHl.textContent = ""; runEls.forEach(function (d) { d.classList.remove("hov"); }); });
        s.addEventListener("focus", function () { if (bandHl) bandHl.textContent = li.querySelector("h3").textContent + ", " + li.querySelector(".tl-role").textContent; });
        s.addEventListener("blur", function () { if (bandHl) bandHl.textContent = ""; });
        segs.push(s);
      });
      recs.forEach(function (r, i) {
        var d = document.createElement("i");
        d.className = "cell";
        d.style.left = pct(i); d.style.width = pct(1);
        d.title = r.title;
        band.appendChild(d); cells.push(d);
      });
      var runs = [], ri = 0, runEls = [], ubars = [];
      recs.forEach(function (r, i) {
        var key = [r.c, r.both ? r.under : -1, segOf[i] === undefined ? -1 : segOf[i]].join("/");
        var last = runs[runs.length - 1];
        if (last && last.key === key) { last.n++; return; }
        runs.push({ key: key, start: i, n: 1, c: r.c, both: r.both, under: r.under, seg: segOf[i] });
      });
      runs.forEach(function (ru) {
        var d = document.createElement("i");
        d.className = "run " + (ru.c === null ? "cgap" : "c" + ru.c) + (ru.both ? " both b" + ru.under : "");
        d.style.left = "calc(" + pct(ru.start) + " + 1px)"; d.style.width = "calc(" + pct(ru.n) + " - 2px)";
        d.style.setProperty("--i", String(ri++));
        d.setAttribute("data-seg", ru.seg === undefined ? "" : String(ru.seg));
        if (ru.c !== null && ru.n >= 10) { var org = ORGS.filter(function (o) { return o.c === ru.c; })[0]; if (org) { var lab = document.createElement("b"); lab.className = "run-lab"; lab.textContent = org.name.split(" ")[0]; d.appendChild(lab); } }
        band.appendChild(d); runEls.push(d);
      });
      roles.forEach(function (li, n) {
        var a = idx(li.getAttribute("data-from")), b = idx(li.getAttribute("data-to"));
        var u = document.createElement("i"); u.className = "ubar sc" + recs[a].c; u.style.left = "calc(" + pct(a) + " + 1px)"; u.style.width = "calc(" + pct(b - a + 1) + " - 2px)";
        band.appendChild(u); ubars.push(u);
      });
      segs.forEach(function (s) { band.appendChild(s); });
      if (bandYears) recs.forEach(function (r, i) {
        if (r.m !== 1) return;
        var t = document.createElement("span"); t.textContent = String(r.y); t.style.left = pct(i + 0.5); bandYears.appendChild(t);
      });
      if (bandUnder) {
        var dl = document.createElement("i"); dl.className = "deg cred"; dl.setAttribute("data-year", "2020");
        var d0 = idx("2015-09"), d1 = idx("2020-04");
        dl.style.left = pct(d0); dl.style.width = pct(d1 - d0 + 1);
        var dlab = document.createElement("span"); dlab.className = "deg-lab cred"; dlab.setAttribute("data-year", "2020"); dlab.textContent = "Ontario Tech University"; dlab.style.left = pct(d0);
        var dlong = document.createElement("span"); dlong.className = "long"; dlong.textContent = ", 2015 to 2020"; dlab.appendChild(dlong);
        bandUnder.appendChild(dl); bandUnder.appendChild(dlab);
        [["2026-10", "SQL (Advanced)"], ["2026-11", "CISSP"]].forEach(function (m) {
          var k = idx(m[0]); if (k < 0 || k >= N) return;
          var mk = document.createElement("i"); mk.className = "mk cred"; mk.setAttribute("data-year", m[0].slice(0, 4)); mk.style.left = pct(k + 0.5); bandUnder.appendChild(mk);
        });
        var ml = document.createElement("span"); ml.className = "mk-lab cred"; ml.setAttribute("data-year", "2026"); ml.textContent = "SQL (Advanced) and CISSP"; bandUnder.appendChild(ml);
        var mlong = document.createElement("span"); mlong.className = "long"; mlong.textContent = ", late 2026"; ml.appendChild(mlong);
      }
    }
    var creds = Array.prototype.slice.call(stage.querySelectorAll(".xp-side li.cred[data-date]"));
    var active = -1;
    function activate(i) {
      if (i === active || !roles[i]) return;
      var dir = i > active ? 1 : -1, prev = roles[active];
      active = i;
      var from = roles[i].getAttribute("data-from"), to = roles[i].getAttribute("data-to");
      roles.forEach(function (li, n) { li.classList.toggle("is-active", n === i); });
      segs.forEach(function (s, n) { s.setAttribute("aria-pressed", n === i ? "true" : "false"); });
      if (typeof runEls !== "undefined") { runEls.forEach(function (d) { d.classList.toggle("on", d.getAttribute("data-seg") === String(i)); }); ubars.forEach(function (u, n) { u.classList.toggle("on", n === i); }); }
      creds.forEach(function (el) { var d = el.getAttribute("data-date"); el.classList.toggle("earned", d >= from && (to === "now" || d <= to)); });
      if (xpPrev) xpPrev.disabled = i === roles.length - 1;
      if (xpNext) xpNext.disabled = i === 0;
      if (xpPos) xpPos.textContent = (i + 1) + " of " + roles.length;
      if (reduce || !roles[i].animate) { if (prev) prev.classList.remove("leaving"); return; }
      if (prev) {
        prev.classList.add("leaving");
        var out = prev.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(" + (-24 * dir) + "px)" }], { duration: 300, easing: "cubic-bezier(.2,.75,.25,1)", fill: "forwards" });
        out.onfinish = function () { prev.classList.remove("leaving"); out.cancel(); };
      }
      roles[i].animate([{ opacity: 0, transform: "translateY(" + (24 * dir) + "px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: prev ? 120 : 0, easing: "cubic-bezier(.2,.75,.25,1)", fill: "backwards" });
    }
    activate(0);
    var drawn = false;
    function drawBand() {
      if (drawn || !band) return;
      drawn = true;
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        band.classList.add("in");
        setTimeout(function () { band.classList.add("settled"); }, reduce ? 0 : 1500);
        if (!reduce && segs[active] && segs[active].animate) setTimeout(function () {
          segs[active].animate([{ boxShadow: "0 0 0 0 var(--accent)" }, { boxShadow: "0 0 0 10px transparent" }], { duration: 700, easing: "ease-out" });
        }, 650);
      }); });
    }
    stage.addEventListener("viewshow", drawBand);
    if (stage.classList.contains("on")) drawBand();
    xpStep = function (dir) {
      var t = active + dir;
      if (t < 0 || t >= roles.length) return false;
      activate(t);
      return true;
    };
    if (xpPrev) xpPrev.addEventListener("click", function () { xpStep(1); });
    if (xpNext) xpNext.addEventListener("click", function () { xpStep(-1); });
    var heroXp = document.querySelector(".hero .cta a[href=\"#experience\"]");
    if (heroXp) heroXp.addEventListener("click", function () { activate(0); });
  }
})();
