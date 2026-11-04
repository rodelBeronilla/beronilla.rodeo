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

  /* Theme follows the OS. Visitors who once picked a theme by hand go back to following it. */
  var lightMq = window.matchMedia("(prefers-color-scheme: light)");
  function osTheme() { root.setAttribute("data-theme", lightMq.matches ? "light" : "dark"); paintChrome(); }
  function paintChrome() {
    var dark = root.getAttribute("data-theme") !== "light";
    Array.prototype.forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) { m.setAttribute("content", dark ? (a11yOn() ? "#000000" : "#101216") : (a11yOn() ? "#ffffff" : "#f7f7f4")); });
  }
  try { if (localStorage.getItem("theme") !== null) { localStorage.removeItem("theme"); osTheme(); } } catch (e) { /* ignore */ }
  lightMq.addEventListener("change", osTheme);

  /* The accessibility switch: one tap, whole site */
  var a11yBtn = document.getElementById("a11y-btn");
  var a11yAction = { t: "Accessibility mode: off", k: "appearance", run: function () { toggleA11y(); } };
  function syncA11y() {
    var on = a11yOn();
    if (a11yBtn) { a11yBtn.setAttribute("aria-pressed", on ? "true" : "false"); a11yBtn.title = on ? "Switch back to the default version of this site" : "Switch to the accessible version of this site"; }
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
  if (a11yBtn) a11yBtn.addEventListener("click", toggleA11y);
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
    document.addEventListener("a11ychange", function (e) { if (e.detail.on && !unspooled) { unspooled = true; paint(view, false); plot.classList.add("is-in"); } });
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
      if (a.t === "Back to top" || a.k === "link" && a.t.indexOf("Copy") === 0) return;
      var li = document.createElement("li"), b = document.createElement("button"), s = document.createElement("small");
      b.type = "button"; b.textContent = a.t; s.textContent = a.k; b.appendChild(s);
      b.addEventListener("click", function () { closeSheet(); setTimeout(a.run, 60); });
      li.appendChild(b); sheetList.appendChild(li); sheetItems.push({ li: li, t: a.t }); if (a === a11yAction) a11yAction.btn = b;
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
  var mailform = document.querySelector(".mailform"), send = document.getElementById("c-send");
  if (mailform && send) {
    mailform.addEventListener("submit", function () {
      send.textContent = "Sending";
      send.setAttribute("aria-busy", "true");
      send.classList.add("sending");
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
      if (!a11yOn() && howPage.scrollHeight > howPage.clientHeight + 2) tenets.classList.add("fold");
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

  /* Interests: nine things drifting in a field. Click one and the field zooms into it;
     every click after that is one fact deeper, until the bottom. */
  var field = document.getElementById("ifield"), focus = document.getElementById("ifocus");
  if (field && focus) {
    var fname = document.createElement("p"); fname.className = "focus-name";
    var trail = document.createElement("ol"); trail.className = "trail";
    var fact = document.createElement("p"); fact.className = "fact";
    var foot = document.createElement("div"); foot.className = "focus-foot";
    var depthEl = document.createElement("span"); depthEl.className = "depth"; depthEl.setAttribute("aria-hidden", "true");
    var deeper = document.createElement("button"); deeper.type = "button"; deeper.className = "btn primary"; deeper.textContent = "deeper";
    var surface = document.createElement("button"); surface.type = "button"; surface.className = "btn"; surface.textContent = "surface";
    foot.appendChild(depthEl); foot.appendChild(deeper); foot.appendChild(surface);
    focus.appendChild(fname); focus.appendChild(trail); focus.appendChild(fact); focus.appendChild(foot);
    var openNode = null, facts = [], depth = 0, hideTimer = 0;
    function paintDepth() {
      Array.prototype.forEach.call(depthEl.children, function (d, i) { d.classList.toggle("on", i < depth); });
      var bottom = depth >= facts.length;
      deeper.textContent = bottom ? "that\u2019s the bottom" : "deeper";
      deeper.disabled = bottom;
    }
    function showFact(animate) {
      fact.innerHTML = facts[depth].innerHTML;
      fact.classList.toggle("ph", facts[depth].classList.contains("ph"));
      depth++;
      paintDepth();
      if (animate && !reduce && fact.animate) fact.animate([{ opacity: 0, transform: "scale(.7)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: "cubic-bezier(.2,.75,.25,1)" });
    }
    function goDeeper() {
      if (depth >= facts.length) return;
      var li = document.createElement("li"); li.innerHTML = fact.innerHTML; if (fact.classList.contains("ph")) li.className = "ph"; trail.appendChild(li);
      if (!reduce && li.animate) li.animate([{ opacity: 1, transform: "translateY(10px)" }, { opacity: .6, transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.75,.25,1)" });
      showFact(true);
    }
    function zoomIn(node) {
      var top = node.querySelector(".node-top");
      openNode = node;
      facts = Array.prototype.slice.call(node.querySelectorAll(".node-levels > li"));
      depth = 0;
      fname.textContent = node.querySelector(".node-name").textContent;
      trail.innerHTML = "";
      var first = document.createElement("li"); first.textContent = node.querySelector(".node-flavour").textContent; trail.appendChild(first);
      depthEl.innerHTML = "";
      facts.forEach(function () { depthEl.appendChild(document.createElement("i")); });
      node.classList.add("chosen");
      field.classList.add("zoomed"); wrap.classList.add("zoomed");
      field.inert = true;
      top.setAttribute("aria-expanded", "true");
      clearTimeout(hideTimer);
      focus.hidden = false;
      requestAnimationFrame(function () { requestAnimationFrame(function () { focus.classList.add("on"); }); });
      showFact(false);
      deeper.focus({ preventScroll: true });
    }
    function surfaceUp() {
      if (!openNode) return;
      var top = openNode.querySelector(".node-top");
      focus.classList.remove("on");
      field.classList.remove("zoomed"); wrap.classList.remove("zoomed");
      openNode.classList.remove("chosen");
      unlight();
      field.inert = false;
      top.setAttribute("aria-expanded", "false");
      hideTimer = setTimeout(function () { focus.hidden = true; }, reduce ? 0 : 460);
      top.focus({ preventScroll: true });
      openNode = null;
    }
    Array.prototype.forEach.call(field.querySelectorAll(".node:not(.sat)"), function (node) {
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

    /* Rails: the sports chain and the media/games pairs are lines through the dots; satellites hang off their parent */
    var wrap = field.parentNode, svg = document.getElementById("ilinks"), isec = document.getElementById("interests");
    var nodeEls = Array.prototype.slice.call(field.querySelectorAll(".node"));
    nodeEls.forEach(function (el) { var a = document.createElement("i"); a.className = "anchor"; a.setAttribute("aria-hidden", "true"); el.appendChild(a); });
    var V = 0, B = 1, BA = 2, MMA = 3, PH = 4, BG = 5, SH = 6, FILM = 7, W = 8, FS = 9, VT = 10, OS = 11;
    var RAILS = [[V, B], [B, BA], [BA, MMA], [PH, FILM], [BG, SH]];
    var SATS = [[V, VT], [B, FS], [W, OS]];
    var narrowMq = window.matchMedia("(max-width: 56rem)");
    var lines = [];
    function origin(i) { var el = nodeEls[i]; return [el.offsetLeft - (narrowMq.matches ? 0 : el.offsetWidth / 2), el.offsetTop]; }
    function box(i) { var o = origin(i), t = nodeEls[i].querySelector(".node-top"); var l = o[0] + t.offsetLeft, tp = o[1] + t.offsetTop; return { l: l, t: tp, r: l + t.offsetWidth, b: tp + t.offsetHeight, cx: l + t.offsetWidth / 2, cy: tp + t.offsetHeight / 2 }; }
    function dot(i) { var o = origin(i), a = nodeEls[i].querySelector(".anchor"); return [o[0] + a.offsetLeft + a.offsetWidth / 2, o[1] + a.offsetTop + a.offsetHeight / 2]; }
    function segsFor() {
      var out = [];
      if (narrowMq.matches) {
        var a = dot(V), b = dot(MMA), p = dot(PH), q = dot(SH);
        out.push({ x1: a[0], y1: a[1], x2: a[0], y2: b[1], m: [V, B, BA, MMA] });
        out.push({ x1: p[0], y1: p[1], x2: p[0], y2: q[1], m: [PH, FILM, BG, SH] });
        SATS.forEach(function (s) {
          var d = dot(s[0]), sb = box(s[1]);
          out.push({ x1: d[0], y1: d[1], x2: d[0], y2: sb.cy, m: s });
          out.push({ x1: d[0], y1: sb.cy, x2: sb.l - 4, y2: sb.cy, m: s });
        });
      } else {
        RAILS.forEach(function (p) { var a = dot(p[0]), b = dot(p[1]); out.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], m: p }); });
        SATS.forEach(function (s) {
          var pb = box(s[0]), sb = box(s[1]);
          if (s[0] === W) out.push({ x1: pb.r + 2, y1: sb.cy, x2: sb.l - 2, y2: sb.cy, m: s });
          else out.push({ x1: pb.cx, y1: pb.b, x2: pb.cx, y2: sb.t, m: s });
        });
        var bg = box(BG), wd = dot(W);
        out.push({ x1: bg.cx, y1: bg.b + 2, x2: wd[0], y2: wd[1] - 5, m: [BG, W] });
      }
      return out;
    }
    function placeSats() {
      SATS.forEach(function (s) {
        var pb = box(s[0]), el = nodeEls[s[1]];
        if (narrowMq.matches) { el.style.left = ""; el.style.top = ""; return; }
        var st = el.querySelector(".node-top"), sw = st.offsetWidth, sh = st.offsetHeight;
        if (s[0] === W) { el.style.left = (pb.r + 24 + sw / 2) + "px"; el.style.top = (pb.t + (pb.b - pb.t) / 2 - sh / 2 - 6) + "px"; }
        else { el.style.left = pb.cx + "px"; el.style.top = (pb.b + 10) + "px"; }
      });
    }
    function drawLinks() {
      if (!svg) return;
      placeSats();
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      lines = segsFor().map(function (sg) {
        var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", sg.x1.toFixed(1)); l.setAttribute("y1", sg.y1.toFixed(1)); l.setAttribute("x2", sg.x2.toFixed(1)); l.setAttribute("y2", sg.y2.toFixed(1));
        l.setAttribute("data-m", sg.m.join(","));
        l.style.setProperty("--len", Math.hypot(sg.x2 - sg.x1, sg.y2 - sg.y1).toFixed(0));
        svg.appendChild(l);
        return l;
      });
    }
    function members(i) {
      var set = [i];
      RAILS.concat(SATS).forEach(function (p) { if (p[0] === i) set.push(p[1]); if (p[1] === i) set.push(p[0]); });
      return set;
    }
    function light(i) {
      var set = members(i);
      field.classList.add("hl"); wrap.classList.add("hl");
      nodeEls.forEach(function (el, n) { el.classList.toggle("hot", n === i); el.classList.toggle("near", n !== i && set.indexOf(n) !== -1); });
      lines.forEach(function (l) { var m = l.getAttribute("data-m").split(",").map(Number); l.setAttribute("class", m.indexOf(i) !== -1 ? "lit" : ""); });
    }
    function unlight() {
      field.classList.remove("hl"); wrap.classList.remove("hl");
      nodeEls.forEach(function (el) { el.classList.remove("hot", "near"); });
      lines.forEach(function (l) { l.setAttribute("class", ""); });
    }
    nodeEls.forEach(function (el, i) {
      var top = el.querySelector(".node-top");
      top.addEventListener("pointerenter", function () { light(i); });
      top.addEventListener("pointerleave", unlight);
      top.addEventListener("focus", function () { if (top.matches(":focus-visible")) light(i); });
      top.addEventListener("blur", unlight);
    });
    var landTimer = 0;
    function arrive() {
      field.classList.remove("in"); wrap.classList.remove("in");
      requestAnimationFrame(function () {
        drawLinks();
        var order = nodeEls.slice().sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return narrowMq.matches ? ra.top - rb.top : (ra.left - rb.left) || (ra.top - rb.top); });
        order.forEach(function (el, n) { el.style.setProperty("--d", (reduce ? 0 : n * 45) + "ms"); });
        requestAnimationFrame(function () { field.classList.add("in"); wrap.classList.add("in"); });
        clearTimeout(landTimer);
        landTimer = setTimeout(function () { nodeEls.forEach(function (el) { el.style.removeProperty("--d"); }); }, 1300);
      });
    }
    var linkTimer = 0;
    window.addEventListener("resize", function () { clearTimeout(linkTimer); linkTimer = setTimeout(drawLinks, 120); });
    if (isec) isec.addEventListener("viewshow", arrive);
    if (isec && isec.classList.contains("on")) arrive(); else drawLinks();
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
    var creds = Array.prototype.slice.call(stage.querySelectorAll(".cred[data-year]"));
    var active = -1;
    function activate(i) {
      if (i === active || !roles[i]) return;
      var dir = i > active ? 1 : -1, prev = roles[active];
      active = i;
      var end = Number(roles[i].getAttribute("data-end"));
      roles.forEach(function (li, n) { li.classList.toggle("is-active", n === i); });
      segs.forEach(function (s, n) { s.setAttribute("aria-pressed", n === i ? "true" : "false"); });
      if (typeof runEls !== "undefined") { runEls.forEach(function (d) { d.classList.toggle("on", d.getAttribute("data-seg") === String(i)); }); ubars.forEach(function (u, n) { u.classList.toggle("on", n === i); }); }
      creds.forEach(function (el) { el.classList.toggle("pending", Number(el.getAttribute("data-year")) > end); });
      if (xpPrev) xpPrev.disabled = i === 0;
      if (xpNext) xpNext.disabled = i === roles.length - 1;
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
    if (xpPrev) xpPrev.addEventListener("click", function () { xpStep(-1); });
    if (xpNext) xpNext.addEventListener("click", function () { xpStep(1); });
  }
})();
