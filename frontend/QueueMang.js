// ═══════════════════════════════════════════════════════
// QueueMang.js — Queue Management Frontend
// ═══════════════════════════════════════════════════════

const API_BASE = 'http://172.27.23.168:3000';
const QUEUE_API = `${API_BASE}/api/queue`;
const APPT_API = `${API_BASE}/api/appointments`;
const PAT_API = `${API_BASE}/api/patients`;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

console.log(`Queue Management Frontend initialized. Today: ${today()}`);
const $ = id => document.getElementById(id);

let state = {
  queue: [],
  appointments: [],
  allPatients: [],
  filteredQueue: [],
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  apptCalYear: new Date().getFullYear(),
  apptCalMonth: new Date().getMonth(),
  selectedCalDate: today(), // <--- This now works perfectly
  apptSelectedDate: null,
  selectedWalkinPatient: null,
  selectedApptPatient: null,
  filterStatus: '',
  filterType: '',
  pendingConfirm: null,
  autoRefreshTimer: null,
  autoCallNext: false,
};





// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  loadAll();
  bindEvents();
  // Auto-refresh every 30 seconds
  state.autoRefreshTimer = setInterval(() => loadAll(true), 30000);
});

async function loadAll(silent = false) {
  // 1. Fetch patients FIRST so we have age/gender data ready in memory
  await loadPatients();

  // 2. NOW fetch queue and appointments (which will render immediately using the patient data)
  await Promise.all([loadQueue(silent), loadAppointments(silent)]);

  // 3. Update top numbers
  updateStats();
}

// ─── CLOCK ─────────────────────────────────────────────
function startClock() {
  const update = () => {
    const now = new Date();
    $('topbar-clock').textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  update();
  setInterval(update, 1000);
}

// ─── LOAD QUEUE ────────────────────────────────────────
async function loadQueue(silent = false) {
  try {
    const res = await fetch(`${QUEUE_API}?date=${today()}`);
    const data = await res.json();
    if (data.success) {
      state.queue = data.queue || [];
      applyQueueFilters();
    }
  } catch (e) {
    if (!silent) toast('error', 'Failed to load queue');
  }
}

// ─── LOAD APPOINTMENTS ─────────────────────────────────
async function loadAppointments(silent = false) {
  try {
    const res = await fetch(`${APPT_API}?date=${state.selectedCalDate}`);
    const data = await res.json();
    if (data.success) {
      state.appointments = data.appointments || [];
      renderAppointmentPanel();
      renderMiniCalendar();
    }
  } catch (e) {
    if (!silent) toast('error', 'Failed to load appointments');
  }
}

// ─── LOAD PATIENTS (for search) ────────────────────────
async function loadPatients() {
  try {
    const res = await fetch(PAT_API);
    const data = await res.json();
    if (data.success) state.allPatients = data.patients || [];
  } catch { }
}

// ─── STATS ─────────────────────────────────────────────
function updateStats() {
  const q = state.queue;
  $('s-total').textContent = q.length;
  $('s-waiting').textContent = q.filter(x => x.status === 'WAITING').length;
  $('s-serving').textContent = q.filter(x => x.status === 'SERVING' || x.status === 'CALLED').length;
  $('s-done').textContent = q.filter(x => x.status === 'DONE').length;
  $('s-noshow').textContent = q.filter(x => x.status === 'NOSHOW').length;
  const rev = q.filter(x => x.status === 'DONE').reduce((a, x) => a + (x.amount_paid || 0), 0);
  $('s-revenue').textContent = `₹${rev.toLocaleString('en-IN')}`;
}

// ─── FILTER & RENDER QUEUE ─────────────────────────────
function applyQueueFilters() {
  let list = [...state.queue];
  if (state.filterStatus) list = list.filter(x => x.status === state.filterStatus);
  if (state.filterType) list = list.filter(x => x.ticket_type === state.filterType);
  state.filteredQueue = list;
  renderQueue();
}

function renderQueue() {
  const list = state.filteredQueue;
  const activeCount = state.queue.filter(x => ['WAITING', 'CALLED', 'SERVING'].includes(x.status)).length;
  $('queue-count-badge').textContent = `${activeCount} in queue`;

  if (!list.length) {
    $('queue-list').innerHTML = `
      <div class="empty-queue">
        <svg viewBox="0 0 64 64" fill="none"><rect x="8" y="16" width="48" height="36" rx="4" stroke="#cbd5e1" stroke-width="2"/><path d="M20 28h24M20 36h16" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round"/></svg>
        <p>No queue entries${state.filterStatus || state.filterType ? ' for this filter.' : ' today.'}</p>
      </div>`;
    return;
  }

  // Group into sections
  const pending = list.filter(x => x.status === 'WAITING');
  const ongoing = list.filter(x => ['CALLED', 'SERVING'].includes(x.status));
  const completed = list.filter(x => ['DONE', 'NOSHOW', 'MISSED'].includes(x.status));

  let html = '';

  if (ongoing.length) {
    html += `<div class="queue-section-label ongoing-label">
      <span class="qs-dot ongoing-dot"></span>Ongoing (${ongoing.length})
    </div>`;
    html += ongoing.map((q, i) => queueCardHtml(q, i)).join('');
  }

  if (pending.length) {
    html += `<div class="queue-section-label pending-label">
      <span class="qs-dot pending-dot"></span>Pending (${pending.length})
    </div>`;
    html += pending.map((q, i) => queueCardHtml(q, i)).join('');
  }

  if (completed.length) {
    html += `<div class="queue-section-label completed-label">
      <span class="qs-dot completed-dot"></span>Completed / Done (${completed.length})
    </div>`;
    html += completed.map((q, i) => queueCardHtml(q, i)).join('');
  }

  $('queue-list').innerHTML = html;
  updateQueueButtonState();
}

// ─── DYNAMIC QUEUE BUTTON ──────────────────────────────
// ─── DYNAMIC QUEUE BUTTON ──────────────────────────────
function updateQueueButtonState() {
  const btn = $('start-queue-btn');
  if (!btn) return;

  const ongoing = state.queue.filter(x => ['CALLED', 'SERVING'].includes(x.status));
  const waiting = state.queue.filter(x => x.status === 'WAITING');

  // Keep button as "Next Patient" if someone is ongoing OR if we are in the middle of auto-calling
  if (ongoing.length > 0 || state.autoCallNext) {
    // ADDED: btn-ongoing-pulse class here
    btn.className = 'btn btn-primary btn-ongoing-pulse';
    btn.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
    btn.style.boxShadow = ''; // Cleared so CSS can handle the glowing animation
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
        <path d="M4 5v10l7-5-7-5zm9 0v10h2V5h-2z" fill="currentColor"/>
      </svg>
      Next Patient
    `;
  } else if (waiting.length > 0) {
    // State: Ready to Start -> Button becomes "Start Queue"
    btn.className = 'btn btn-start-queue';
    btn.style.background = '';
    btn.style.boxShadow = '';
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
        <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 7l5 3-5 3V7z" fill="currentColor"/>
      </svg>
      Start Queue
    `;
  } else {
    // State: Empty Queue
    btn.className = 'btn btn-ghost';
    btn.style.background = '';
    btn.style.boxShadow = 'none';
    btn.disabled = true;
    btn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
        <path d="M5 10h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      Queue Empty
    `;
  }
}

function queueCardHtml(q, i) {
  const isAppt = q.ticket_type === 'APPOINTMENT';

  // ── NEW: Extract Demographics with Colored Gender ────────
  const pat = q.patient_id ? state.allPatients.find(p => String(p.id) === String(q.patient_id)) : null;
  let demoStr = '';
  if (pat) {
    // 1. Age as Amber Pill
    const age = pat.age
      ? `<span style="background:#fffbeb; color:#d97706; border:1px solid #fde68a; padding:1px 6px; border-radius:100px; font-weight:800; font-size:10px; letter-spacing:0.05em;">${pat.age}Y</span>`
      : '';

    // 2. Gender as Colored Pill
    let genderStr = '';
    if (pat.gender) {
      const g = pat.gender.charAt(0).toUpperCase();
      const gColor = g === 'M' ? '#2563eb' : (g === 'F' ? '#db2777' : '#7c3aed');
      const gBg = g === 'M' ? '#eff6ff' : (g === 'F' ? '#fdf2f8' : '#f5f3ff');
      const gBorder = g === 'M' ? '#bfdbfe' : (g === 'F' ? '#fbcfe8' : '#ddd6fe');
      genderStr = `<span style="color:${gColor}; background:${gBg}; border:1px solid ${gBorder}; padding:1px 6px; border-radius:100px; font-weight:800; font-size:10px;">${g}</span>`;
    }

    // Combine them side-by-side
    if (age || genderStr) {
      demoStr = `<span style="display:inline-flex; align-items:center; gap:4px; margin-left:8px;">${age}${genderStr}</span>`;
    }
  }
  // ───────────────────────────────────────────────────────

  // ── Custom SVG action buttons (NO emojis) ──────────────
  let actions = '';

  const btnCall = `
    <button class="qbtn qbtn-call" data-action="call" data-id="${q.id}" title="Call Patient">
      <svg viewBox="0 0 18 18" fill="none">
        <path d="M3 5a2 2 0 0 1 2-2h1.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H5.5A3.5 3.5 0 0 0 9 10.5h0a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V12a2 2 0 0 1-2 2C6.134 14 3 10.866 3 7V5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </button>`;

  const btnSkip = `
    <button class="qbtn qbtn-skip" data-action="miss" data-id="${q.id}" title="Mark Missed">
      <svg viewBox="0 0 18 18" fill="none">
        <path d="M4 9h7M14 6l-3 3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>`;

  const btnRemove = `
    <button class="qbtn qbtn-del" data-action="remove" data-id="${q.id}" title="Remove from Queue">
      <svg viewBox="0 0 18 18" fill="none">
        <path d="M3 5h12M7 5V3h4v2M6 5v9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5H6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>`;

  const btnDone = `
    <button class="qbtn qbtn-done" data-action="complete" data-id="${q.id}" title="Complete / Mark Done">
      <svg viewBox="0 0 18 18" fill="none">
        <path d="M4 9.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>`;

  const btnNoshow = `
    <button class="qbtn qbtn-noshow" data-action="noshow" data-id="${q.id}" title="Mark No-show">
      <svg viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.5"/>
        <path d="M6 12l6-6M12 12L6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>`;

  const btnRequeue = `
    <button class="qbtn qbtn-requeue" data-action="requeue" data-id="${q.id}" title="Re-queue at End">
      <svg viewBox="0 0 18 18" fill="none">
        <path d="M2 9a7 7 0 1 0 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M2 5v4h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>`;

  if (q.status === 'WAITING') {
    actions = btnCall + btnSkip + btnRemove;
  } else if (q.status === 'CALLED' || q.status === 'SERVING') {
    actions = btnDone + btnNoshow;
  } else if (q.status === 'MISSED') {
    actions = btnRequeue + btnRemove;
  }

  const priorityTag = q.priority !== 'NORMAL'
    ? `<span class="priority-chip priority-${q.priority}">${q.priority === 'EMERGENCY' ? 'EMERG' : 'VIP'}</span>`
    : '';

  const amountTag = q.amount_paid > 0
    ? `<span class="qmeta-item fee-paid">₹${q.amount_paid}</span>`
    : (q.fee > 0 ? `<span class="qmeta-item fee-pending">₹${q.fee}</span>` : '');

  return `
    <div class="queue-card status-${q.status} priority-${q.priority}" data-id="${q.id}" style="animation-delay:${i * 15}ms">
      <div class="qtoken">
        ${isAppt ? `<span class="ticket-type-badge appt-badge-chip">APT</span>` : `<span class="ticket-type-badge walk-badge-chip">WLK</span>`}
        <span class="qnum">#${q.token_number}</span>
      </div>
      <div class="qinfo">
        <div class="qname" style="display:flex; align-items:center;">${esc(q.patient_name)} ${demoStr} ${priorityTag}</div>
        <div class="qmeta">
          ${q.visit_type ? `<span class="qmeta-item"><svg viewBox="0 0 14 14" fill="none" width="11" height="11"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M7 4v6M4 7h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>${q.visit_type}</span>` : ''}
          ${q.doctor ? `<span class="qmeta-item"><svg viewBox="0 0 14 14" fill="none" width="11" height="11"><circle cx="7" cy="5" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M2 12c0-2.21 2.239-4 5-4s5 1.79 5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>${esc(q.doctor)}</span>` : ''}
          ${q.mobile ? `<span class="qmeta-item" style="color:var(--secondary); font-weight:600; background:var(--secondary-l); padding:2px 6px; border-radius:4px;"><svg viewBox="0 0 14 14" fill="none" width="11" height="11"><rect x="3" y="1" width="8" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="11" r="0.7" fill="currentColor"/></svg>${q.mobile}</span>` : ''}
          ${amountTag}
          ${q.slot_time && isAppt ? `
            <span class="qmeta-item" style="color:var(--primary); background:var(--primary-l); padding:2px 6px; border-radius:4px; font-family:var(--font-mono); font-weight:600;">
              <svg viewBox="0 0 14 14" fill="none" width="11" height="11" style="margin-right:3px;">
                <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/>
                <path d="M7 4v3l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>${q.slot_time}
            </span>` : ''}        </div>
      </div>
      <div class="qright">
        <span class="status-badge ${q.status}">${statusLabel(q.status)}</span>
        <div class="qactions">${actions}</div>
      </div>
    </div>`;
}

function statusLabel(s) {
  return { WAITING: 'Waiting', CALLED: 'Called', SERVING: 'Serving', DONE: 'Done', NOSHOW: 'No-show', MISSED: 'Missed' }[s] || s;
}

// ─── QUEUE ACTIONS ─────────────────────────────────────
async function queueAction(id, action, extra = {}) {
  try {
    const res = await fetch(`${QUEUE_API}/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    if (data.success) {
      if (data.sms_sent) toast('info', `📱 SMS sent to next ${data.sms_sent} patients`);
      await loadAll(true);
      return data;
    } else {
      toast('error', data.message || 'Action failed');
    }
  } catch {
    toast('error', 'Network error');
  }
}

// ─── MINI CALENDAR ─────────────────────────────────────
function renderMiniCalendar() {
  const yr = state.calYear, mo = state.calMonth;
  $('cal-month-label').textContent = new Date(yr, mo, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const first = new Date(yr, mo, 1).getDay();
  const days = new Date(yr, mo + 1, 0).getDate();
  const todayStr = today();

  // Get appointment dates this month
  const apptDates = new Set(state.appointments.map(a => a.appt_date?.slice(0, 10)));

  let html = '';
  for (let i = 0; i < first; i++) html += `<div class="cal-day cal-empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = ds === todayStr;
    const isPast = ds < todayStr;
    const isSelected = ds === state.selectedCalDate;
    const hasAppt = apptDates.has(ds);
    html += `<div class="cal-day${isPast ? ' cal-past' : ''}${isToday ? ' cal-today' : ''}${isSelected ? ' cal-selected' : ''}${hasAppt ? ' has-appt' : ''}" data-date="${ds}">${d}</div>`;
  }
  $('cal-grid').innerHTML = html;

  // Label
  const sel = new Date(state.selectedCalDate + 'T00:00:00');
  const isToday2 = state.selectedCalDate === todayStr;
  $('appt-date-label').textContent = isToday2 ? "Today's Appointments" :
    sel.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── BIG APPOINTMENT CALENDAR ──────────────────────────
function renderBigCalendar() {
  const yr = state.apptCalYear, mo = state.apptCalMonth;
  $('appt-cal-label').textContent = new Date(yr, mo, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const first = new Date(yr, mo, 1).getDay();
  const days = new Date(yr, mo + 1, 0).getDate();
  const todayStr = today();

  let html = '';
  for (let i = 0; i < first; i++) html += `<div class="cal-day cal-empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isPast = ds < todayStr && ds !== todayStr;
    const isSelected = ds === state.apptSelectedDate;
    const isToday = ds === todayStr;
    html += `<div class="cal-day${isPast ? ' cal-past' : ''}${isToday ? ' cal-today' : ''}${isSelected ? ' cal-selected' : ''}" data-appt-date="${ds}">${d}</div>`;
  }
  $('appt-cal-grid').innerHTML = html;
}

// ─── APPOINTMENT PANEL ─────────────────────────────────
// ─── APPOINTMENT PANEL ─────────────────────────────────
function renderAppointmentPanel() {
  const appts = state.appointments;
  $('appt-count-badge').textContent = appts.length;

  if (!appts.length) {
    $('appt-list').innerHTML = `<div class="empty-appt">No appointments for this date.</div>`;
    return;
  }

  $('appt-list').innerHTML = appts.map(a => {
    // ── NEW: Extract Demographics with Colored Gender ────────
    // ── NEW: Extract Demographics with Colored Gender ────────
    const pat = a.patient_id ? state.allPatients.find(p => String(p.id) === String(a.patient_id)) : null;
    let demoStr = '';
    if (pat) {
      // 1. Age as Amber Pill
      const age = pat.age
        ? `<span style="background:#fffbeb; color:#d97706; border:1px solid #fde68a; padding:1px 6px; border-radius:100px; font-weight:800; font-size:10px; letter-spacing:0.05em;">${pat.age}Y</span>`
        : '';

      // 2. Gender as Colored Pill
      let genderStr = '';
      if (pat.gender) {
        const g = pat.gender.charAt(0).toUpperCase();
        const gColor = g === 'M' ? '#2563eb' : (g === 'F' ? '#db2777' : '#7c3aed');
        const gBg = g === 'M' ? '#eff6ff' : (g === 'F' ? '#fdf2f8' : '#f5f3ff');
        const gBorder = g === 'M' ? '#bfdbfe' : (g === 'F' ? '#fbcfe8' : '#ddd6fe');
        genderStr = `<span style="color:${gColor}; background:${gBg}; border:1px solid ${gBorder}; padding:1px 6px; border-radius:100px; font-weight:800; font-size:10px;">${g}</span>`;
      }

      // Combine them side-by-side
      if (age || genderStr) {
        demoStr = `<span style="display:inline-flex; align-items:center; gap:4px; margin-left:8px;">${age}${genderStr}</span>`;
      }
    }

    // ── NEW: Mobile Number Tag (Colored) ───────────────────
    const mobileTag = a.mobile
      ? `<div style="font-size:10px; color:var(--secondary); font-weight:600; background:var(--secondary-l); padding:2px 6px; border-radius:4px; display:flex; align-items:center; gap:3px;">
          <svg viewBox="0 0 14 14" fill="none" width="10" height="10"><rect x="3" y="1" width="8" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="11" r="0.7" fill="currentColor"/></svg>
          ${a.mobile}
         </div>`
      : '';
    // ───────────────────────────────────────────────────────
    // ───────────────────────────────────────────────────────

    // ... inside renderAppointmentPanel ...
    return `
      <div class="appt-item" data-appt-id="${a.id}">
        <div class="appt-time-pill">
          ${(a.slot_time || '—').replace(' - ', '<br><span style="color:var(--text-faint);font-size:8px;">to</span><br>')}
        </div>
        
        <div style="flex:1; min-width:0;">
          <div class="appt-name" style="display:flex; align-items:center; flex-wrap:wrap;">
            ${esc(a.patient_name)} ${demoStr}
          </div>
          <div style="display:flex; gap:10px; align-items:center; margin-top:3px;">
            <div class="appt-doc">${a.doctor ? `Dr. ${esc(a.doctor)}` : a.visit_type || ''}</div>
            ${mobileTag}
          </div>
        </div>
        <div class="appt-status-dot ${a.status || 'WAITING'}"></div>
      </div>
    `;
  }).join('');
}

// ─── PATIENT SEARCH (reusable) ─────────────────────────
function bindPatientSearch(inputId, resultsId, onSelect) {
  const input = $(inputId);
  const results = $(resultsId);
  let timer;

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { results.classList.remove('show'); return; }

      const matches = state.allPatients.filter(p =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.mobile || '').includes(q) ||
        (p.patient_id || '').toLowerCase().includes(q)
      ).slice(0, 6);

      if (!matches.length) {
        results.innerHTML = `<div class="ps-item"><span style="color:var(--text-faint);font-size:12px">No patients found</span></div>`;
      } else {
        results.innerHTML = matches.map(p => `
          <div class="ps-item" data-pid="${p.id}" data-name="${esc(p.full_name)}" data-mobile="${p.mobile || ''}" data-patid="${p.patient_id || ''}">
            <div class="ps-avatar">${(p.full_name || '?')[0].toUpperCase()}</div>
            <div>
              <div class="ps-name">${esc(p.full_name)}</div>
              <div class="ps-meta">${p.patient_id || `#${p.id}`} · ${p.mobile || 'No mobile'}</div>
            </div>
          </div>`).join('');
        results.querySelectorAll('.ps-item[data-pid]').forEach(item => {
          item.addEventListener('click', () => {
            onSelect({ id: item.dataset.pid, name: item.dataset.name, mobile: item.dataset.mobile, patient_id: item.dataset.patid });
            results.classList.remove('show');
            input.value = '';
          });
        });
      }
      results.classList.add('show');
    }, 200);
  });

  input.addEventListener('blur', () => setTimeout(() => results.classList.remove('show'), 200));
}

// ─── BIND EVENTS ───────────────────────────────────────
function bindEvents() {
  // Walk-in modal
  $('open-walkin-btn').addEventListener('click', openWalkinModal);
  $('close-walkin').addEventListener('click', () => closeModal('walkin-modal'));
  $('cancel-walkin').addEventListener('click', () => closeModal('walkin-modal'));
  $('walkin-modal').addEventListener('click', e => { if (e.target === $('walkin-modal')) closeModal('walkin-modal'); });
  $('walkin-form').addEventListener('submit', handleWalkinSubmit);

  // Appointment modal
  $('open-appt-btn').addEventListener('click', openApptModal);
  $('close-appt').addEventListener('click', () => closeModal('appt-modal'));
  $('cancel-appt').addEventListener('click', () => closeModal('appt-modal'));
  $('appt-modal').addEventListener('click', e => { if (e.target === $('appt-modal')) closeModal('appt-modal'); });
  $('appt-form').addEventListener('submit', handleApptSubmit);

  // Serve modal
  $('close-serve').addEventListener('click', () => closeModal('serve-modal'));
  $('cancel-serve').addEventListener('click', () => closeModal('serve-modal'));
  $('serve-form').addEventListener('submit', handleServeSubmit);

  // Filters
  $('filter-status').addEventListener('change', e => { state.filterStatus = e.target.value; applyQueueFilters(); });
  $('filter-type').addEventListener('change', e => { state.filterType = e.target.value; applyQueueFilters(); });
  $('refresh-queue-btn').addEventListener('click', () => { loadAll(); toast('info', 'Refreshed'); });
  $('start-queue-btn').addEventListener('click', handleNextPatient);

  // Mini calendar nav
  $('cal-prev').addEventListener('click', () => {
    state.calMonth--; if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
    renderMiniCalendar();
  });
  $('cal-next').addEventListener('click', () => {
    state.calMonth++; if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
    renderMiniCalendar();
  });

  // Mini calendar day click
  $('cal-grid').addEventListener('click', e => {
    const d = e.target.closest('.cal-day[data-date]');
    if (!d || d.classList.contains('cal-empty')) return;
    state.selectedCalDate = d.dataset.date;
    loadAppointments();
  });

  // Appt calendar nav
  $('appt-cal-prev').addEventListener('click', () => {
    state.apptCalMonth--; if (state.apptCalMonth < 0) { state.apptCalMonth = 11; state.apptCalYear--; }
    renderBigCalendar();
  });
  $('appt-cal-next').addEventListener('click', () => {
    state.apptCalMonth++; if (state.apptCalMonth > 11) { state.apptCalMonth = 0; state.apptCalYear++; }
    renderBigCalendar();
  });

  // Appt calendar day click
  $('appt-cal-grid').addEventListener('click', e => {
    const d = e.target.closest('.cal-day[data-appt-date]');
    if (!d || d.classList.contains('cal-empty') || d.classList.contains('cal-past')) return;
    state.apptSelectedDate = d.dataset.apptDate;
    $('af-date').value = state.apptSelectedDate;
    $('appt-selected-date-label').textContent = new Date(state.apptSelectedDate + 'T00:00:00')
      .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    renderBigCalendar();
  });

  // Queue list actions (delegated)
  // Queue list actions (delegated)
  $('queue-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const id = parseInt(btn.dataset.id);
    const act = btn.dataset.action;

    if (act === 'call') callPatient(id);

    // ── UPGRADED: Small "Done" button auto-advances the queue
    if (act === 'complete') {
      state.autoCallNext = true;
      openServeModal(id);
    }

    // ── UPGRADED: Small "No-show" button auto-advances the queue
    // ── UPGRADED: Small "No-show" button auto-advances without flickering
    if (act === 'noshow') {
      // 1. Turn on the memory flag BEFORE we process the no-show so the button stays blue
      state.autoCallNext = true;
      updateQueueButtonState();

      queueAction(id, 'noshow').then(() => {
        toast('warning', 'Marked no-show');

        // Wait half a second, then call the next person automatically
        setTimeout(async () => {
          const waiting = state.queue.filter(x => x.status === 'WAITING');
          if (waiting.length > 0) {
            await queueAction(waiting[0].id, 'call');
          }
          // 2. Turn off the flag after the next person is successfully called
          state.autoCallNext = false;
          updateQueueButtonState();
        }, 400);
      });
    }

    if (act === 'miss') queueAction(id, 'miss').then(() => toast('warning', 'Moved to missed'));
    if (act === 'requeue') queueAction(id, 'requeue').then(() => toast('info', 'Re-queued at end'));
    if (act === 'remove') confirmAction('🗑️', 'Remove from queue?', 'This will permanently remove this entry.', () => queueAction(id, 'remove'));
  });

  // Appointment panel click → inject into queue
  $('appt-list').addEventListener('click', e => {
    const item = e.target.closest('.appt-item[data-appt-id]');
    if (!item) return;
    const apptId = item.dataset.apptId;
    const appt = state.appointments.find(a => String(a.id) === apptId);
    if (appt && appt.status === 'WAITING') injectAppointmentToQueue(appt);
  });

  // Patient search bindings
  bindPatientSearch('walkin-patient-search', 'walkin-search-results', p => {
    state.selectedWalkinPatient = p;
    $('wf-patient-id').value = p.id;
    $('wf-name').value = p.name;
    $('wf-mobile').value = p.mobile || '';
    $('selected-patient-chip').style.display = 'flex';
    $('selected-patient-name').textContent = p.name;
  });
  $('clear-selected-patient').addEventListener('click', () => {
    state.selectedWalkinPatient = null;
    $('wf-patient-id').value = '';
    $('selected-patient-chip').style.display = 'none';
  });

  bindPatientSearch('appt-patient-search', 'appt-search-results', p => {
    state.selectedApptPatient = p;
    $('af-patient-id').value = p.id;
    $('af-name').value = p.name;
    $('af-mobile').value = p.mobile || '';
    $('appt-selected-chip').style.display = 'flex';
    $('appt-selected-name').textContent = p.name;
  });
  $('appt-clear-patient').addEventListener('click', () => {
    state.selectedApptPatient = null;
    $('af-patient-id').value = '';
    $('appt-selected-chip').style.display = 'none';
  });

  // Confirm dialog
  $('confirm-cancel').addEventListener('click', () => { $('confirm-overlay').classList.remove('open'); state.pendingConfirm = null; });
  $('confirm-ok').addEventListener('click', () => {
    if (state.pendingConfirm) state.pendingConfirm();
    $('confirm-overlay').classList.remove('open');
    state.pendingConfirm = null;
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['walkin-modal', 'appt-modal', 'serve-modal'].forEach(id => closeModal(id));
      $('confirm-overlay').classList.remove('open');
    }
  });
}

// ─── OPEN MODALS ───────────────────────────────────────
function openWalkinModal() {
  $('walkin-form').reset();
  $('wf-patient-id').value = '';
  $('selected-patient-chip').style.display = 'none';
  state.selectedWalkinPatient = null;
  // Default start time = now
  const now = new Date();
  $('wf-start-time').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  $('walkin-modal').classList.add('open');
  setTimeout(() => $('wf-name').focus(), 100);
}

function openApptModal() {
  $('appt-form').reset();
  $('af-patient-id').value = '';
  $('appt-selected-chip').style.display = 'none';
  state.selectedApptPatient = null;
  state.apptSelectedDate = null;
  $('appt-selected-date-label').textContent = '— click a date above —';
  renderBigCalendar();
  $('appt-modal').classList.add('open');
}

function openServeModal(queueId) {
  const entry = state.queue.find(q => q.id === queueId);
  if (!entry) return;
  $('sf-queue-id').value = queueId;
  $('sf-amount').value = entry.fee || '';
  $('serve-modal-title').textContent = `Complete: ${entry.patient_name}`;
  $('serve-form').reset();
  $('sf-queue-id').value = queueId;
  $('sf-amount').value = entry.fee || '';
  $('serve-modal').classList.add('open');
}

function closeModal(id) {
  $(id).classList.remove('open');
  if (id === 'serve-modal') state.autoCallNext = false; // Reset flag if user cancels
}

// ─── CALL PATIENT ──────────────────────────────────────
async function callPatient(id) {
  const result = await queueAction(id, 'call');
  if (result?.success) {
    const entry = state.queue.find(q => q.id === id);
    toast('success', `📢 Called: ${entry?.patient_name || 'Patient'}`);
    if (result.sms_sent) toast('info', `📱 SMS queued for next ${result.sms_sent} patients`);
  }
}

// ─── START QUEUE ───────────────────────────────────────
// ─── START QUEUE / NEXT PATIENT ────────────────────────
async function handleNextPatient() {
  const ongoing = state.queue.filter(x => ['CALLED', 'SERVING'].includes(x.status));
  const waiting = state.queue.filter(x => x.status === 'WAITING');

  if (ongoing.length > 0) {
    // 1. Force the compulsory "Complete" form to open
    const current = ongoing[0];
    state.autoCallNext = true; // Tell the form to auto-call the next patient after saving
    openServeModal(current.id);
  } else {
    // No one is ongoing. Just start the queue normally!
    if (!waiting.length) return;
    await queueAction(waiting[0].id, 'call');
  }
}

// ─── INJECT APPOINTMENT → QUEUE ────────────────────────
async function injectAppointmentToQueue(appt) {
  try {
    const res = await fetch(`${QUEUE_API}/inject-appointment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id: appt.id }),
    });
    const data = await res.json();
    if (data.success) {
      toast('success', `📋 ${appt.patient_name} added to queue`);
      await loadAll(true);
    } else {
      toast('error', data.message || 'Failed to inject appointment');
    }
  } catch { toast('error', 'Network error'); }
}

// ─── FORM HANDLERS ─────────────────────────────────────
async function handleWalkinSubmit(e) {
  e.preventDefault();
  const name = $('wf-name').value.trim();
  if (!name) { $('wf-name').classList.add('error'); $('wf-err-name').textContent = 'Name required'; return; }
  $('wf-name').classList.remove('error');
  $('wf-err-name').textContent = '';

  const data = Object.fromEntries(new FormData($('walkin-form')));
  Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });
  if ($('wf-patient-id').value) data.patient_id = $('wf-patient-id').value;

  try {
    const res = await fetch(QUEUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, ticket_type: 'WALKIN', queue_date: today() }),
    });
    const result = await res.json();
    if (result.success) {
      toast('success', `✅ Token #${result.token_number} — ${name}`);
      closeModal('walkin-modal');
      await loadAll(true);
    } else {
      toast('error', result.message || 'Failed to add');
    }
  } catch { toast('error', 'Network error'); }
}

async function handleApptSubmit(e) {
  e.preventDefault();
  const name = $('af-name').value.trim();
  if (!name) { $('af-name').classList.add('error'); $('af-err-name').textContent = 'Name required'; return; }
  $('af-name').classList.remove('error');
  $('af-err-name').textContent = '';

  if (!state.apptSelectedDate) { toast('warning', 'Please select a date on the calendar'); return; }

  // 1. Get Dropdown Values
  const startH = parseInt($('af-start-h').value);
  const startM = parseInt($('af-start-m').value);
  const startAMPM = $('af-start-ampm').value;

  const endH = parseInt($('af-end-h').value);
  const endM = parseInt($('af-end-m').value);
  const endAMPM = $('af-end-ampm').value;

  // 2. Convert to total minutes from midnight for validation
  const toMinutes = (h, m, ampm) => {
    let hh = h === 12 ? 0 : h;
    if (ampm === 'PM') hh += 12;
    return (hh * 60) + m;
  };

  const startTotal = toMinutes(startH, startM, startAMPM);
  const endTotal = toMinutes(endH, endM, endAMPM);

  // 3. Validation: End must be after Start
  // We allow "Crossing Midnight" (e.g., 11 PM to 2 AM) 
  // We only block if it's the SAME AM/PM period or same cycle where End <= Start
  const isCrossingMidnight = (startAMPM === 'PM' && endAMPM === 'AM');

  if (!isCrossingMidnight && endTotal <= startTotal) {
    toast('error', 'End Time must be later than Start Time');
    return;
  }

  // 4. Proceed with booking
  const startTime12 = `${$('af-start-h').value}:${$('af-start-m').value} ${startAMPM}`;
  const endTime12 = `${$('af-end-h').value}:${$('af-end-m').value} ${endAMPM}`;

  const data = Object.fromEntries(new FormData($('appt-form')));
  Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });

  // Save as the range string
  data.slot_time = `${startTime12} - ${endTime12}`;

  if ($('af-patient-id').value) data.patient_id = $('af-patient-id').value;
  data.appt_date = state.apptSelectedDate;

  try {
    const res = await fetch(APPT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (result.success) {
      toast('success', `📅 Appointment booked for ${name}`);
      closeModal('appt-modal');
      await loadAll(true);
    } else {
      toast('error', result.message || 'Failed to book');
    }
  } catch {
    toast('error', 'Network error');
  }
}

async function handleServeSubmit(e) {
  e.preventDefault();
  const queueId = $('sf-queue-id').value;
  const data = Object.fromEntries(new FormData($('serve-form')));

  // 1. Capture the memory flag BEFORE we close the modal and it resets!
  const willAutoCall = state.autoCallNext && (data.status === 'DONE' || data.status === 'NOSHOW' || data.status === 'MISSED');

  const result = await queueAction(parseInt(queueId), 'complete', {
    status: data.status,
    amount_paid: data.amount_paid ? parseFloat(data.amount_paid) : 0,
    notes: data.notes,
  });

  if (result?.success) {
    const statusMsg = { DONE: '✅ Marked done', NOSHOW: '❌ Marked no-show', MISSED: '⏭ Moved to missed', SERVING: '🔄 Still serving' };
    toast('success', statusMsg[data.status] || 'Updated');

    // This naturally resets state.autoCallNext to false in the background
    closeModal('serve-modal');

    // 2. Trigger the auto-call if we captured 'true' earlier
    if (willAutoCall) {
      state.autoCallNext = true; // Keep the button in "Next Patient" mode visually
      updateQueueButtonState();

      setTimeout(async () => {
        const waiting = state.queue.filter(x => x.status === 'WAITING');
        if (waiting.length > 0) {
          await queueAction(waiting[0].id, 'call');
        }
        state.autoCallNext = false; // Turn off the flag when done
        updateQueueButtonState();
      }, 400);
    }
  }
}

// ─── CONFIRM ───────────────────────────────────────────
function confirmAction(icon, title, msg, fn) {
  $('confirm-icon').textContent = icon;
  $('confirm-title').textContent = title;
  $('confirm-msg').textContent = msg;
  state.pendingConfirm = fn;
  $('confirm-overlay').classList.add('open');
}

// ─── TOAST ─────────────────────────────────────────────
function toast(type, message) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${esc(message)}</span>`;
  $('toast-container').appendChild(el);
  setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 220); }, 3500);
}

// ─── UTILS ─────────────────────────────────────────────
function esc(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }