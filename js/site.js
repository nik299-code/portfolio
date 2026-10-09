/* Nikunj Poddar — portfolio v2. Vanilla JS, no dependencies, no network calls. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Theme toggle. Light is the default; the choice persists in localStorage. */
  var toggle = document.getElementById('theme-toggle');
  function applyTheme(dark) {
    if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
    if (toggle) {
      toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
      toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }
  applyTheme(root.dataset.theme === 'dark');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var dark = root.dataset.theme !== 'dark';
      applyTheme(dark);
      try { localStorage.setItem('np-theme', dark ? 'dark' : 'light'); } catch (e) {}
    });
  }

  /* Local time in Sammamish (America/Los_Angeles). */
  var clock = document.getElementById('clock');
  if (clock && window.Intl && Intl.DateTimeFormat) {
    var tz = clock.dataset.tz || 'America/Los_Angeles';
    var fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz });
    var iso = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
    var tick = function () {
      var now = new Date();
      clock.textContent = fmt.format(now).replace(/\s?(AM|PM)$/, ' $1') + ' PT';
      clock.setAttribute('datetime', iso.format(now));
    };
    tick();
    setInterval(tick, 15000);
  }

  /* Screen recordings: load lazily, play only while in view, user can pause.
     Under reduced motion nothing autoplays; the control still allows playback. */
  var videos = Array.prototype.slice.call(document.querySelectorAll('.screen-video'));
  var wantsPlay = new WeakMap();   // user intent per video (true = allowed to play)
  var inView = new WeakMap();

  function controlFor(video) {
    var fig = video.closest('figure');
    return fig ? fig.querySelector('[data-video-toggle]') : null;
  }
  function syncControl(video) {
    var btn = controlFor(video);
    if (!btn) return;
    var playing = !video.paused && !video.ended;
    btn.textContent = playing ? 'Pause' : 'Play';
    btn.setAttribute('aria-pressed', playing ? 'false' : 'true');
    btn.setAttribute('aria-label', (playing ? 'Pause' : 'Play') + ' screen recording');
  }
  function tryPlay(video) {
    if (!wantsPlay.get(video) || !inView.get(video)) return;
    if (video.readyState === 0 && video.preload === 'none') video.load();
    var p = video.play();
    if (p && typeof p.catch === 'function') p.catch(function () { syncControl(video); });
  }
  videos.forEach(function (video) {
    wantsPlay.set(video, !reduceMotion);
    inView.set(video, false);
    video.addEventListener('play', function () { syncControl(video); });
    video.addEventListener('pause', function () { syncControl(video); });
    var btn = controlFor(video);
    if (btn) {
      btn.addEventListener('click', function () {
        var playing = !video.paused && !video.ended;
        if (playing) { wantsPlay.set(video, false); video.pause(); }
        else { wantsPlay.set(video, true); inView.set(video, true); tryPlay(video); }
      });
    }
    syncControl(video);
  });

  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        inView.set(video, entry.isIntersecting);
        if (entry.isIntersecting) tryPlay(video);
        else if (!video.paused) video.pause();
      });
    }, { threshold: 0.35 });
    videos.forEach(function (v) { vio.observe(v); });
  } else {
    videos.forEach(function (v) { inView.set(v, true); tryPlay(v); });
  }

  /* TripCraft screen switcher (Today / Itinerary / Trending). */
  var tablist = document.querySelector('.tabs[role="tablist"]');
  if (tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    var panel = document.getElementById(tabs[0].getAttribute('aria-controls'));
    var video = panel ? panel.querySelector('video') : null;
    var source = video ? video.querySelector('source') : null;

    function selectTab(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      if (panel) panel.setAttribute('aria-labelledby', tab.id);
      if (video && source && source.getAttribute('src') !== tab.dataset.src) {
        video.pause();
        video.poster = tab.dataset.poster;
        source.setAttribute('src', tab.dataset.src);
        video.setAttribute('aria-label', 'TripCraft ' + tab.textContent.trim() + ' screen recording');
        video.load();
        tryPlay(video);
      }
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { selectTab(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') next = tabs[0];
        if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); next.focus(); selectTab(next); }
      });
    });
  }

  /* Motion. html.motion gates every animated initial state; html.no-sda switches the
     parallax and travel effects to the JS-driven fallback (one passive scroll listener,
     one requestAnimationFrame, reads before writes). */
  var supportsSDA = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: view()');
  if (/\bnosda\b/.test(location.search)) supportsSDA = false; // test hook for the fallback path
  if (!reduceMotion) root.classList.add('motion');
  if (!supportsSDA) root.classList.add('no-sda');

  /* Reveal on scroll: section titles, case rows (hairline draw), stories, contact. */
  var revealables = Array.prototype.slice.call(document.querySelectorAll('.case, .section-head, .about__item, .contact__body'));
  if (!reduceMotion && 'IntersectionObserver' in window) {
    revealables.forEach(function (el) { el.classList.add('reveal'); });
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); rio.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    revealables.forEach(function (el) { rio.observe(el); });
    requestAnimationFrame(function () {
      revealables.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
      });
    });
  }

  /* Current case: the row crossing the middle of the viewport gets its number in the accent. */
  var cases = Array.prototype.slice.call(document.querySelectorAll('.case'));
  if ('IntersectionObserver' in window && cases.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { entry.target.classList.toggle('is-current', entry.isIntersecting); });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    cases.forEach(function (el) { cio.observe(el); });
  }

  /* Count-up: once, when a figure enters view. Final text stays exactly as authored. */
  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
  function countUp(el) {
    var text = el.textContent;
    var m = text.match(/^([^0-9]*)([0-9][0-9,]*)(.*)$/);
    if (!m) return;
    var target = parseInt(m[2].replace(/,/g, ''), 10);
    var comma = m[2].indexOf(',') !== -1;
    var start = null, dur = 1100;
    function frame(t) {
      if (start === null) start = t;
      var k = Math.min(1, (t - start) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      var v = Math.round(target * e);
      el.textContent = m[1] + (comma ? v.toLocaleString('en-US') : String(v)) + m[3];
      if (k < 1) requestAnimationFrame(frame); else el.textContent = text;
    }
    requestAnimationFrame(frame);
  }
  if (!reduceMotion && 'IntersectionObserver' in window && counters.length) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { countUp(entry.target); nio.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { nio.observe(el); });
  }

  /* Fallback scroll progress for browsers without CSS scroll-driven animations. */
  if (!reduceMotion && !supportsSDA) {
    var tracked = Array.prototype.slice.call(document.querySelectorAll('.parallax, .window, .overview'));
    var ticking = false;
    function update() {
      ticking = false;
      var vh = window.innerHeight;
      var rects = tracked.map(function (el) { return el.getBoundingClientRect(); });
      rects.forEach(function (r, i) {
        var p = (vh - r.top) / (vh + r.height);
        p = Math.max(0, Math.min(1, p));
        var el = tracked[i];
        el.style.setProperty('--p', p.toFixed(4));
        if (el.classList.contains('overview')) {
          Array.prototype.forEach.call(el.children, function (tile) { tile.style.setProperty('--p', p.toFixed(4)); });
        }
      });
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }
})();
