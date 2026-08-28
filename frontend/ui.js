// ═══════════════════════════════════════════════════════
// ui.js — shared UI behaviour for every page
//   · global request progress bar
//   · busy/pending states for buttons and cards
//   · body scroll lock for modals
//   · custom dropdowns replacing the native <select> popup
// Loaded before each page's own script, so the helpers below are available
// everywhere without each page reimplementing them.
// ═══════════════════════════════════════════════════════

// ─── Global loading feedback ───────────────────────────────
// The database is in another region, so every request costs a real round-trip.
// Rather than sprinkle spinners through each call site, window.fetch is wrapped
// once to count in-flight requests and drive a thin progress bar at the top of
// the page — so any wait, anywhere, is visible instead of feeling like the app
// froze. Background polling opts out with { quiet: true }.
(function initGlobalLoadingBar() {
  const nativeFetch = window.fetch.bind(window);
  let inFlight = 0;
  let bar = null;
  let hideTimer = null;

  const getBar = () => {
    if (bar && bar.isConnected) return bar;
    bar = document.getElementById('app-progress');
    // Pages that forgot the markup still get a bar rather than silently none.
    if (!bar && document.body) {
      bar = document.createElement('div');
      bar.id = 'app-progress';
      bar.className = 'app-progress';
      bar.innerHTML = '<div class="app-progress-fill"></div>';
      document.body.appendChild(bar);
    }
    return bar;
  };

  const show = () => {
    const el = getBar();
    if (!el) return;
    clearTimeout(hideTimer);
    el.classList.add('active');
    el.classList.remove('done');
  };
  const hide = () => {
    const el = getBar();
    if (!el) return;
    el.classList.add('done');
    hideTimer = setTimeout(() => el.classList.remove('active', 'done'), 260);
  };

  window.fetch = (input, init = {}) => {
    const quiet = init.quiet === true;
    if (quiet) delete init.quiet;
    if (!quiet) { if (inFlight === 0) show(); inFlight++; }
    return nativeFetch(input, init).finally(() => {
      if (!quiet) { inFlight = Math.max(0, inFlight - 1); if (inFlight === 0) hide(); }
    });
  };
})();

// Runs an async action with the button locked and showing a spinner, so a slow
// save can't be double-submitted and the click visibly registers straight away.
async function withBusy(btn, fn, busyLabel) {
  if (!btn) return fn();
  if (btn.dataset.busy === '1') return;          // already running — ignore re-click
  const original = btn.innerHTML;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.classList.add('is-busy');
  btn.innerHTML = `<span class="btn-spinner"></span>${busyLabel || btn.textContent.trim()}`;
  try {
    return await fn();
  } finally {
    btn.dataset.busy = '';
    btn.disabled = false;
    btn.classList.remove('is-busy');
    btn.innerHTML = original;
  }
}

// Busy state for things that aren't buttons — a queue card, a table row.
// Marks the element pending (dimmed, wait cursor) and blocks re-entry, so
// clicking twice can't fire the same action twice.
async function withPending(el, fn) {
  if (!el) return fn();
  if (el.dataset.pending === '1') return;
  el.dataset.pending = '1';
  el.classList.add('is-pending');
  try {
    return await fn();
  } finally {
    el.dataset.pending = '';
    el.classList.remove('is-pending');
  }
}

// ─── Live updates ──────────────────────────────────────────
// Subscribes to the server's change stream and runs `onChange` whenever
// something relevant is reported. Replaces blind polling: the page refetches
// because data actually changed, not because a timer fired.
//
// A slow fallback poll is kept as a safety net for the case where the stream
// can't be established at all (a proxy that buffers text/event-stream, for
// example), and it pauses while the tab is hidden so a forgotten background
// tab isn't hitting the server all day.
//
// Returns { close } to tear everything down.
function subscribeToChanges(onChange, { topics = null, fallbackMs = 60000 } = {}) {
  let source = null;
  let fallbackTimer = null;
  let streamHealthy = false;
  let stopped = false;

  const relevant = topic => !topics || topics.includes(topic);

  const runFallback = () => {
    // Only poll when the stream isn't working AND the tab is actually visible.
    if (stopped || streamHealthy || document.hidden) return;
    onChange({ topic: 'poll', viaFallback: true });
  };

  const startFallback = () => {
    clearInterval(fallbackTimer);
    fallbackTimer = setInterval(runFallback, fallbackMs);
  };

  const connect = () => {
    if (stopped || typeof EventSource === 'undefined') { startFallback(); return; }
    try {
      source = new EventSource('/api/realtime/events');
    } catch (e) {
      console.warn('[Live] could not open change stream — falling back to polling', e);
      startFallback();
      return;
    }

    source.addEventListener('open', () => { streamHealthy = true; });
    source.addEventListener('change', e => {
      streamHealthy = true;
      let data = {};
      try { data = JSON.parse(e.data); } catch { /* ignore malformed frame */ }
      if (relevant(data.topic)) onChange(data);
    });
    // EventSource reconnects by itself; this only notes that the stream is
    // currently down so the fallback poll is allowed to run meanwhile.
    source.addEventListener('error', () => { streamHealthy = false; });
  };

  // Coming back to the tab may have missed events while it was hidden or the
  // machine was asleep, so refresh once on return.
  const onVisibility = () => { if (!document.hidden && !stopped) onChange({ topic: 'visible' }); };
  document.addEventListener('visibilitychange', onVisibility);

  connect();
  startFallback();

  return {
    close() {
      stopped = true;
      clearInterval(fallbackTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      if (source) source.close();
    },
  };
}

// Pins a dropdown/calendar panel to its trigger using viewport coordinates.
//
// These panels are normally `position: absolute` inside their field, which
// means any ancestor that scrolls or hides its overflow — a modal body, the
// OPD form's right column, the modal shell itself — clips them. A calendar
// opened near the bottom of a modal ended up half-cut or invisible.
//
// Switching to `position: fixed` takes the panel out of those clipping boxes
// entirely. Note the modal overlay sets `backdrop-filter`, which makes it the
// containing block for fixed descendants — harmless here because the overlay
// is itself `fixed; inset: 0`, so it lines up exactly with the viewport and
// getBoundingClientRect() coordinates stay correct.
//
// Returns { update, destroy }: call update() after the panel's contents change
// size (e.g. the datepicker switching to its year grid), destroy() on close.
function positionFloatingPanel(anchor, panel, { gap = 6, matchWidth = true } = {}) {
  const place = () => {
    // Measure with any previous placement cleared, so a panel that was flipped
    // up last time doesn't influence this measurement.
    panel.style.maxHeight = '';
    const a = anchor.getBoundingClientRect();
    const rect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = rect.width;
    let h = rect.height;

    const spaceBelow = vh - a.bottom - gap - 8;
    const spaceAbove = a.top - gap - 8;

    // Prefer below; flip above only when it genuinely fits better.
    let top;
    if (h <= spaceBelow || spaceBelow >= spaceAbove) {
      top = a.bottom + gap;
      if (h > spaceBelow) { h = Math.max(140, spaceBelow); panel.style.maxHeight = h + 'px'; }
    } else {
      if (h > spaceAbove) { h = Math.max(140, spaceAbove); panel.style.maxHeight = h + 'px'; }
      top = a.top - gap - h;
    }
    top = Math.max(8, Math.min(top, vh - h - 8));

    let left = a.left;
    if (left + w > vw - 8) left = a.right - w;     // align right edge instead
    left = Math.max(8, Math.min(left, vw - w - 8));

    panel.style.position = 'fixed';
    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    if (matchWidth) panel.style.minWidth = `${Math.round(a.width)}px`;
  };

  place();
  // Capture phase so scrolling of any inner container (modal body, OPD column)
  // is caught, not just the window.
  const onReflow = () => place();
  window.addEventListener('scroll', onReflow, true);
  window.addEventListener('resize', onReflow);

  return {
    update: place,
    destroy() {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
      ['position', 'top', 'left', 'right', 'bottom', 'minWidth', 'maxHeight']
        .forEach(prop => { panel.style[prop] = ''; });
    },
  };
}

// Opens a print-ready document in its own window.
//
// Previously this was done with `window.open('')` + document.write, which puts
// the print window in the SAME browsing context group as the app — so Chrome
// runs both in one renderer process, and the print dialog (which is modal and
// blocks that process) froze the whole app behind it. If the dialog was left
// open, the main tab sat there blank and "loading" until it was dismissed.
//
// Two changes fix that:
//  1. the document is handed over as a blob: URL opened with `noopener`, which
//     forces a separate browsing context group — and therefore its own
//     renderer — so the print dialog can no longer block the app; and
//  2. the document closes itself once printing finishes or is cancelled, so a
//     forgotten print tab doesn't pile up.
function openPrintWindow(html, { autoPrint = true } = {}) {
  const control = `
<script>
(function () {
  var closed = false;
  function finish() {
    if (closed) return;
    closed = true;
    // Small delay so the browser finishes tearing the dialog down first.
    setTimeout(function () { try { window.close(); } catch (e) {} }, 250);
  }
  window.addEventListener('afterprint', finish);
  // Safari/older engines don't always fire afterprint; the media-query
  // listener catches the transition back out of print mode as a fallback.
  if (window.matchMedia) {
    var mq = window.matchMedia('print');
    mq.addListener(function (m) { if (!m.matches) finish(); });
  }
  ${autoPrint ? "window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 120); });" : ''}
})();
<\/script>`;

  const doc = html.includes('</body>')
    ? html.replace('</body>', control + '</body>')
    : html + control;

  const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener,noreferrer,width=900,height=1000');
  // `noopener` means no handle comes back, so the URL is released on a timer
  // rather than when the window reports itself done.
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

// Freezes the page behind a modal. Without this, scrolling inside a modal keeps
// scrolling the page underneath once the inner panel hits its end. Driven off
// whether ANY modal is open, so stacked modals can't unlock too early.
function syncBodyScrollLock() {
  const anyOpen = document.querySelectorAll(
    '.modal.open, .modal-overlay.open, .confirm-overlay.open, .drawer.open'
  ).length > 0;
  document.body.classList.toggle('modal-open', anyOpen);
}

// ─── Custom dropdown (replaces the native <select> popup) ──
// The browser's own <select> popup is drawn by the OS and can't be styled, so
// it looked out of place against the rest of the UI. The real <select> stays in
// the DOM (hidden but focusable-by-code) and remains the single source of
// truth — so existing code reading `.value`, listening for `change`, or
// submitting the form via FormData keeps working untouched.
(function initCustomSelects() {
  let outsideBound = false;

  function enhance(select) {
    if (select.dataset.csEnhanced || select.multiple || select.size > 1) return;
    if (select.hasAttribute('data-no-custom')) return;
    select.dataset.csEnhanced = '1';

    const field = document.createElement('div');
    field.className = 'cs-field';
    // Toolbar filters and the dashboard's small chart pickers are compact;
    // everything else (form fields) gets the full-width field size.
    if (select.classList.contains('filter-select') || select.classList.contains('mini-select')) {
      field.classList.add('cs-compact');
    }
    select.parentNode.insertBefore(field, select);
    field.appendChild(select);

    const display = document.createElement('button');
    display.type = 'button';
    display.className = 'cs-display';
    display.setAttribute('aria-haspopup', 'listbox');
    display.setAttribute('aria-expanded', 'false');

    // Built as real nodes (rather than an innerHTML string re-queried later) so
    // the label element is always a direct reference that can't come back null.
    const valueEl = document.createElement('span');
    valueEl.className = 'cs-value';
    display.appendChild(valueEl);
    const caret = document.createElementNS
      ? document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      : document.createElement('svg');
    caret.setAttribute('class', 'cs-caret');
    caret.setAttribute('viewBox', '0 0 10 6');
    caret.setAttribute('aria-hidden', 'true');
    caret.innerHTML = '<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>';
    display.appendChild(caret);
    field.appendChild(display);

    const panel = document.createElement('div');
    panel.className = 'cs-panel';
    panel.setAttribute('role', 'listbox');
    field.appendChild(panel);

    const renderPanel = () => {
      panel.innerHTML = Array.from(select.options).map((o, i) =>
        `<div class="cs-option${o.selected ? ' selected' : ''}${o.disabled ? ' disabled' : ''}" data-i="${i}" role="option" aria-selected="${o.selected}">${o.textContent}</div>`
      ).join('');
    };

    const syncDisplay = () => {
      const opt = select.options[select.selectedIndex];
      valueEl.textContent = opt ? opt.textContent : '';
      display.classList.toggle('cs-placeholder', !select.value);
      display.disabled = select.disabled;
      field.classList.toggle('cs-disabled', select.disabled);
    };

    let floating = null;
    const close = () => {
      field.classList.remove('open');
      display.setAttribute('aria-expanded', 'false');
      if (floating) { floating.destroy(); floating = null; }
    };
    const open = () => {
      if (select.disabled) return;
      document.querySelectorAll('.cs-field.open').forEach(f => { if (f !== field) f._csClose?.(); });
      renderPanel();
      field.classList.add('open');
      display.setAttribute('aria-expanded', 'true');

      // Pinned to the viewport so a modal's overflow can't clip it.
      if (floating) floating.destroy();
      floating = positionFloatingPanel(display, panel, { gap: 5 });
      const active = panel.querySelector('.cs-option.selected');
      if (active) active.scrollIntoView({ block: 'nearest' });
    };
    const toggle = () => field.classList.contains('open') ? close() : open();

    const pick = i => {
      const opt = select.options[i];
      if (!opt || opt.disabled) return;
      if (select.selectedIndex !== i) {
        select.selectedIndex = i;
        // Notify existing listeners exactly as a real user selection would.
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncDisplay();
      close();
      display.focus();
    };

    display.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(); });
    panel.addEventListener('mousedown', e => {
      const opt = e.target.closest('.cs-option');
      if (!opt) return;
      e.preventDefault();          // don't blur before the click registers
      pick(Number(opt.dataset.i));
    });

    display.addEventListener('keydown', e => {
      const last = select.options.length - 1;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'Escape') close();
      else if (e.key === 'ArrowDown') { e.preventDefault(); pick(Math.min(select.selectedIndex + 1, last)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); pick(Math.max(select.selectedIndex - 1, 0)); }
    });

    // Keep the visible label correct when code changes the select itself —
    // filling an edit form, resetting a form, or toggling `disabled`.
    select.addEventListener('change', syncDisplay);
    const form = select.closest('form');
    if (form) form.addEventListener('reset', () => setTimeout(syncDisplay, 0));

    // `el.value = x` bypasses every event, so the setter is patched to sync too.
    const proto = Object.getPrototypeOf(select);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) {
      Object.defineProperty(select, 'value', {
        configurable: true,
        get() { return desc.get.call(this); },
        set(v) { desc.set.call(this, v); syncDisplay(); },
      });
    }

    field._csSync = syncDisplay;
    // Exposed so the delegated outside-click/Escape handlers below close through
    // the real close() — otherwise the panel's scroll/resize listeners would be
    // left attached every time it's dismissed that way.
    field._csClose = close;
    syncDisplay();

    if (!outsideBound) {
      outsideBound = true;
      document.addEventListener('click', e => {
        document.querySelectorAll('.cs-field.open').forEach(f => {
          if (!f.contains(e.target)) f._csClose?.();
        });
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.cs-field.open').forEach(f => f._csClose?.());
      });
    }
  }

  function enhanceAll(root = document) {
    root.querySelectorAll('select:not([data-cs-enhanced])').forEach(enhance);
  }

  document.addEventListener('DOMContentLoaded', () => enhanceAll());

  // For selects added after load (a modal built dynamically), and to re-sync
  // labels after code has changed several selects at once.
  window.enhanceSelects = enhanceAll;
  window.refreshSelects = (root = document) =>
    root.querySelectorAll('.cs-field').forEach(f => f._csSync && f._csSync());
})();
