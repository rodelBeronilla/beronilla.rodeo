(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  function applyTheme() {
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
    labelTheme(); paintChrome();
  }
  function toggleTheme() {
    if (reduce || typeof document.startViewTransition !== "function") { applyTheme(); return; }
    var r = themeBtn ? themeBtn.getBoundingClientRect() : null;
    root.style.setProperty("--vt-x", r ? Math.round(r.left + r.width / 2) + "px" : "50%");
    root.style.setProperty("--vt-y", r ? Math.round(r.top + r.height / 2) + "px" : "50%");
    document.startViewTransition(applyTheme);
  }
  paintChrome();
  /* The key cap says what the keyboard actually has */
  var keyCap = document.getElementById("cmd-key");
  if (keyCap) {
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (!/mac|iphone|ipad|ipod/i.test(plat)) keyCap.textContent = "Ctrl K";
  }
  if (themeBtn) { labelTheme(); themeBtn.addEventListener("click", toggleTheme); }

  /* Section in view: underline in the top nav */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".topnav a[href^='#']"));
  if (navLinks.length && "IntersectionObserver" in window) {
    var groups = {};
    navLinks.forEach(function (a) { var id = a.getAttribute("href").slice(1); (groups[id] = groups[id] || []).push(a); });
    var currentId = null, ind = document.querySelector(".nav-ind");
    var placeInd = function () {
      if (!ind) return;
      var a = currentId ? groups[currentId][0] : null;
      if (a) { ind.style.left = a.offsetLeft + "px"; ind.style.width = a.offsetWidth + "px"; }
      ind.classList.toggle("on", !!a);
    };
    var setCurrent = function (id) {
      if (currentId === id) return;
      if (currentId) groups[currentId].forEach(function (a) { a.removeAttribute("aria-current"); });
      currentId = id;
      if (id) groups[id].forEach(function (a) { a.setAttribute("aria-current", "true"); });
      placeInd();
    };
    window.addEventListener("resize", placeInd);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting && groups[en.target.id]) setCurrent(en.target.id); });
    }, { rootMargin: "-30% 0px -55% 0px", threshold: 0 });
    Object.keys(groups).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
    var top = document.getElementById("top");
    if (top) new IntersectionObserver(function (en) { if (en[0].isIntersecting) setCurrent(null); }, { rootMargin: "-60% 0px 0px 0px" }).observe(top);
  }

  /* Command palette */
  var dlg = document.getElementById("cmdk"), input = document.getElementById("cmdk-input"), list = document.getElementById("cmdk-list");
  function go(id) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }
  function copy(text, label) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast(label + " copied"); }, function () { toast("Copy failed"); });
  }
  var actions = [
    { t: "Principles", k: "section", run: function () { go("how"); } },
    { t: "Experience", k: "section", run: function () { go("experience"); } },
    { t: "Projects", k: "section", run: function () { go("projects"); } },
    { t: "Interests", k: "section", run: function () { go("interests"); } },
    { t: "Send a message", k: "section", run: function () { go("contact"); } },
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
  var touch = window.matchMedia("(pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !window.matchMedia("(hover: hover)").matches);
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

    function geom(name) {
      var W = plot.clientWidth || 360, small = W < 420, pitch;
      if (VIEWS[name].slot) {
        var labelW = small ? 76 : 116;
        pitch = Math.max(9, Math.min(32, (W - labelW) / 12));
        return { W: W, labelW: labelW, cols: 12, pitch: pitch, dot: pitch * 0.46, labelH: 0, gap: 0 };
      }
      var cols = small ? 18 : 22;
      pitch = Math.max(9, Math.min(32, W / cols));
      return { W: W, labelW: 0, cols: cols, pitch: pitch, dot: pitch * 0.46, labelH: 20, gap: pitch * 0.6 };
    }
    /* Lay the grouping out on paper first, then move every dot to where it belongs.
       Grouped by year a row is one year and the label sits beside it; the other groupings
       have names too long for a gutter, so their label sits above a full-width block. */
    function plan(name) {
      var v = VIEWS[name], g = geom(name), side = !!v.slot;
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
    function paint(name, animate) {
      var p = plan(name), g = p.g;
      var tallest = Object.keys(VIEWS).reduce(function (h, k) { return Math.max(h, k === name ? p.height : plan(k).height); }, 0);
      plot.style.height = Math.round(tallest) + "px";
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
        el.style.top = Math.round(gr.top) + "px";
        el.appendChild(document.createTextNode(gr.text + " "));
        var c = document.createElement("span");
        c.textContent = String(gr.count);
        el.appendChild(c);
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
    if (!reduce && typeof nodes[0].animate === "function") {
      var origin = cur[cur.length - 1], targets = cur.slice();
      nodes.forEach(function (d, i) { cur[i] = [origin[0], origin[1], 0]; d.style.transform = tf(origin[0], origin[1], 0); });
      requestAnimationFrame(function () {
        plot.classList.add("is-in");
        nodes.forEach(function (d, i) { fly(i, targets[i], { duration: 650, delay: (nodes.length - 1 - i) * 8 }); });
      });
    } else {
      requestAnimationFrame(function () { plot.classList.add("is-in"); });
    }

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

  /* Up and down move a whole section. A section taller than the window is stepped
     through a screen at a time first, so nothing below the fold gets skipped. */
  var pages = Array.prototype.slice.call(document.querySelectorAll(".page, .xp-stop"));
  if (pages.length) {
    var stops = function () {
      var h = document.querySelector(".top").offsetHeight;
      var list = pages.filter(function (el) { return el.offsetParent !== null; }).map(function (el) {
        return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - h));
      });
      return list.sort(function (a, b) { return a - b; });
    };
    document.addEventListener("keydown", function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (dlg && dlg.open) return;
      var t = e.target;
      if (t && t.closest && t.closest("input, textarea, select, [contenteditable]")) return;
      var down = e.key === "ArrowDown";
      var y = Math.round(window.scrollY), vh = window.innerHeight, list = stops(), target = null, i;
      if (down) {
        for (i = 0; i < list.length; i++) if (list[i] > y + 4) { target = list[i]; break; }
        if (target !== null && target > y + vh) target = y + Math.round(vh * 0.88);
      } else {
        for (i = list.length - 1; i >= 0; i--) if (list[i] < y - 4) { target = list[i]; break; }
        if (target !== null && target < y - vh) target = y - Math.round(vh * 0.88);
      }
      if (target === null) return;
      e.preventDefault();
      window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
    });
  }

  /* Projects: a stack tag lights up everywhere it appears */
  var built = document.querySelector("ul.built");
  if (built) {
    var tags = Array.prototype.slice.call(built.querySelectorAll(".skills li")), pinned = null;
    var key = function (li) { return li.textContent.trim().toLowerCase(); };
    var light = function (k) {
      built.classList.toggle("tagging", !!k);
      tags.forEach(function (li) { li.classList.toggle("lit", !!k && key(li) === k); });
    };
    tags.forEach(function (li) {
      li.addEventListener("pointerenter", function () { if (!pinned) light(key(li)); });
      li.addEventListener("pointerleave", function () { if (!pinned) light(null); });
      li.addEventListener("click", function (e) {
        e.stopPropagation();
        pinned = pinned === key(li) ? null : key(li);
        light(pinned);
      });
    });
    document.addEventListener("click", function () { if (pinned) { pinned = null; light(null); } });
  }

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

  /* Each page settles in the first time it is seen */
  var unseen = Array.prototype.slice.call(document.querySelectorAll(".page:not(.hero)"));
  /* Principles: the statement rises a word at a time, once; the text stays one sentence underneath */
  var riseWords = function () {
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
  if ("IntersectionObserver" in window) {
    var seer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || en.intersectionRatio < (en.target.classList.contains("stage") ? 0.18 : 0.35)) return;
        en.target.classList.add("seen");
        seer.unobserve(en.target);
        if (en.target.id === "how") riseWords();
      });
    }, { threshold: [0.18, 0.35] });
    unseen.forEach(function (el) { seer.observe(el); });
  } else {
    unseen.forEach(function (el) { el.classList.add("seen"); });
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
      var top = node.querySelector(".node-top"), fr = field.getBoundingClientRect(), nr = top.getBoundingClientRect();
      openNode = node;
      facts = Array.prototype.slice.call(node.querySelectorAll(".node-levels > li"));
      depth = 0;
      fname.textContent = node.querySelector(".node-name").textContent;
      trail.innerHTML = "";
      var first = document.createElement("li"); first.textContent = node.querySelector(".node-flavour").textContent; trail.appendChild(first);
      depthEl.innerHTML = "";
      facts.forEach(function () { depthEl.appendChild(document.createElement("i")); });
      field.style.transformOrigin = (nr.left + nr.width / 2 - fr.left) + "px " + (nr.top + nr.height / 2 - fr.top) + "px";
      field.classList.add("zoomed");
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
      field.classList.remove("zoomed");
      field.inert = false;
      top.setAttribute("aria-expanded", "false");
      hideTimer = setTimeout(function () { focus.hidden = true; }, reduce ? 0 : 460);
      top.focus({ preventScroll: true });
      openNode = null;
    }
    Array.prototype.forEach.call(field.querySelectorAll(".node"), function (node) {
      node.querySelector(".node-top").addEventListener("click", function () { zoomIn(node); });
    });
    deeper.addEventListener("click", goDeeper);
    surface.addEventListener("click", surfaceUp);
    focus.addEventListener("click", function (e) {
      if (e.target.closest("a, button")) return;
      goDeeper();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openNode && !(dlg && dlg.open)) surfaceUp(); });

    /* The nodes float freely: each drifts at its own speed and bounces off the edges and each other. */
    if (!reduce && "IntersectionObserver" in window) {
      var bodies = [], W = 0, H = 0, running = false, last = 0, inView = false, resizeTimer = 0;
      var nodeEls = Array.prototype.slice.call(field.querySelectorAll(".node"));
      function place(b) { b.el.style.transform = "translate(" + b.x.toFixed(1) + "px," + b.y.toFixed(1) + "px)"; }
      function setup() {
        field.classList.remove("sim");
        nodeEls.forEach(function (el) { el.style.transform = ""; el.style.width = ""; });
        var fr = field.getBoundingClientRect();
        W = fr.width; H = fr.height;
        bodies = nodeEls.map(function (el, i) {
          var r = el.getBoundingClientRect(), speed = 14 + Math.random() * 14, a = Math.random() * Math.PI * 2;
          var old = bodies[i];
          return { el: el, x: r.left - fr.left, y: r.top - fr.top, w: r.width, h: r.height, vx: old ? old.vx : Math.cos(a) * speed, vy: old ? old.vy : Math.sin(a) * speed };
        });
        bodies.forEach(function (b) { b.el.style.width = b.w + "px"; place(b); });
        field.classList.add("sim");
      }
      function step(now) {
        if (!running) return;
        var dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (!field.classList.contains("zoomed")) {
          bodies.forEach(function (b) {
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); } else if (b.x + b.w > W) { b.x = W - b.w; b.vx = -Math.abs(b.vx); }
            if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); } else if (b.y + b.h > H) { b.y = H - b.h; b.vy = -Math.abs(b.vy); }
          });
          for (var i = 0; i < bodies.length; i++) for (var k = i + 1; k < bodies.length; k++) {
            var a = bodies[i], c = bodies[k];
            var ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
            if (ox <= 0 || oy <= 0) continue;
            var t;
            if (ox < oy) {
              var sx = a.x < c.x ? -1 : 1;
              a.x += sx * ox / 2; c.x -= sx * ox / 2;
              if ((c.vx - a.vx) * sx > 0) { t = a.vx; a.vx = c.vx; c.vx = t; }
            } else {
              var sy = a.y < c.y ? -1 : 1;
              a.y += sy * oy / 2; c.y -= sy * oy / 2;
              if ((c.vy - a.vy) * sy > 0) { t = a.vy; a.vy = c.vy; c.vy = t; }
            }
          }
          bodies.forEach(place);
        }
        requestAnimationFrame(step);
      }
      function start() { if (running || !inView) return; running = true; last = performance.now(); requestAnimationFrame(step); }
      function stop() { running = false; }
      setup();
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) start(); else stop();
      }, { threshold: 0.05 }).observe(field);
      window.addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(setup, 150); });
      document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
    }
  }

  /* Experience: the panel pins while four stops scroll past; each stop is one role, oldest first */
  var stage = document.getElementById("experience");
  if (stage && stage.classList.contains("stage") && "IntersectionObserver" in window) {
    var xstops = Array.prototype.slice.call(stage.querySelectorAll(".xp-stop"));
    var roles = Array.prototype.slice.call(stage.querySelectorAll(".xp-roles > li"));
    var railDots = Array.prototype.slice.call(stage.querySelectorAll(".rail-dot"));
    var rail = stage.querySelector(".rail");
    var creds = Array.prototype.slice.call(stage.querySelectorAll(".cred[data-year]"));
    var active = -1;
    function activate(i) {
      if (i === active || !roles[i]) return;
      var dir = i > active ? 1 : -1, prev = roles[active];
      active = i;
      var end = Number(roles[i].getAttribute("data-end"));
      roles.forEach(function (li, n) { li.classList.toggle("is-active", n === i); });
      railDots.forEach(function (d, n) { d.classList.toggle("is-active", n === i); });
      creds.forEach(function (el) { el.classList.toggle("pending", Number(el.getAttribute("data-year")) > end); });
      if (reduce || !roles[i].animate) { if (prev) prev.classList.remove("leaving"); return; }
      if (prev) {
        prev.classList.add("leaving");
        var out = prev.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(" + (-24 * dir) + "px)" }], { duration: 300, easing: "cubic-bezier(.2,.75,.25,1)", fill: "forwards" });
        out.onfinish = function () { prev.classList.remove("leaving"); out.cancel(); };
      }
      roles[i].animate([{ opacity: 0, transform: "translateY(" + (24 * dir) + "px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: prev ? 120 : 0, easing: "cubic-bezier(.2,.75,.25,1)", fill: "backwards" });
    }
    activate(0);
    var stopSeer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) activate(Number(en.target.getAttribute("data-i"))); });
    }, { threshold: 0.5 });
    xstops.forEach(function (s) { stopSeer.observe(s); });
    var ticking = false;
    function progress() {
      ticking = false;
      if (!rail || xstops.length < 2) return;
      var first = xstops[0].getBoundingClientRect().top, span = (xstops[xstops.length - 1].getBoundingClientRect().top - first);
      var topH = document.querySelector(".top").offsetHeight;
      var p = span > 0 ? (topH - first) / span : 0;
      rail.style.setProperty("--p", Math.max(0, Math.min(1, p)).toFixed(3));
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(progress); } }, { passive: true });
    progress();
  }
})();
