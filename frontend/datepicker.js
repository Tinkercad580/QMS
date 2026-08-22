// ═══════════════════════════════════════════════════════
// datepicker.js — shared custom date picker
// Replaces every native <input type="date"> popup in the app with one
// consistent, professional calendar dropdown. The original input stays in
// the DOM (hidden) as the real source of truth — its id, name, and .value
// (ISO yyyy-mm-dd) keep working exactly as before, so no other code needs
// to change. Include this + datepicker.css on any page with date inputs.
// ═══════════════════════════════════════════════════════

(function () {
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  function pad2(n) { return String(n).padStart(2, '0'); }
  function toIso(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
  function todayIso() {
    const d = new Date();
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function parseIso(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return null;
    return { y, m: m - 1, d };
  }
  function formatDisplay(iso) {
    const p = parseIso(iso);
    if (!p) return '';
    return new Date(p.y, p.m, p.d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function enhance(input) {
    if (input.dataset.dpEnhanced) return;
    input.dataset.dpEnhanced = '1';

    // Work out how the field wrapper should size itself so layout doesn't
    // shift once the real input is hidden: a flex-basis set inline on the
    // input (e.g. style="flex:1") carries over directly, and a parent that's
    // a flex *column* (the common .form-group pattern, which stretches its
    // children to full width) needs the wrapper to explicitly claim 100%
    // since it — not the input — is now that direct child.
    const inlineFlex = input.style.flex;
    const parentStyle = input.parentElement ? getComputedStyle(input.parentElement) : null;
    const parentStretches = parentStyle && parentStyle.display.includes('flex') && parentStyle.flexDirection === 'column';

    // Preserve the real <input type="date"> as the source of truth (id/name/
    // value/min/max/required all keep working for any existing code), just
    // remove it visually — a custom display + panel replace its UI.
    input.style.position = 'absolute';
    input.style.opacity = '0';
    input.style.width = '0';
    input.style.height = '0';
    input.style.pointerEvents = 'none';
    input.tabIndex = -1;

    const field = document.createElement('div');
    field.className = 'dp-field';
    if (inlineFlex) field.style.flex = inlineFlex;
    if (parentStretches) field.style.width = '100%';

    const display = document.createElement('div');
    display.className = 'dp-display';
    display.tabIndex = 0;
    display.setAttribute('role', 'button');
    display.innerHTML = `<span class="dp-display-text"></span>
      <span class="dp-display-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>`;

    const panel = document.createElement('div');
    panel.className = 'dp-panel';

    input.insertAdjacentElement('afterend', field);
    field.appendChild(display);
    field.appendChild(panel);
    field.appendChild(input); // keep input inside the field for DOM proximity, still hidden

    // View state: which month/year the calendar is currently showing,
    // independent of the selected value until the user navigates.
    let view = parseIso(input.value) || parseIso(todayIso());
    let showingYearGrid = false;

    function syncDisplay() {
      const iso = input.value;
      if (iso) {
        display.querySelector('.dp-display-text').textContent = formatDisplay(iso);
        display.classList.remove('dp-placeholder');
      } else {
        display.querySelector('.dp-display-text').textContent = input.placeholder || 'Select date…';
        display.classList.add('dp-placeholder');
      }
    }

    // Override the native value accessor so ANY code setting input.value
    // (old or new, this file or app code) keeps the visible display in sync,
    // without needing every caller to know about this widget.
    const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(input, 'value', {
      configurable: true,
      get() { return nativeDescriptor.get.call(input); },
      set(v) {
        nativeDescriptor.set.call(input, v);
        const p = parseIso(v);
        if (p) view = p;
        syncDisplay();
      },
    });

    // Same idea for .disabled — the display needs to visually + behaviorally
    // reflect it whenever app code locks/unlocks the field (e.g. a follow-up
    // date that's already booked).
    const nativeDisabledDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'disabled');
    Object.defineProperty(input, 'disabled', {
      configurable: true,
      get() { return nativeDisabledDescriptor.get.call(input); },
      set(v) {
        nativeDisabledDescriptor.set.call(input, v);
        display.classList.toggle('dp-disabled-display', !!v);
        display.tabIndex = v ? -1 : 0;
        if (v) close();
      },
    });

    function isDisabled(y, m, d) {
      const iso = toIso(y, m, d);
      if (input.min && iso < input.min) return true;
      if (input.max && iso > input.max) return true;
      return false;
    }

    function renderMonthGrid() {
      const { y, m } = view;
      panel.innerHTML = `
        <div class="dp-header">
          <button type="button" class="dp-nav-btn" data-dp-prev>‹</button>
          <span class="dp-title" data-dp-title>${MONTH_NAMES[m]} ${y}</span>
          <button type="button" class="dp-nav-btn" data-dp-next>›</button>
        </div>
        <div class="dp-weekdays">${WEEKDAY_LABELS.map(w => `<span>${w}</span>`).join('')}</div>
        <div class="dp-days"></div>
        <div class="dp-footer">
          <button type="button" class="dp-clear-btn" data-dp-clear>Clear</button>
          <button type="button" data-dp-today>Today</button>
        </div>
      `;

      const daysEl = panel.querySelector('.dp-days');
      const firstOfMonth = new Date(y, m, 1);
      const startWeekday = firstOfMonth.getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const daysInPrevMonth = new Date(y, m, 0).getDate();
      const selected = parseIso(input.value);
      const today = parseIso(todayIso());
      const cells = [];

      for (let i = startWeekday - 1; i >= 0; i--) {
        cells.push({ y: m === 0 ? y - 1 : y, m: m === 0 ? 11 : m - 1, d: daysInPrevMonth - i, outside: true });
      }
      for (let d = 1; d <= daysInMonth; d++) cells.push({ y, m, d, outside: false });
      const remainder = (7 - (cells.length % 7)) % 7;
      for (let d = 1; d <= remainder; d++) {
        cells.push({ y: m === 11 ? y + 1 : y, m: m === 11 ? 0 : m + 1, d, outside: true });
      }

      daysEl.innerHTML = cells.map(c => {
        const isSelected = selected && selected.y === c.y && selected.m === c.m && selected.d === c.d;
        const isToday = today.y === c.y && today.m === c.m && today.d === c.d;
        const disabled = isDisabled(c.y, c.m, c.d);
        const classes = ['dp-day'];
        if (c.outside) classes.push('dp-outside');
        if (isToday) classes.push('dp-today');
        if (isSelected) classes.push('dp-selected');
        if (disabled) classes.push('dp-disabled');
        return `<span class="${classes.join(' ')}" data-dp-day="${toIso(c.y, c.m, c.d)}">${c.d}</span>`;
      }).join('');

      daysEl.querySelectorAll('.dp-day:not(.dp-disabled)').forEach(el => {
        el.addEventListener('click', e => {
          e.stopPropagation();
          input.value = el.dataset.dpDay;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          close();
        });
      });

      panel.querySelector('[data-dp-prev]').addEventListener('click', e => {
        e.stopPropagation();
        view = { y: m === 0 ? y - 1 : y, m: m === 0 ? 11 : m - 1, d: 1 };
        renderMonthGrid();
      });
      panel.querySelector('[data-dp-next]').addEventListener('click', e => {
        e.stopPropagation();
        view = { y: m === 11 ? y + 1 : y, m: m === 11 ? 0 : m + 1, d: 1 };
        renderMonthGrid();
      });
      panel.querySelector('[data-dp-title]').addEventListener('click', e => {
        e.stopPropagation();
        showingYearGrid = true;
        renderMonthPicker();
      });
      panel.querySelector('[data-dp-clear]').addEventListener('click', e => {
        e.stopPropagation();
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });
      panel.querySelector('[data-dp-today]').addEventListener('click', e => {
        e.stopPropagation();
        const t = parseIso(todayIso());
        view = t;
        input.value = todayIso();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });
    }

    // Quick month-jump grid — click the header title to pick any month of
    // the current year at a glance instead of clicking ‹/› repeatedly.
    function renderMonthPicker() {
      const { y, m: currentMonth } = view;
      panel.innerHTML = `
        <div class="dp-header">
          <button type="button" class="dp-nav-btn" data-dp-year-prev>‹</button>
          <span class="dp-title">${y}</span>
          <button type="button" class="dp-nav-btn" data-dp-year-next>›</button>
        </div>
        <div class="dp-yearview">
          ${MONTH_NAMES.map((name, i) => `<span class="dp-month-cell${i === currentMonth ? ' dp-current-month' : ''}" data-dp-month="${i}">${name.slice(0, 3)}</span>`).join('')}
        </div>
      `;
      panel.querySelector('[data-dp-year-prev]').addEventListener('click', e => { e.stopPropagation(); view = { ...view, y: view.y - 1 }; renderMonthPicker(); });
      panel.querySelector('[data-dp-year-next]').addEventListener('click', e => { e.stopPropagation(); view = { ...view, y: view.y + 1 }; renderMonthPicker(); });
      panel.querySelectorAll('[data-dp-month]').forEach(el => {
        el.addEventListener('click', e => {
          e.stopPropagation();
          view = { ...view, m: parseInt(el.dataset.dpMonth, 10) };
          showingYearGrid = false;
          renderMonthGrid();
        });
      });
    }

    function open() {
      document.querySelectorAll('.dp-field.open').forEach(f => { if (f !== field) f.classList.remove('open'); });
      showingYearGrid = false;
      view = parseIso(input.value) || view || parseIso(todayIso());
      renderMonthGrid();
      field.classList.add('open');
      // Flip to the left edge if the panel would overflow the viewport.
      panel.classList.remove('dp-align-right');
      requestAnimationFrame(() => {
        const rect = panel.getBoundingClientRect();
        if (rect.right > window.innerWidth - 8) panel.classList.add('dp-align-right');
      });
    }
    function close() { field.classList.remove('open'); }
    function toggle() { field.classList.contains('open') ? close() : open(); }

    display.addEventListener('click', () => {
      if (input.disabled) return;
      toggle();
    });
    display.addEventListener('keydown', e => {
      if (input.disabled) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    field._dpClose = close;
    syncDisplay();
  }

  function enhanceAll(root = document) {
    root.querySelectorAll('input[type="date"]:not([data-dp-enhanced])').forEach(enhance);
  }

  // Click-outside and Escape close whichever panel is open — one delegated
  // listener covers every date field on the page.
  document.addEventListener('click', e => {
    document.querySelectorAll('.dp-field.open').forEach(field => {
      if (!field.contains(e.target)) field.classList.remove('open');
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.dp-field.open').forEach(f => f.classList.remove('open'));
  });

  document.addEventListener('DOMContentLoaded', () => enhanceAll());

  // Expose for pages that add date inputs dynamically after load (e.g. a
  // modal whose HTML is injected later) — call window.enhanceDatePickers()
  // after inserting new <input type="date"> elements.
  window.enhanceDatePickers = enhanceAll;
})();
