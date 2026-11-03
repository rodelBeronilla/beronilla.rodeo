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
    { t: "Shuffle and sort the dots", k: "page", run: function () { var b = document.getElementById("matrix-again"); window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); if (b) b.click(); } },
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


  /* Dot matrix: 138 dots, one per month of study or work, shuffled and then sorted by a real quicksort, swap by swap */
  var cv = document.getElementById("matrix-cv");
  if (cv && cv.getContext) {
    var ctx = cv.getContext("2d"), COLS = 23, ROWS = 6;
    var counts = [57, 16, 52, 13], items = [], pair = [-1, -1], swaps = [], step = 0, raf = 0, W = 0, H = 0;
    var sws = Array.prototype.slice.call(document.querySelectorAll(".legend .sw"));
    var statusEl = document.getElementById("matrix-status");
    var base = "Each dot is one month of study or work, 138 in all.";
    function fresh() {
      items = [];
      counts.forEach(function (n, c) { for (var i = 0; i < n; i++) items.push(c); });
      for (var i = items.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = items[i]; items[i] = items[j]; items[j] = t; }
    }
    function plan() {
      var a = items.slice(); swaps = [];
      (function qs(lo, hi) {
        if (lo >= hi) return;
        var p = a[(lo + hi) >> 1], i = lo, j = hi;
        while (i <= j) {
          while (a[i] < p) i++;
          while (a[j] > p) j--;
          if (i <= j) { if (i !== j && a[i] !== a[j]) swaps.push([i, j]); var t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; }
        }
        qs(lo, j); qs(i, hi);
      })(0, a.length - 1);
    }
    function size() {
      var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    function draw() {
      var cols = sws.map(function (s) { return getComputedStyle(s).backgroundColor; });
      var ring = getComputedStyle(document.body).color;
      var cw = W / COLS, ch = H / ROWS, rad = Math.min(cw, ch) * 0.3;
      ctx.clearRect(0, 0, W, H);
      for (var k = 0; k < items.length; k++) {
        var x = (k % COLS + 0.5) * cw, y = (Math.floor(k / COLS) + 0.5) * ch, hot = k === pair[0] || k === pair[1];
        ctx.fillStyle = cols[items[k]];
        ctx.beginPath(); ctx.arc(x, y, hot ? rad * 1.25 : rad, 0, 6.2832); ctx.fill();
        if (hot) { ctx.strokeStyle = ring; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
    function sorted() { for (var k = 1; k < items.length; k++) if (items[k - 1] > items[k]) return false; return true; }
    function run(animate) {
      cancelAnimationFrame(raf); fresh(); plan(); step = 0; pair = [-1, -1];
      if (!animate) {
        swaps.forEach(function (s) { var t = items[s[0]]; items[s[0]] = items[s[1]]; items[s[1]] = t; });
        draw(); statusEl.textContent = base; return;
      }
      var per = Math.max(1, Math.ceil(swaps.length / 150));
      statusEl.textContent = "Sorting " + items.length + " records by where the month was spent.";
      (function frame() {
        for (var n = 0; n < per && step < swaps.length; n++, step++) {
          var s = swaps[step], t = items[s[0]]; items[s[0]] = items[s[1]]; items[s[1]] = t; pair = s;
        }
        if (step >= swaps.length) { pair = [-1, -1]; draw(); statusEl.textContent = base; return; }
        draw(); raf = requestAnimationFrame(frame);
      })();
    }
    size();
    window.addEventListener("resize", function () { size(); draw(); });
    new MutationObserver(function () { draw(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    var again = document.getElementById("matrix-again");
    if (again) again.addEventListener("click", function () { run(!reduce); });
    if (reduce) run(false);
    else { fresh(); draw(); setTimeout(function () { run(true); }, 700); }
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
