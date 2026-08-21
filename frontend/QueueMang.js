// ═══════════════════════════════════════════════════════
// QueueMang.js — Queue Management Frontend
// ═══════════════════════════════════════════════════════

const API_BASE = '';
const QUEUE_API = `${API_BASE}/api/queue`;
const APPT_API = `${API_BASE}/api/appointments`;
const PAT_API = `${API_BASE}/api/patients`;
const OPD_API = `${API_BASE}/api/opd`;
const DEFAULT_REFERRED_BY = 'Dr. Jayaraja Puthran';

const CLINIC_INFO = {
  name: 'Jai Ganesh Nursing Home',
  sub: 'Medical, Surgical, Orthopaedic Trauma Centre',
  regNo: 'Hosp. Reg. No. TMC / Zone - A / 579',
  address: 'R.S.C. 15, Plot No. 67/68, Opp. Louis Bldg., Veer Savarkar Nagar, Thane (W) - 400 606.',
  mobile: '9321467944',
  doctorQualification: 'M.B.B.S., D. Ortho. (C.P.S. Bombay)',
  doctorSpecialty: 'Bone Fracture Specialist · Trauma and Spine Specialist',
  doctorRegNo: 'Reg. No. 77425',
};

// Dropdown option sets for the Prescription / Medicines rows (real <select> — not
// suggestion-only datalists — so the field always shows a fixed picklist; "Other"
// reveals a text box for anything not on the list).
const MED_NAME_OPTIONS = [
  'Paracetamol 500mg', 'Ibuprofen 400mg', 'Diclofenac 50mg', 'Aceclofenac + Paracetamol',
  'Etoricoxib 90mg', 'Tramadol 50mg', 'Calcium + Vitamin D3', 'Methylcobalamin',
  'Pantoprazole 40mg', 'Chymoral Forte',
];
// Ortho prescriptions are dosed by tablet/capsule/injection count (strength is
// already in the medicine name, e.g. "Paracetamol 500mg") — no liquid/ml doses.
const MED_DOSE_OPTIONS = [
  '1 tablet', '2 tablets', '1 capsule', '1 injection', 'Apply locally', '1 drop', '2 drops',
];
const MED_FREQUENCY_OPTIONS = [
  '1-0-0', '0-1-0', '0-0-1', '1-1-1', '1-0-1', '1-1-0', '0-1-1',
  'Once daily', 'Twice daily', 'Thrice daily', 'Every 6 hours', 'Every 8 hours', 'SOS (as needed)', 'Stat',
];
const MED_DURATION_OPTIONS = [
  '3 days', '5 days', '7 days', '10 days', '14 days', '1 month', 'Until finished', 'SOS (as needed)',
];
const MED_ROUTE_OPTIONS = [
  'Oral', 'Topical', 'IV', 'IM', 'Subcutaneous', 'Inhalation', 'Eye drops', 'Ear drops', 'Nasal',
];
const MED_INSTRUCTION_OPTIONS = [
  'After food', 'Before food', 'With food', 'Empty stomach', 'At bedtime', 'Before breakfast', 'As needed (SOS)',
];

// Common investigations for an Ortho / Bone Fracture / Trauma & Spine practice, plus general labs.
// X-Ray and CBC lead the list since they're the most frequently ordered — everything
// else is a searchable suggestion via the datalist, and typing anything not listed
// here is saved (via /api/opd/options) so it shows up as a suggestion for the next patient too.
const INVESTIGATION_OPTIONS = [
  'X-Ray', 'CBC', 'MRI', 'CT Scan', 'Bone Density (DEXA)', 'Ultrasound',
  'Blood Sugar (Fasting/PP)', 'HbA1c', 'ESR/CRP', 'Serum Calcium', 'Vitamin D', 'ECG',
];

// What "Detail / Area" actually means depends on which investigation was picked —
// an X-Ray/MRI/CT needs a body part, a blood test needs a sample condition, etc.
// Matches the real workload of an Ortho / Bone Fracture / Trauma & Spine practice.
// Anything the doctor needs beyond this list can still be typed in manually.
const INVESTIGATION_DETAIL_OPTIONS = {
  'X-Ray': [
    'Right Knee', 'Left Knee', 'Both Knees', 'Right Knee (Weight-bearing)', 'Left Knee (Weight-bearing)',
    'Right Shoulder', 'Left Shoulder', 'Right Hip', 'Left Hip', 'Pelvis with Both Hips',
    'Right Ankle', 'Left Ankle', 'Right Foot', 'Left Foot', 'Right Wrist', 'Left Wrist',
    'Right Elbow', 'Left Elbow', 'Right Hand', 'Left Hand', 'Right Forearm', 'Left Forearm',
    'Right Leg (Tibia-Fibula)', 'Left Leg (Tibia-Fibula)', 'Right Femur', 'Left Femur',
    'Cervical Spine', 'Dorsal (Thoracic) Spine', 'Lumbosacral Spine', 'Whole Spine (Scoliosis Series)', 'Chest',
  ],
  'MRI': [
    'Right Knee (without contrast)', 'Left Knee (without contrast)', 'Right Shoulder', 'Left Shoulder',
    'Right Hip', 'Left Hip', 'Right Ankle', 'Left Ankle', 'Right Wrist', 'Left Wrist',
    'Cervical Spine', 'Dorsal Spine', 'Lumbosacral Spine (LS Spine, Screening)',
  ],
  'CT Scan': [
    'Right Knee', 'Left Knee', 'Right Hip', 'Left Hip', 'Pelvis',
    'Right Ankle (3D Reconstruction)', 'Left Ankle (3D Reconstruction)',
    'Right Wrist (Scaphoid View)', 'Left Wrist (Scaphoid View)',
    'Cervical Spine', 'Lumbosacral Spine', 'Whole Spine (3D Reconstruction)',
  ],
  'Bone Density (DEXA)': ['Lumbar Spine + Hip (Standard)', 'Forearm', 'Whole Body'],
  'Ultrasound': [
    'Right Shoulder (Rotator Cuff)', 'Left Shoulder (Rotator Cuff)', 'Right Knee', 'Left Knee',
    'Soft Tissue Swelling', 'Doppler — Lower Limb (DVT Screening)',
  ],
  'CBC': ['Fasting Sample', 'Random Sample'],
  'Blood Sugar (Fasting/PP)': ['Fasting', 'Post-Prandial (PP)', 'Random'],
  'HbA1c': ['Fasting Sample'],
  'ESR/CRP': ['Fasting Sample', 'Random Sample'],
  'Serum Calcium': ['Fasting Sample'],
  'Vitamin D': ['Fasting Sample'],
  'ECG': ['Resting ECG', 'Pre-operative ECG'],
};

// Generic starting suggestions for the Instruction field — also scoped per
// investigation type (same combination idea as Detail/Area), grows from there.
const INVESTIGATION_INSTRUCTION_OPTIONS = {
  'X-Ray': ['Get done before next visit', 'Weight-bearing view required'],
  'MRI': ['Get done before next visit', 'Only if X-ray shows severe changes'],
};

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
  queueDate: today(), // The date the Live Queue is currently viewing/adding to
  apptSelectedDate: null,
  selectedWalkinPatient: null,
  selectedApptPatient: null,
  filterStatus: '',
  filterType: '',
  pendingConfirm: null,
  autoRefreshTimer: null,
  autoCallNext: false,
  investigationOptions: [...INVESTIGATION_OPTIONS],
  medicineOptions: [...MED_NAME_OPTIONS],
  medDoseOptions: [...MED_DOSE_OPTIONS],
  medFrequencyOptions: [...MED_FREQUENCY_OPTIONS],
  medDurationOptions: [...MED_DURATION_OPTIONS],
  medRouteOptions: [...MED_ROUTE_OPTIONS],
  medInstructionOptions: [...MED_INSTRUCTION_OPTIONS],
  // Keyed by investigation type, e.g. { 'X-Ray': ['Right Knee', ...] } — cloned
  // per-array so growing one doesn't mutate the shared defaults constant.
  investigationDetailOptions: Object.fromEntries(Object.entries(INVESTIGATION_DETAIL_OPTIONS).map(([k, v]) => [k, [...v]])),
  investigationInstructionOptions: Object.fromEntries(Object.entries(INVESTIGATION_INSTRUCTION_OPTIONS).map(([k, v]) => [k, [...v]])),
};





// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  loadAll();
  bindEvents();
  bindTextareaAutosize();
  loadCustomOptions();
  // Auto-refresh every 30 seconds
  state.autoRefreshTimer = setInterval(() => loadAll(true), 30000);
});

// ─── Custom Investigation / Medicine options ────────────
// Anything typed in that isn't on the built-in list gets remembered server-side
// (see /api/opd/options) so it shows up as a dropdown suggestion for the next patient too.
// Flat (global) categories → the state array each one grows.
const FLAT_OPTION_CATEGORIES = {
  investigation: 'investigationOptions',
  medicine: 'medicineOptions',
  medicine_dose: 'medDoseOptions',
  medicine_frequency: 'medFrequencyOptions',
  medicine_duration: 'medDurationOptions',
  medicine_route: 'medRouteOptions',
  medicine_instruction: 'medInstructionOptions',
};
// Context-scoped categories (value depends on the investigation type it was
// entered under) → the state map each one grows.
const CONTEXT_OPTION_CATEGORIES = {
  investigation_detail: 'investigationDetailOptions',
  investigation_instruction: 'investigationInstructionOptions',
};

async function loadCustomOptions() {
  try {
    const flatEntries = Object.entries(FLAT_OPTION_CATEGORIES);
    const flatResults = await Promise.all(flatEntries.map(([cat]) => fetch(`${OPD_API}/options/${cat}`).then(r => r.json())));
    flatResults.forEach((data, idx) => {
      const stateKey = flatEntries[idx][1];
      (data.values || []).forEach(v => addOptionIfNew(stateKey, v));
    });

    const contextEntries = Object.entries(CONTEXT_OPTION_CATEGORIES);
    const contextResults = await Promise.all(contextEntries.map(([cat]) => fetch(`${OPD_API}/options/${cat}/by-context`).then(r => r.json())));
    contextResults.forEach((data, idx) => {
      const stateKey = contextEntries[idx][1];
      Object.entries(data.grouped || {}).forEach(([ctx, values]) => {
        values.forEach(v => addContextOptionIfNew(stateKey, ctx, v));
      });
    });
  } catch (e) { console.error('[Options] load failed', e); }
}

function addOptionIfNew(stateKey, value) {
  if (!value) return;
  const exists = state[stateKey].some(o => o.toLowerCase() === value.toLowerCase());
  if (!exists) state[stateKey].push(value);
}

function addContextOptionIfNew(stateKey, context, value) {
  if (!value || !context) return;
  const map = state[stateKey];
  if (!map[context]) map[context] = [];
  const exists = map[context].some(o => o.toLowerCase() === value.toLowerCase());
  if (!exists) map[context].push(value);
}

function saveCustomOption(category, value, context) {
  fetch(`${OPD_API}/options`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, value, context }),
  }).catch(e => console.error('[Options] save failed', e));
}

// Called after an OPD/investigation save — remembers every newly typed
// medicine/investigation field value so future patients see it as a suggestion.
function syncCustomOptions(medicines = [], investigations = []) {
  const flatFieldToCategory = {
    name: 'medicine', dose: 'medicine_dose', frequency: 'medicine_frequency',
    duration: 'medicine_duration', route: 'medicine_route', instruction: 'medicine_instruction',
  };
  medicines.forEach(m => {
    Object.entries(flatFieldToCategory).forEach(([field, category]) => {
      const value = m[field];
      const stateKey = FLAT_OPTION_CATEGORIES[category];
      if (value && !state[stateKey].some(o => o.toLowerCase() === value.toLowerCase())) {
        state[stateKey].push(value);
        saveCustomOption(category, value);
      }
    });
  });

  investigations.forEach(i => {
    if (i.type && !state.investigationOptions.some(o => o.toLowerCase() === i.type.toLowerCase())) {
      state.investigationOptions.push(i.type);
      saveCustomOption('investigation', i.type);
    }
    // Detail/Instruction are remembered as a pair with the investigation type
    // they were entered under (X-Ray → "Right Knee"), not as a flat global list.
    if (i.type && i.detail) addContextOptionIfNew('investigationDetailOptions', i.type, i.detail);
    if (i.type && i.detail && !(INVESTIGATION_DETAIL_OPTIONS[i.type] || []).some(o => o.toLowerCase() === i.detail.toLowerCase())) {
      saveCustomOption('investigation_detail', i.detail, i.type);
    }
    if (i.type && i.instruction) addContextOptionIfNew('investigationInstructionOptions', i.type, i.instruction);
    if (i.type && i.instruction && !(INVESTIGATION_INSTRUCTION_OPTIONS[i.type] || []).some(o => o.toLowerCase() === i.instruction.toLowerCase())) {
      saveCustomOption('investigation_instruction', i.instruction, i.type);
    }
  });
}

// ─── Searchable combobox ─────────────────────────────────
// A real dropdown (click to open, type to filter, click a row to pick) instead
// of the browser's plain native <datalist> suggestion popup — while still
// letting the doctor type any value that isn't on the list.
let comboCloseHandlerBound = false;
function initCombobox(input, getOptions) {
  const wrap = input.closest('.combo-wrap');
  const panel = wrap.querySelector('.combo-panel');

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'combo-clear';
  clearBtn.textContent = '✕';
  clearBtn.title = 'Clear';
  clearBtn.addEventListener('mousedown', e => {
    e.preventDefault(); // don't steal focus from the input before we clear it
    input.value = '';
    input.focus();
    render();
  });
  input.insertAdjacentElement('afterend', clearBtn);

  const render = () => {
    const q = input.value.trim().toLowerCase();
    const options = getOptions().filter(o => !q || o.toLowerCase().includes(q));
    if (!options.length) {
      panel.innerHTML = '<div class="combo-empty">No matches — keep typing to add a new one</div>';
    } else {
      panel.innerHTML = options.map(o => `<div class="combo-option">${escapeAttr(o)}</div>`).join('');
    }
    panel.querySelectorAll('.combo-option').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault(); // keep focus so the click registers before blur closes the panel
        input.value = el.textContent;
        closeCombo();
      });
    });
  };
  const openCombo = () => { render(); panel.classList.add('open'); };
  const closeCombo = () => panel.classList.remove('open');

  input.addEventListener('focus', openCombo);
  input.addEventListener('input', openCombo);
  input.addEventListener('blur', () => setTimeout(closeCombo, 120));

  // One delegated escape-key handler for all comboboxes, bound once.
  if (!comboCloseHandlerBound) {
    comboCloseHandlerBound = true;
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.combo-panel.open').forEach(p => p.classList.remove('open'));
    });
  }
}

// ─── Auto-growing textareas ─────────────────────────────
// Every textarea grows with its content up to a cap, then scrolls internally —
// this keeps a long note from pushing the modal's footer buttons off-screen.
const TEXTAREA_MAX_HEIGHT = 180;
function autosizeTextarea(el) {
  el.style.height = 'auto';
  const target = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
  el.style.height = `${target}px`;
  el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
}

function refreshAllTextareaSizes() {
  document.querySelectorAll('textarea').forEach(autosizeTextarea);
}

function bindTextareaAutosize() {
  // Delegated so it also covers textareas inside modals opened later.
  document.addEventListener('input', e => {
    if (e.target.tagName === 'TEXTAREA') autosizeTextarea(e.target);
  });
}

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

// ─── LIVE QUEUE DATE NAVIGATION ────────────────────────
// Lets the doctor/reception browse (and add walk-ins to) any date, not just
// today — e.g. to check whether a patient's history from a past visit shows
// up correctly on a later date, without relying on the system clock.
function shiftQueueDate(deltaDays) {
  const d = new Date(state.queueDate + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  state.queueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  $('queue-date-input').value = state.queueDate;
  updateQueueDateNavUI();
  loadAll();
}

function updateQueueDateNavUI() {
  const isToday = state.queueDate === today();
  $('queue-date-input').closest('.queue-date-nav')?.classList.toggle('not-today', !isToday);
  $('queue-date-today').style.display = isToday ? 'none' : '';
}

// ─── LOAD QUEUE ────────────────────────────────────────
async function loadQueue(silent = false) {
  try {
    const res = await fetch(`${QUEUE_API}?date=${state.queueDate}`);
    
    // 👇 NEW: Check if the server is actually responding!
    if (!res.ok) {
      console.error(`HTTP Error: ${res.status} - Server might be down or crashed.`);
      throw new Error('Server offline or returned an error.');
    }
    
    const data = await res.json();
    if (data.success) {
      state.queue = data.queue || [];
      applyQueueFilters();
    } else {
      console.error("Backend returned false success:", data.message);
    }
  } catch (e) {
    console.error("Load Queue Crash Details:", e);
    if (!silent) toast('error', 'Failed to load queue. Check server terminal!');
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
        <p>No queue entries${state.filterStatus || state.filterType ? ' for this filter.' : (state.queueDate === today() ? ' today.' : ` for ${state.queueDate}.`)}</p>
      </div>`;
    return;
  }

  // Group into sections
  const pending = list.filter(x => x.status === 'WAITING');
  const ongoing = list.filter(x => ['CALLED', 'SERVING'].includes(x.status));
  const onHold = list.filter(x => x.status === 'HOLD');
  const completed = list.filter(x => ['DONE', 'NOSHOW', 'MISSED'].includes(x.status));

  let html = '';

  if (ongoing.length) {
    html += `<div class="queue-section-label ongoing-label">
      <span class="qs-dot ongoing-dot"></span>Ongoing (${ongoing.length})
    </div>`;
    html += ongoing.map((q, i) => queueCardHtml(q, i)).join('');
  }

  if (onHold.length) {
    html += `<div class="queue-section-label ongoing-label" style="color:#7c3aed;">
      <span class="qs-dot" style="background:#7c3aed;"></span>On Hold — Gone for Report (${onHold.length})
    </div>`;
    html += onHold.map((q, i) => queueCardHtml(q, i)).join('');
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

  // ── Extract Demographics with Colored Gender ────────
  const pat = q.patient_id ? state.allPatients.find(p => String(p.id) === String(q.patient_id)) : null;
  let demoStr = '';
  if (pat) {
    const age = pat.age ? `<span style="background:#fffbeb; color:#d97706; border:1px solid #fde68a; padding:1px 6px; border-radius:100px; font-weight:800; font-size:10px; letter-spacing:0.05em;">${pat.age}Y</span>` : '';
    let genderStr = '';
    if (pat.gender) {
      const g = pat.gender.charAt(0).toUpperCase();
      const gColor = g === 'M' ? '#2563eb' : (g === 'F' ? '#db2777' : '#7c3aed');
      const gBg = g === 'M' ? '#eff6ff' : (g === 'F' ? '#fdf2f8' : '#f5f3ff');
      const gBorder = g === 'M' ? '#bfdbfe' : (g === 'F' ? '#fbcfe8' : '#ddd6fe');
      genderStr = `<span style="color:${gColor}; background:${gBg}; border:1px solid ${gBorder}; padding:1px 6px; border-radius:100px; font-weight:800; font-size:10px;">${g}</span>`;
    }
    if (age || genderStr) {
      demoStr = `<span style="display:inline-flex; align-items:center; gap:4px; margin-left:8px;">${age}${genderStr}</span>`;
    }
  }
  // ───────────────────────────────────────────────────────

  // ── Custom SVG action buttons ──────────────
  let actions = '';

  const btnCall = `
    <button class="qbtn qbtn-call" data-action="call" data-id="${q.id}" title="Call Patient">
      <svg viewBox="0 0 18 18" fill="none"><path d="M3 5a2 2 0 0 1 2-2h1.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H5.5A3.5 3.5 0 0 0 9 10.5h0a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V12a2 2 0 0 1-2 2C6.134 14 3 10.866 3 7V5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
    </button>`;

  const btnSkip = `
    <button class="qbtn qbtn-skip" data-action="miss" data-id="${q.id}" title="Mark Missed">
      <svg viewBox="0 0 18 18" fill="none"><path d="M4 9h7M14 6l-3 3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

  const btnRemove = `
    <button class="qbtn qbtn-del" data-action="remove" data-id="${q.id}" title="Remove from Queue">
      <svg viewBox="0 0 18 18" fill="none"><path d="M3 5h12M7 5V3h4v2M6 5v9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5H6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

  const btnDone = `
    <button class="qbtn qbtn-done" data-action="complete" data-id="${q.id}" title="Complete / Mark Done">
      <svg viewBox="0 0 18 18" fill="none"><path d="M4 9.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

  const btnNoshow = `
    <button class="qbtn qbtn-noshow" data-action="noshow" data-id="${q.id}" title="Mark No-show">
      <svg viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M6 12l6-6M12 12L6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
    </button>`;

  // 👇 The missing btnRequeue is back! 👇
  const btnRequeue = `
    <button class="qbtn qbtn-requeue" data-action="requeue" data-id="${q.id}" title="Re-queue at End">
      <svg viewBox="0 0 18 18" fill="none"><path d="M2 9a7 7 0 1 0 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2 5v4h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

  const btnReopen = `
    <button class="qbtn qbtn-call" style="background:#eff6ff; color:#2563eb;" data-action="complete" data-id="${q.id}" title="View Details / Book Follow-up">
      <svg viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

  const btnResume = `
    <button class="qbtn qbtn-requeue" style="background:#f5f3ff; color:#7c3aed;" data-action="resume" data-id="${q.id}" title="Back with report — return to Waiting">
      <svg viewBox="0 0 18 18" fill="none"><path d="M4 9h7M8 5l3 4-3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>`;

  const btnReport = `
    <button class="qbtn qbtn-call" style="background:#f0fdf9; color:#0f766e;" data-action="report" data-id="${q.id}" title="Add investigation report">
      <svg viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M6 6h6M6 9h6M6 12h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
    </button>`;

  if (q.status === 'WAITING') {
    actions = btnCall + btnSkip + btnRemove;
  } else if (q.status === 'CALLED' || q.status === 'SERVING') {
    actions = btnDone + btnNoshow;
  } else if (q.status === 'HOLD') {
    actions = btnReport + btnResume + btnRemove;
  } else if (q.status === 'MISSED') {
    actions = btnRequeue + btnRemove;
  } else if (q.status === 'DONE' || q.status === 'NOSHOW') {
    actions = btnReopen;
  }

  const priorityTag = q.priority !== 'NORMAL'
    ? `<span class="priority-chip priority-${q.priority}">${q.priority === 'EMERGENCY' ? 'EMERG' : 'VIP'}</span>`
    : '';

  const amountTag = q.amount_paid > 0
    ? `<span class="qmeta-item fee-paid">₹${q.amount_paid}</span>`
    : (q.fee > 0 ? `<span class="qmeta-item fee-pending">₹${q.fee}</span>` : '');

  const holdTag = q.status === 'HOLD' && q.hold_reason
    ? `<span class="qmeta-item" style="color:#7c3aed; background:#f5f3ff; padding:2px 6px; border-radius:4px;" title="${esc(q.hold_reason)}">⏸ ${esc(q.hold_reason)}</span>`
    : '';

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
          ${holdTag}
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
  return { WAITING: 'Waiting', CALLED: 'Called', SERVING: 'Serving', HOLD: 'On Hold', DONE: 'Done', NOSHOW: 'No-show', MISSED: 'Missed' }[s] || s;
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
  $('opd-hold-btn').addEventListener('click', handleHoldVisit);

  // OPD modal
  $('close-opd-modal').addEventListener('click', () => closeModal('opd-modal'));
  $('cancel-opd-modal').addEventListener('click', () => closeModal('opd-modal'));
  $('opd-modal').addEventListener('click', e => { if (e.target === $('opd-modal')) closeModal('opd-modal'); });
  $('opd-inline-form').addEventListener('submit', handleOpdInlineSubmit);
  $('opd-add-med-btn').addEventListener('click', () => addMedicineRow());
  $('opd-add-invest-btn').addEventListener('click', () => addInvestigationRow('opd-invest-list'));
  $('opd-print-btn').addEventListener('click', handleOpdPrint);
  // Quick shortcut for "go get an X-Ray/MRI/labs done" — opens the compact
  // investigations popup on top of the OPD modal without needing to fill the
  // full record first.
  $('opd-quick-invest-btn').addEventListener('click', () => {
    const queueId = parseInt($('of2-queue-entry-id').value);
    const entry = state.queue.find(q => q.id === queueId);
    if (entry) openInvestModal(entry);
  });
  // Once the doctor edits an auto-filled vital, it's now this visit's confirmed reading.
  document.querySelectorAll('#opd-inline-form .opd-vital-box input').forEach(input => {
    input.addEventListener('input', () => input.classList.remove('autofilled'));
  });
  ['of2-history', 'of2-prev-illness', 'of2-signs', 'of2-diagnosis', 'of2-invest-prev', 'of2-advice']
    .forEach(id => bindAdviceBullets(id));

  // Investigations modal (quick)
  $('close-invest-modal').addEventListener('click', () => closeModal('invest-modal'));
  $('cancel-invest-modal').addEventListener('click', () => closeModal('invest-modal'));
  $('invest-modal').addEventListener('click', e => { if (e.target === $('invest-modal')) closeModal('invest-modal'); });
  $('invest-add-btn').addEventListener('click', () => addInvestigationRow('invest-quick-list', {}, { showComment: false }));
  $('invest-save-btn').addEventListener('click', handleInvestSave);
  $('invest-print-btn').addEventListener('click', handleInvestPrint);

  // Filters
  $('filter-status').addEventListener('change', e => { state.filterStatus = e.target.value; applyQueueFilters(); });
  $('filter-type').addEventListener('change', e => { state.filterType = e.target.value; applyQueueFilters(); });
  $('refresh-queue-btn').addEventListener('click', () => { loadAll(); toast('info', 'Refreshed'); });
  $('start-queue-btn').addEventListener('click', handleNextPatient);

  // Live Queue date navigation — browse/add to any date, not just today
  $('queue-date-input').value = state.queueDate;
  updateQueueDateNavUI();
  $('queue-date-input').addEventListener('change', e => {
    if (!e.target.value) return;
    state.queueDate = e.target.value;
    updateQueueDateNavUI();
    loadAll();
  });
  $('queue-date-prev').addEventListener('click', () => shiftQueueDate(-1));
  $('queue-date-next').addEventListener('click', () => shiftQueueDate(1));
  $('queue-date-today').addEventListener('click', () => {
    state.queueDate = today();
    $('queue-date-input').value = state.queueDate;
    updateQueueDateNavUI();
    loadAll();
  });

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
 // Queue list actions (delegated)
  $('queue-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      // Clicking anywhere on the card (not a button) does the same thing as
      // its primary action button — call/open the record without having to
      // aim for the small icon buttons.
      const card = e.target.closest('.queue-card');
      if (!card) return;
      const id = parseInt(card.dataset.id);
      const entry = state.queue.find(q => q.id === id);
      if (!entry) return;
      if (entry.status === 'WAITING') callPatient(id);
      else if (entry.status === 'CALLED' || entry.status === 'SERVING') { state.autoCallNext = true; openOpdModal(entry); }
      else if (entry.status === 'HOLD') openInvestModal(entry);
      else if (entry.status === 'MISSED') queueAction(id, 'requeue').then(() => toast('info', 'Re-queued at end'));
      else if (entry.status === 'DONE' || entry.status === 'NOSHOW') { state.autoCallNext = false; openServeModal(id); }
      return;
    }
    e.stopPropagation();
    const id = parseInt(btn.dataset.id);
    const act = btn.dataset.action;

    if (act === 'call') callPatient(id);

    // Doctor vs staff separation: an ongoing (CALLED/SERVING) patient goes straight
    // to the doctor's Full OPD Record — clinical entry only, no billing fields.
    // A DONE/NOSHOW/MISSED patient instead opens the staff billing/outcome editor,
    // so reception can fill in Amount Paid and book the follow-up afterwards.
    if (act === 'complete') {
      const entry = state.queue.find(q => q.id === id);
      if (!entry) return;

      if (entry.status === 'CALLED' || entry.status === 'SERVING') {
        state.autoCallNext = true;
        openOpdModal(entry);
      } else {
        state.autoCallNext = false;
        openServeModal(id);
      }
    }

    // Investigation report entry for a patient on Hold — lets staff/doctor record
    // the report comment without opening the full OPD form.
    if (act === 'report') {
      const entry = state.queue.find(q => q.id === id);
      if (entry) openInvestModal(entry);
    }

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
    if (act === 'resume') queueAction(id, 'resume').then(() => toast('success', '▶ Back from investigation — returned to Waiting'));
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

// 👇 Instant Follow-up Booking Logic 👇
  const bookFollowupBtn = $('btn-book-followup');
  if (bookFollowupBtn) {
    bookFollowupBtn.addEventListener('click', async () => {
      const dateField = $('sf-followup');
      const dateVal = dateField.value;
      if (!dateVal) return toast('warning', 'Please select a date first');

      const selectedDate = new Date(dateVal);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        return toast('error', 'You cannot book an appointment in the past!');
      }

      const queueId = parseInt($('sf-queue-id').value);
      const entry = state.queue.find(q => q.id === queueId);

      if (!entry || !entry.patient_id) {
        return toast('error', 'Cannot book: Patient ID is missing. Is this an unregistered walk-in?');
      }

      try {
        bookFollowupBtn.disabled = true;
        bookFollowupBtn.textContent = 'Booking...';
        dateField.disabled = true;

        const res = await fetch(APPT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: entry.patient_id,
            patient_name: entry.patient_name,
            mobile: entry.mobile,
            appt_date: dateVal,
            visit_type: 'Follow-up',
            doctor: entry.doctor,
            notes: 'Auto-scheduled follow-up from previous visit.'
          })
        });

        const result = await res.json();
        if (result.success) {
          toast('success', `📅 Follow-up booked for ${new Date(dateVal).toLocaleDateString()}`);
          
          // 👇 NEW: Force local state to remember the date immediately!
          entry.follow_up_date = dateVal;

          bookFollowupBtn.textContent = 'Booked!';
          dateField.disabled = true;
        } else {
          toast('error', result.message || 'Failed to book');
          bookFollowupBtn.disabled = false;
          bookFollowupBtn.textContent = 'Book';
          dateField.disabled = false;
        }
      } catch (err) {
        toast('error', 'Network error');
        bookFollowupBtn.disabled = false;
        bookFollowupBtn.textContent = 'Book';
        dateField.disabled = false;
      }
    });
  }
  // 👆 END LOGIC 👆

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
  $('walkin-modal-sub').textContent = state.queueDate === today()
    ? 'Search existing patient or enter quick details'
    : `Adding to the queue for ${state.queueDate} — search existing patient or enter quick details`;
  $('walkin-modal').classList.add('open');
  setTimeout(() => $('wf-name').focus(), 100);
  refreshAllTextareaSizes();
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
  refreshAllTextareaSizes();
}

function openServeModal(queueId) {
  const entry = state.queue.find(q => q.id === queueId);
  if (!entry) return;

  $('sf-queue-id').value = queueId;

  // 👇 NEW: Change Title and Submit Button Text dynamically 👇
  const submitBtn = document.querySelector('#serve-form button[type="submit"]');
  if (entry.status === 'DONE' || entry.status === 'NOSHOW' || entry.status === 'MISSED') {
    $('serve-modal-title').textContent = `Edit Record: ${entry.patient_name}`;
    if (submitBtn) submitBtn.textContent = 'Update Record'; // Just updating, no queue jump
  } else {
    $('serve-modal-title').textContent = `Complete: ${entry.patient_name}`;
    if (submitBtn) submitBtn.textContent = 'Save & Next'; // Indicates the queue will advance
  }
  // 👆 END NEW 👆

  $('serve-form').reset();

  // Repopulate standard fields
  $('sf-amount').value = entry.amount_paid > 0 ? entry.amount_paid : (entry.fee || '');
  if (entry.status !== 'WAITING' && entry.status !== 'CALLED') {
    $('sf-status').value = entry.status;
  }
  const dateField = $('sf-followup');
  const btnFollowup = $('btn-book-followup');

  if (dateField) {
    // Fill in the date the doctor saved
    dateField.value = entry.follow_up_date || '';
    
    // Prevent selecting past dates
    const todayStr = new Date().toISOString().split('T')[0];
    dateField.setAttribute('min', todayStr);

    // Default to UNLOCKED (Assume it's just a doctor's recommendation for now)
    dateField.disabled = false;
    if (btnFollowup) {
      btnFollowup.disabled = false;
      btnFollowup.textContent = 'Book';
    }

    // The Smart Check: Ask the backend if an appointment ACTUALLY exists!
    if (entry.follow_up_date && entry.patient_id) {
      fetch(`${APPT_API}?date=${entry.follow_up_date}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.appointments) {
            // Verify if this patient is in the appointment list for that date
            const isBooked = data.appointments.some(a => String(a.patient_id) === String(entry.patient_id));
            
            if (isBooked) {
              // It IS officially booked! Lock the UI.
              dateField.disabled = true;
              if (btnFollowup) {
                btnFollowup.disabled = true;
                btnFollowup.textContent = 'Booked!';
              }
            }
          }
        })
        .catch(err => console.error("Could not verify booking status", err));
    }
  }

  $('serve-modal').classList.add('open');
}

// ─── Quick Investigations Modal ────────────────────────
// A lightweight companion to the full OPD record: lets the doctor advise
// investigations (X-Ray, MRI, labs…) without opening the whole OPD form.
// Both modals read/write the same opd_records.investigations field, so
// whatever is selected here shows up in the full OPD record automatically —
// only the Report Comment (added once the report is back) is OPD-record-only.
async function openInvestModal(entry) {
  const pat = entry.patient_id ? state.allPatients.find(p => String(p.id) === String(entry.patient_id)) : null;

  state.investEntry = entry;
  state.investOriginal = [];
  $('iv-record-id').value = '';
  $('iv-strip-name').textContent = entry.patient_name || '—';
  $('iv-strip-mobile').textContent = entry.mobile || '—';
  $('iv-strip-age').textContent = pat?.age ? `${pat.age}Y ${pat.gender || ''}`.trim() : '—';
  clearInvestigationRows('invest-quick-list');
  $('invest-modal').classList.add('open');

  try {
    const res = await fetch(`${OPD_API}?queue_entry_id=${entry.id}`);
    const data = await res.json();
    const existing = (data.records || [])[0];
    if (existing) {
      $('iv-record-id').value = existing.id;
      let invs = [];
      try { invs = existing.investigations ? JSON.parse(existing.investigations) : []; } catch { invs = []; }
      state.investOriginal = invs;
      invs.forEach(i => addInvestigationRow('invest-quick-list', i, { showComment: false }));
    }
  } catch (e) { console.error('[Investigations] load failed', e); }

  if (!$('invest-quick-list').children.length) addDefaultInvestigationRows('invest-quick-list', { showComment: false });
}

async function handleInvestSave() {
  const entry = state.investEntry;
  if (!entry) return;

  const investigations = mergeInvestigationComments(collectInvestigations('invest-quick-list'), state.investOriginal);
  const recordId = $('iv-record-id').value;
  const payload = {
    patient_id: entry.patient_id || null,
    queue_entry_id: entry.id,
    appointment_id: entry.appointment_id || null,
    patient_name: entry.patient_name,
    mobile: entry.mobile || '',
    doctor_name: entry.doctor || DEFAULT_REFERRED_BY,
    investigations,
    investigations_advised: investigationsToText(investigations),
  };

  try {
    const res = await fetch(recordId ? `${OPD_API}/${recordId}` : OPD_API, {
      method: recordId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    if (!recordId) $('iv-record-id').value = data.id;
    state.investOriginal = investigations;
    syncCustomOptions([], investigations);

    // If the full OPD form for this same visit is open behind this popup, reflect
    // the just-saved investigations into it immediately — no reload/reopen needed.
    if ($('opd-modal').classList.contains('open') && parseInt($('of2-queue-entry-id').value) === entry.id) {
      if (!$('of2-id').value) $('of2-id').value = data.id;
      clearInvestigationRows('opd-invest-list');
      if (investigations.length) investigations.forEach(inv => addInvestigationRow('opd-invest-list', inv));
      else addInvestigationRow('opd-invest-list');
    }

    toast('success', 'Investigations saved');
    closeModal('invest-modal');
  } catch (err) {
    toast('error', err.message || 'Failed to save investigations');
  }
}

async function handleInvestPrint() {
  const entry = state.investEntry;
  if (!entry) return;
  const investigations = mergeInvestigationComments(collectInvestigations('invest-quick-list'), state.investOriginal);
  if (!investigations.length) { toast('warning', 'Add at least one investigation first'); return; }

  await handleInvestSave();
  printInvestigationAdvice({
    patient_name: entry.patient_name,
    age_gender: $('iv-strip-age').textContent !== '—' ? $('iv-strip-age').textContent : '',
    visit_date: new Date().toISOString().slice(0, 10),
    doctor_name: entry.doctor || DEFAULT_REFERRED_BY,
    investigations,
  });
}

function printInvestigationAdvice(rec) {
  const investRows = rec.investigations.map(i => `
    <tr><td>${i.type}</td><td>${i.detail || ''}</td><td>${i.instruction || ''}</td></tr>
  `).join('');

  const win = window.open('', '_blank', 'width=700,height=800');
  win.document.write(`
    <!DOCTYPE html><html><head><title>Investigation Advice — ${rec.patient_name}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; }
      .rx-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563EB; padding-bottom: 12px; margin-bottom: 16px; }
      .rx-clinic-name { font-size: 20px; font-weight: 800; color: #dc2626; margin: 0; }
      .rx-clinic-sub { font-size: 12px; color: #475569; margin: 2px 0; }
      .rx-clinic-address { font-size: 11px; color: #64748b; margin: 2px 0; }
      .rx-doctor { text-align: right; font-size: 13px; }
      .rx-doctor-name { font-weight: 700; font-size: 15px; margin: 0; }
      .rx-patient-strip { display: flex; flex-wrap: wrap; gap: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin: 18px 0; font-size: 13px; }
      .rx-patient-strip b { display: block; font-size: 10px; text-transform: uppercase; color: #94a3b8; }
      .rx-med-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
      .rx-med-table th, .rx-med-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
      .rx-med-table th { background: #eff6ff; }
      .rx-footer { display: flex; justify-content: flex-end; margin-top: 60px; }
      .rx-signature { text-align: center; font-size: 12.5px; }
      .rx-signature .line { border-top: 1px solid #1e293b; width: 200px; margin: 30px auto 4px; }
      @media print { body { padding: 10px; } }
    </style></head>
    <body>
      <div class="rx-header">
        <div>
          <p class="rx-clinic-name">${CLINIC_INFO.name}</p>
          <p class="rx-clinic-sub">${CLINIC_INFO.sub}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.address}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.regNo} &nbsp;|&nbsp; Mob: ${CLINIC_INFO.mobile}</p>
        </div>
        <div class="rx-doctor">
          <p class="rx-doctor-name">${rec.doctor_name}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.doctorQualification}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.doctorSpecialty}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.doctorRegNo}</p>
        </div>
      </div>
      <h3 style="margin:0 0 4px;">Investigation Advice</h3>
      <div class="rx-patient-strip">
        <div><b>Patient Name</b>${rec.patient_name}</div>
        <div><b>Age / Gender</b>${rec.age_gender || '—'}</div>
        <div><b>Date</b>${rec.visit_date}</div>
      </div>
      <table class="rx-med-table">
        <thead><tr><th>Investigation</th><th>Detail / Area</th><th>Instruction</th></tr></thead>
        <tbody>${investRows}</tbody>
      </table>
      <div class="rx-footer">
        <div class="rx-signature">
          <div class="line"></div>
          Doctor Signature
        </div>
      </div>
      <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  win.document.close();
}

async function openOpdModal(entry) {
  const pat = entry.patient_id ? state.allPatients.find(p => String(p.id) === String(entry.patient_id)) : null;

  $('of2-id').value = '';
  $('of2-queue-entry-id').value = entry.id;
  $('of2-appointment-id').value = entry.appointment_id || '';
  $('of2-patient-id').value = entry.patient_id || '';
  $('of2-name').value = entry.patient_name || '';
  $('of2-mobile').value = entry.mobile || '';
  $('of2-doctor').value = entry.doctor || DEFAULT_REFERRED_BY;
  $('opd-strip-name').textContent = entry.patient_name || '—';
  $('opd-strip-mobile').textContent = entry.mobile || '—';
  $('opd-strip-age').textContent = pat?.age ? `${pat.age}Y ${pat.gender || ''}`.trim() : '—';
  $('of2-patient-id-visible').value = pat?.patient_id || '';
  $('of2-patient-id-visible').disabled = true;
  $('of2-patient-id-visible').placeholder = 'First visit — enter/confirm ID';
  ['of2-history', 'of2-prev-illness', 'of2-signs', 'of2-diagnosis', 'of2-invest-prev',
    'of2-advice', 'of2-followup', 'of2-vital-bp', 'of2-vital-pulse', 'of2-vital-weight', 'of2-vital-height']
    .forEach(id => { $(id).value = ''; $(id).classList.remove('autofilled'); });
  clearMedicineRows();
  addMedicineRow();
  clearInvestigationRows('opd-invest-list');
  addDefaultInvestigationRows('opd-invest-list');
  $('opd-modal-sub').textContent = `History & prescription for ${entry.patient_name}`;
  $('opd-newvisit-date').textContent = state.queueDate || today();
  $('opd-modal').classList.add('open');
  refreshAllTextareaSizes();

  let existing = null;
  try {
    const res = await fetch(`${OPD_API}?queue_entry_id=${entry.id}`);
    const data = await res.json();
    existing = (data.records || [])[0];
    if (existing) fillOpdForm(existing);
  } catch (e) { console.error('[OPD] load current record failed', e); }

  // Weight/height are registered patient attributes — pull them straight from the
  // patient's profile (as set on the Add Patient page) unless this visit already
  // has its own saved value.
  if (pat?.weight_kg) setAutofilledVital('of2-vital-weight', pat.weight_kg);
  if (pat?.height_cm) setAutofilledVital('of2-vital-height', pat.height_cm);

  const history = await loadOpdHistory(entry);

  // BP/Pulse are per-visit vitals, not patient attributes — carry over the most
  // recent reading as a starting point only if this visit doesn't already have one.
  if (history?.length) {
    let lastVitals = {};
    try { lastVitals = history[0].vitals ? JSON.parse(history[0].vitals) : {}; } catch { lastVitals = {}; }
    if (lastVitals.bp) setAutofilledVital('of2-vital-bp', lastVitals.bp);
    if (lastVitals.pulse) setAutofilledVital('of2-vital-pulse', lastVitals.pulse);
    if (lastVitals.weight) setAutofilledVital('of2-vital-weight', lastVitals.weight);
    if (lastVitals.height) setAutofilledVital('of2-vital-height', lastVitals.height);
  } else {
    // First visit for this patient — no OPD history to protect, so let the
    // doctor enter or correct the Patient ID directly.
    $('of2-patient-id-visible').disabled = false;
  }
}

// Fills a vitals input with a value pulled from the patient profile or a past visit
// (rather than freshly measured this visit) and marks it visually so the doctor can
// tell at a glance it's a carried-over value, not something typed just now.
function setAutofilledVital(id, value) {
  const el = $(id);
  if (el.value.trim()) return; // don't clobber a value already set for this visit
  el.value = value;
  el.classList.add('autofilled');
}

// ─── Auto-bulleted Advice textarea ─────────────────────
// Each Enter starts a new "- " bullet line automatically, so the doctor can just
// type one point per line without manually adding the dash each time.
function insertAtCursor(el, text) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  const pos = start + text.length;
  el.selectionStart = el.selectionEnd = pos;
}

function bindAdviceBullets(id) {
  const el = $(id);
  el.addEventListener('focus', () => {
    if (!el.value) insertAtCursor(el, '- ');
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      insertAtCursor(el, '\n- ');
    }
  });
}

// ─── Medicine rows (structured Prescription / Medicines) ──
function clearMedicineRows() {
  $('opd-med-list').innerHTML = '';
}

// A combobox field for a fixed picklist (dose, frequency, duration, route,
// instruction, …) — same styled dropdown as Medicine/Investigation, and typing
// anything not on the list is still accepted as a one-off custom value.
function comboFieldHtml(cls, value) {
  return `
    <div class="combo-wrap">
      <input type="text" class="${cls}" placeholder="Type or select…" autocomplete="off" value="${escapeAttr(value)}" />
      <div class="combo-panel"></div>
    </div>
  `;
}

function addMedicineRow(med = {}) {
  const list = $('opd-med-list');
  const row = document.createElement('div');
  row.className = 'opd-med-row';
  row.innerHTML = `
    <div><label>Medicine</label>${comboFieldHtml('med-name', med.name)}</div>
    <div><label>Dose</label>${comboFieldHtml('med-dose', med.dose)}</div>
    <div><label>Frequency</label>${comboFieldHtml('med-frequency', med.frequency)}</div>
    <div><label>Duration</label>${comboFieldHtml('med-duration', med.duration)}</div>
    <div><label>Route</label>${comboFieldHtml('med-route', med.route)}</div>
    <div><label>Instruction</label>${comboFieldHtml('med-instruction', med.instruction)}</div>
    <button type="button" class="opd-med-remove" title="Remove">✕</button>
  `;
  initCombobox(row.querySelector('.med-name'), () => state.medicineOptions);
  initCombobox(row.querySelector('.med-dose'), () => state.medDoseOptions);
  initCombobox(row.querySelector('.med-frequency'), () => state.medFrequencyOptions);
  initCombobox(row.querySelector('.med-duration'), () => state.medDurationOptions);
  initCombobox(row.querySelector('.med-route'), () => state.medRouteOptions);
  initCombobox(row.querySelector('.med-instruction'), () => state.medInstructionOptions);
  row.querySelector('.opd-med-remove').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function collectMedicines() {
  return Array.from($('opd-med-list').querySelectorAll('.opd-med-row')).map(row => ({
    name: row.querySelector('.med-name').value.trim(),
    dose: row.querySelector('.med-dose').value.trim(),
    frequency: row.querySelector('.med-frequency').value.trim(),
    duration: row.querySelector('.med-duration').value.trim(),
    route: row.querySelector('.med-route').value.trim(),
    instruction: row.querySelector('.med-instruction').value.trim(),
  })).filter(m => m.name);
}

function medicinesToText(meds) {
  return meds.map(m => {
    const parts = [m.dose, m.frequency, m.duration].filter(Boolean).join(' | ');
    return [m.name, parts, m.instruction].filter(Boolean).join('\n');
  }).join('\n\n');
}

// ─── Investigation rows (structured Investigations Advised) ──
// Shared between the full OPD modal's list (with Report Comment) and the
// serve modal's quick "Investigations Advised" list (comment-free — a report
// comment can only be added once the actual report is back, from the full OPD record).
function clearInvestigationRows(containerId) {
  $(containerId).innerHTML = '';
}

// opts.checkable renders an on/off checkbox for routine defaults (X-Ray, CBC)
// that most patients need but some don't — unchecking excludes the row from
// being saved without having to delete it.
function addInvestigationRow(containerId, inv = {}, opts = {}) {
  const showComment = opts.showComment !== false;
  const checkable = !!opts.checkable;
  const checked = inv.checked !== false;
  const list = $(containerId);
  const row = document.createElement('div');
  row.className = 'opd-invest-row' + (showComment ? '' : ' compact') + (checkable ? ' checkable' : '') + (checkable && !checked ? ' row-off' : '');
  row.innerHTML = `
    <div><label>${checkable ? `<input type="checkbox" class="inv-checked" ${checked ? 'checked' : ''} /> ` : ''}Investigation</label>
      <div class="combo-wrap">
        <input type="text" class="inv-type" placeholder="Type or select…" autocomplete="off" value="${escapeAttr(inv.type)}" />
        <div class="combo-panel"></div>
      </div>
    </div>
    <div><label>Detail / Area</label>
      <div class="combo-wrap">
        <input type="text" class="inv-detail" placeholder="e.g. Right Knee" autocomplete="off" value="${escapeAttr(inv.detail)}" />
        <div class="combo-panel"></div>
      </div>
    </div>
    <div><label>Instruction</label>
      <div class="combo-wrap">
        <input type="text" class="inv-instruction" placeholder="e.g. get done before next visit" autocomplete="off" value="${escapeAttr(inv.instruction)}" />
        <div class="combo-panel"></div>
      </div>
    </div>
    ${showComment ? `<div><label>Report Comment</label><input type="text" class="inv-comment" placeholder="Findings once report is in…" value="${escapeAttr(inv.comment)}" /></div>` : ''}
    <button type="button" class="opd-med-remove" title="Remove">✕</button>
  `;
  initCombobox(row.querySelector('.inv-type'), () => state.investigationOptions);
  // Detail/Area and Instruction suggestions both depend on whichever investigation
  // is currently typed in this same row (X-Ray → body parts, CBC → sample type, etc.).
  initCombobox(row.querySelector('.inv-detail'), () => state.investigationDetailOptions[row.querySelector('.inv-type').value.trim()] || []);
  initCombobox(row.querySelector('.inv-instruction'), () => state.investigationInstructionOptions[row.querySelector('.inv-type').value.trim()] || []);
  if (checkable) {
    row.querySelector('.inv-checked').addEventListener('change', e => {
      row.classList.toggle('row-off', !e.target.checked);
    });
  }
  row.querySelector('.opd-med-remove').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

// X-Ray and CBC are needed for nearly every patient — pre-add them (checked)
// so the doctor only has to uncheck the ones that don't apply, instead of
// typing them out every single visit.
function addDefaultInvestigationRows(containerId, opts = {}) {
  ['X-Ray', 'CBC'].forEach(type => addInvestigationRow(containerId, { type, checked: true }, { ...opts, checkable: true }));
}

function collectInvestigations(containerId) {
  return Array.from($(containerId).querySelectorAll('.opd-invest-row'))
    .filter(row => row.querySelector('.inv-checked')?.checked !== false)
    .map(row => ({
      type: row.querySelector('.inv-type').value.trim(),
      detail: row.querySelector('.inv-detail').value.trim(),
      instruction: row.querySelector('.inv-instruction').value.trim(),
      comment: row.querySelector('.inv-comment')?.value.trim() || '',
    })).filter(i => i.type);
}

// The quick investigation modal has no Report Comment field — when saving from
// there, carry over any comment already stored against the same investigation
// so a save from the quick modal never wipes out a report comment.
function mergeInvestigationComments(investigations, original) {
  return investigations.map(inv => {
    if (inv.comment) return inv;
    const match = (original || []).find(o => o.type === inv.type && (o.detail || '') === (inv.detail || ''));
    return match ? { ...inv, comment: match.comment || '' } : inv;
  });
}

function investigationsToText(invs) {
  return invs.map(i => {
    const label = [i.type, i.detail].filter(Boolean).join(' - ');
    const extra = [i.instruction, i.comment ? `Report: ${i.comment}` : ''].filter(Boolean).join(' | ');
    return [label, extra].filter(Boolean).join('\n');
  }).join('\n\n');
}

function fillOpdForm(rec) {
  $('of2-id').value = rec.id;
  $('of2-appointment-id').value = rec.appointment_id || '';
  $('of2-patient-id').value = rec.patient_id || '';
  $('of2-name').value = rec.patient_name || '';
  $('of2-mobile').value = rec.mobile || '';
  $('of2-doctor').value = rec.doctor_name || DEFAULT_REFERRED_BY;
  $('opd-strip-name').textContent = rec.patient_name || '—';
  $('opd-strip-mobile').textContent = rec.mobile || '—';
  if (rec.age) $('opd-strip-age').textContent = `${rec.age}Y ${rec.gender || ''}`.trim();
  $('of2-history').value = rec.history || '';
  $('of2-prev-illness').value = rec.previous_illness || '';
  $('of2-signs').value = rec.signs_examination || '';
  $('of2-diagnosis').value = rec.diagnosis || '';
  $('of2-invest-prev').value = rec.previous_investigations || '';
  $('of2-advice').value = rec.advice || '';
  $('of2-followup').value = rec.follow_up_date || '';

  let vitals = {};
  try { vitals = rec.vitals ? JSON.parse(rec.vitals) : {}; } catch { vitals = {}; }
  ['of2-vital-bp', 'of2-vital-pulse', 'of2-vital-weight', 'of2-vital-height'].forEach(id => $(id).classList.remove('autofilled'));
  $('of2-vital-bp').value = vitals.bp || '';
  $('of2-vital-pulse').value = vitals.pulse || '';
  $('of2-vital-weight').value = vitals.weight || '';
  $('of2-vital-height').value = vitals.height || '';

  clearMedicineRows();
  let meds = [];
  try { meds = rec.medicines ? JSON.parse(rec.medicines) : []; } catch { meds = []; }
  if (meds.length) meds.forEach(m => addMedicineRow(m));
  else addMedicineRow();

  clearInvestigationRows('opd-invest-list');
  let invs = [];
  try { invs = rec.investigations ? JSON.parse(rec.investigations) : []; } catch { invs = []; }
  if (invs.length) invs.forEach(i => addInvestigationRow('opd-invest-list', i));
  else addInvestigationRow('opd-invest-list');

  refreshAllTextareaSizes();
}

async function loadOpdHistory(entry) {
  const panel = $('opd-history-panel');
  const leftCol = $('opd-col-left');
  leftCol.classList.add('hidden');
  panel.innerHTML = '<span class="opd-hist-empty">Loading…</span>';
  $('opd-hist-detail').innerHTML = '';
  state.viewingHistRecord = null;
  try {
    let records = [];
    if (entry.patient_id) {
      const res = await fetch(`${OPD_API}?patient_id=${entry.patient_id}`);
      const data = await res.json();
      records = data.records || [];
    } else if (entry.mobile) {
      const res = await fetch(OPD_API);
      const data = await res.json();
      records = (data.records || []).filter(r => r.mobile === entry.mobile);
    }
    records = records.filter(r => r.queue_entry_id !== entry.id).sort((a, b) => b.id - a.id);
    state.opdHistory = records;

    if (!records.length) {
      panel.innerHTML = '<span class="opd-hist-empty">No previous records found.</span>';
      $('opd-hist-detail').innerHTML = '';
      state.viewingHistRecord = null;
      leftCol.classList.add('hidden');
      return records;
    }
    leftCol.classList.remove('hidden');
    panel.innerHTML = records.map((r, idx) => `
      <div class="opd-hist-item" data-id="${r.id}">
        <span>${idx === 0 ? 'Latest Visit' : 'Visit'}</span>
        <span class="opd-hist-date">${r.visit_date || ''}</span>
      </div>
    `).join('');
    panel.querySelectorAll('.opd-hist-item').forEach(item => {
      item.addEventListener('click', () => {
        const rec = state.opdHistory.find(r => String(r.id) === item.dataset.id);
        if (!rec) return;
        renderHistDetail(rec);
        panel.querySelectorAll('.opd-hist-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      });
    });
    renderHistDetail(records[0]);
    const firstItem = panel.querySelector('.opd-hist-item');
    if (firstItem) firstItem.classList.add('active');
    return records;
  } catch (e) {
    console.error('[OPD] history load failed', e);
    panel.innerHTML = '<span class="opd-hist-empty">Failed to load history.</span>';
    $('opd-hist-detail').innerHTML = '';
    leftCol.classList.add('hidden');
    return [];
  }
}

// Read-only detail view for a past OPD record — shown on the left so the doctor
// can reference old data while filling in today's visit on the right, without the
// old record ever overwriting the new visit's form fields.
function renderHistDetail(rec) {
  const detail = $('opd-hist-detail');
  if (!rec) { detail.innerHTML = ''; return; }

  let vitals = {};
  try { vitals = rec.vitals ? JSON.parse(rec.vitals) : {}; } catch { vitals = {}; }
  let meds = [];
  try { meds = rec.medicines ? JSON.parse(rec.medicines) : []; } catch { meds = []; }
  let invs = [];
  try { invs = rec.investigations ? JSON.parse(rec.investigations) : []; } catch { invs = []; }

  // Renders a block of lines as a dash-bulleted list, one "- " per line, so every
  // multi-item section (medicines, investigations, advice…) reads consistently.
  const bulletList = (lines) => lines.filter(Boolean).map(l => `- ${escapeAttr(l)}`).join('\n');

  state.viewingHistRecord = rec;
  const rows = [];
  rows.push(`<div class="ohd-row"><span class="ohd-label">Visit Date</span><div class="ohd-value">${rec.visit_date || '—'} · Referred by ${rec.doctor_name || DEFAULT_REFERRED_BY}</div>
    <button type="button" class="opd-view-page-btn" onclick="viewOpdRecordPage(state.viewingHistRecord)">📄 View as Full Page</button></div>`);

  const vitalChips = ['bp', 'pulse', 'weight', 'height'].filter(k => vitals[k])
    .map(k => `<span class="ohd-vital-chip">${k.toUpperCase()}: ${vitals[k]}</span>`).join('');
  if (vitalChips) rows.push(`<div class="ohd-row ohd-vitals-row"><span class="ohd-label">Vitals</span><div class="ohd-vitals">${vitalChips}</div></div>`);

  const textField = (label, val, cls = '') => val ? `<div class="ohd-row ${cls}"><span class="ohd-label">${label}</span><div class="ohd-value">${escapeAttr(val)}</div></div>` : '';
  rows.push(textField('History / Complaints', rec.history, 'ohd-history-row'));
  rows.push(textField('Previous Illness', rec.previous_illness, 'ohd-illness-row'));
  rows.push(textField('Signs / Examination', rec.signs_examination, 'ohd-signs-row'));
  rows.push(textField('Diagnosis', rec.diagnosis, 'ohd-diagnosis-row'));

  if (invs.length) {
    const invLines = invs.map(i => [i.type, i.detail].filter(Boolean).join(' - ') + (i.comment ? ` → ${i.comment}` : ''));
    rows.push(`<div class="ohd-row ohd-invest-row"><span class="ohd-label">Investigations Advised</span><div class="ohd-value">${bulletList(invLines)}</div></div>`);
  }
  if (rec.previous_investigations) {
    const prevLines = String(rec.previous_investigations).split('\n');
    rows.push(`<div class="ohd-row ohd-previnvest-row"><span class="ohd-label">Previous Investigations</span><div class="ohd-value">${bulletList(prevLines)}</div></div>`);
  }

  if (meds.length) {
    const medLines = meds.map(m => [m.name, [m.dose, m.frequency, m.duration].filter(Boolean).join(' | '), m.instruction].filter(Boolean).join(' — '));
    rows.push(`<div class="ohd-row ohd-meds-row"><span class="ohd-label">Medicines</span><div class="ohd-value">${bulletList(medLines)}</div></div>`);
  }
  if (rec.advice) {
    const adviceLines = String(rec.advice).split('\n').map(l => l.replace(/^-\s*/, ''));
    rows.push(`<div class="ohd-row ohd-advice-row"><span class="ohd-label">Advice</span><div class="ohd-value">${bulletList(adviceLines)}</div></div>`);
  }
  rows.push(textField('Follow-up Date', rec.follow_up_date, 'ohd-followup-row'));

  detail.innerHTML = rows.filter(Boolean).join('');
}

function buildOpdPayload() {
  const name = $('of2-name').value.trim();
  if (!name) { $('of2-err-name').textContent = 'Patient name is required'; return null; }
  $('of2-err-name').textContent = '';

  const medicines = collectMedicines();
  const investigations = collectInvestigations('opd-invest-list');
  return {
    patient_id: $('of2-patient-id').value || null,
    queue_entry_id: $('of2-queue-entry-id').value || null,
    appointment_id: $('of2-appointment-id').value || null,
    patient_name: name,
    mobile: $('of2-mobile').value.trim(),
    doctor_name: $('of2-doctor').value.trim() || DEFAULT_REFERRED_BY,
    visit_date: new Date().toISOString().slice(0, 10),
    history: $('of2-history').value.trim(),
    previous_illness: $('of2-prev-illness').value.trim(),
    signs_examination: $('of2-signs').value.trim(),
    vitals: {
      bp: $('of2-vital-bp').value.trim(),
      pulse: $('of2-vital-pulse').value.trim(),
      weight: $('of2-vital-weight').value.trim(),
      height: $('of2-vital-height').value.trim(),
    },
    diagnosis: $('of2-diagnosis').value.trim(),
    investigations,
    investigations_advised: investigationsToText(investigations),
    previous_investigations: $('of2-invest-prev').value.trim(),
    medicines,
    prescription: medicinesToText(medicines),
    advice: $('of2-advice').value.trim(),
    follow_up_date: $('of2-followup').value || null,
  };
}

async function saveOpdRecord(payload) {
  const id = $('of2-id').value;
  const res = await fetch(id ? `${OPD_API}/${id}` : OPD_API, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);
  if (!id) $('of2-id').value = data.id;

  syncCustomOptions(payload.medicines, payload.investigations);

  // Mirror the follow-up date into the serve modal's quick field if it's still empty
  if ($('sf-followup') && !$('sf-followup').value.trim() && payload.follow_up_date) $('sf-followup').value = payload.follow_up_date;

  // Keep the patient's profile in sync with the latest measured weight/height,
  // so the next visit's OPD form (and the Add Patient page) autofills the current reading.
  if (payload.patient_id && (payload.vitals?.weight || payload.vitals?.height)) {
    const patchBody = {};
    if (payload.vitals.weight) patchBody.weight_kg = payload.vitals.weight;
    if (payload.vitals.height) patchBody.height_cm = payload.vitals.height;
    fetch(`${PAT_API}/${payload.patient_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    }).then(() => {
      const pat = state.allPatients.find(p => String(p.id) === String(payload.patient_id));
      if (pat) Object.assign(pat, patchBody);
    }).catch(e => console.error('[OPD] patient vitals sync failed', e));
  }

  // First-visit patients can have their Patient ID entered/corrected right here —
  // push it back to the patient's profile so it's recorded going forward.
  const idField = $('of2-patient-id-visible');
  if (payload.patient_id && idField && !idField.disabled && idField.value.trim()) {
    fetch(`${PAT_API}/${payload.patient_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: idField.value.trim() }),
    }).then(() => {
      const pat = state.allPatients.find(p => String(p.id) === String(payload.patient_id));
      if (pat) pat.patient_id = idField.value.trim();
    }).catch(e => console.error('[OPD] patient ID sync failed', e));
  }

  return { id: id || data.id, ...payload };
}

// After the doctor saves the OPD record for a patient who was CALLED/SERVING,
// the visit is clinically finished — mark it DONE in the queue and hand control
// back to reception (who'll fill in Amount Paid / follow-up booking separately
// via the ✏️ Edit action on the now-Done card). Re-saving an already-Done record
// (editing later) just updates the OPD data without touching queue status.
async function finishVisitAfterOpdSave(followUpDate) {
  const queueId = parseInt($('of2-queue-entry-id').value);
  const entry = state.queue.find(q => q.id === queueId);
  if (!entry || !(entry.status === 'CALLED' || entry.status === 'SERVING')) return;

  await queueAction(queueId, 'complete', {
    status: 'DONE',
    amount_paid: entry.amount_paid || 0,
    follow_up_date: followUpDate || entry.follow_up_date || undefined,
  });

  if (state.autoCallNext) {
    setTimeout(async () => {
      const waiting = state.queue.filter(x => x.status === 'WAITING');
      if (waiting.length > 0) await queueAction(waiting[0].id, 'call');
      state.autoCallNext = false;
      updateQueueButtonState();
    }, 400);
  }
}

async function handleOpdInlineSubmit(e) {
  e.preventDefault();
  const payload = buildOpdPayload();
  if (!payload) return;

  try {
    await saveOpdRecord(payload);
    await finishVisitAfterOpdSave(payload.follow_up_date);
    toast('success', 'Visit completed — reception can now finalize payment');
    closeModal('opd-modal');
  } catch (err) {
    toast('error', err.message || 'Failed to save OPD record');
  }
}

async function handleOpdPrint() {
  const payload = buildOpdPayload();
  if (!payload) return;

  try {
    const saved = await saveOpdRecord(payload);
    await finishVisitAfterOpdSave(payload.follow_up_date);
    toast('success', 'OPD record saved — opening print preview…');
    printOpdRecord(saved);
  } catch (err) {
    toast('error', err.message || 'Failed to save OPD record');
  }
}

// Opens a past OPD record in the same clinic-letterhead page format used for
// printing — but purely for viewing, with an on-page Print button instead of
// auto-triggering the print dialog. Lets the doctor review an old visit exactly
// as it would appear on paper.
function viewOpdRecordPage(rec) {
  let vitals = {};
  try { vitals = typeof rec.vitals === 'string' ? JSON.parse(rec.vitals || '{}') : (rec.vitals || {}); } catch { vitals = {}; }
  let medicines = [];
  try { medicines = typeof rec.medicines === 'string' ? JSON.parse(rec.medicines || '[]') : (rec.medicines || []); } catch { medicines = []; }
  let investigations = [];
  try { investigations = typeof rec.investigations === 'string' ? JSON.parse(rec.investigations || '[]') : (rec.investigations || []); } catch { investigations = []; }
  printOpdRecord({ ...rec, vitals, medicines, investigations }, { autoPrint: false });
}

// ─── Printable Prescription ───────────────────────────
function printOpdRecord(rec, opts = {}) {
  const autoPrint = opts.autoPrint !== false;
  const age = ($('opd-strip-age').textContent !== '—' ? $('opd-strip-age').textContent : '') || (rec.age ? `${rec.age}Y ${rec.gender || ''}`.trim() : '');
  const opdNo = rec.id ? `OPD-${rec.id}` : '—';
  const medsHtml = (rec.medicines || []).length
    ? `<table class="rx-med-table">
        <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Route</th><th>Instruction</th></tr></thead>
        <tbody>${rec.medicines.map(m => `
          <tr><td>${m.name}</td><td>${m.dose || ''}</td><td>${m.frequency || ''}</td><td>${m.duration || ''}</td><td>${m.route || ''}</td><td>${m.instruction || ''}</td></tr>
        `).join('')}</tbody>
      </table>`
    : '<p class="rx-empty">No medicines prescribed.</p>';

  const investHtml = (rec.investigations || []).length
    ? `<table class="rx-med-table">
        <thead><tr><th>Investigation</th><th>Detail / Area</th><th>Instruction</th><th>Report Comment</th></tr></thead>
        <tbody>${rec.investigations.map(i => `
          <tr><td>${i.type}</td><td>${i.detail || ''}</td><td>${i.instruction || ''}</td><td>${i.comment || ''}</td></tr>
        `).join('')}</tbody>
      </table>`
    : '<p class="rx-empty">No investigations advised.</p>';

  const win = window.open('', '_blank', 'width=800,height=900');
  win.document.write(`
    <!DOCTYPE html><html><head><title>Prescription — ${rec.patient_name}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; }
      .rx-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563EB; padding-bottom: 12px; margin-bottom: 16px; }
      .rx-clinic-name { font-size: 20px; font-weight: 800; color: #dc2626; margin: 0; }
      .rx-clinic-sub { font-size: 12px; color: #475569; margin: 2px 0; }
      .rx-clinic-address { font-size: 11px; color: #64748b; margin: 2px 0; }
      .rx-doctor { text-align: right; font-size: 13px; }
      .rx-doctor-name { font-weight: 700; font-size: 15px; margin: 0; }
      .rx-patient-strip { display: flex; flex-wrap: wrap; gap: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 18px; font-size: 13px; }
      .rx-patient-strip b { display: block; font-size: 10px; text-transform: uppercase; color: #94a3b8; }
      .rx-section { margin-bottom: 14px; }
      .rx-section h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; color: #2563EB; margin: 0 0 4px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 3px; }
      .rx-section p { font-size: 13.5px; margin: 0; white-space: pre-wrap; }
      .rx-med-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .rx-med-table th, .rx-med-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
      .rx-med-table th { background: #eff6ff; }
      .rx-empty { font-size: 12.5px; color: #94a3b8; font-style: italic; }
      .rx-emergency-note { font-size: 12px; font-style: italic; color: #475569; margin-top: 20px; }
      .rx-footer { display: flex; justify-content: space-between; margin-top: 20px; }
      .rx-signature { text-align: center; font-size: 12.5px; }
      .rx-signature .line { border-top: 1px solid #1e293b; width: 200px; margin: 30px auto 4px; }
      @media print { body { padding: 10px; } }
    </style></head>
    <body>
      <div class="rx-header">
        <div>
          <p class="rx-clinic-name">${CLINIC_INFO.name}</p>
          <p class="rx-clinic-sub">${CLINIC_INFO.sub}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.address}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.regNo} &nbsp;|&nbsp; Mob: ${CLINIC_INFO.mobile}</p>
        </div>
        <div class="rx-doctor">
          <p class="rx-doctor-name">${rec.doctor_name || DEFAULT_REFERRED_BY}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.doctorQualification}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.doctorSpecialty}</p>
          <p class="rx-clinic-address">${CLINIC_INFO.doctorRegNo}</p>
        </div>
      </div>

      <div class="rx-patient-strip">
        <div><b>Patient Name</b>${rec.patient_name}</div>
        <div><b>Age / Gender</b>${age || '—'}</div>
        <div><b>Date</b>${rec.visit_date}</div>
        <div><b>OPD No.</b>${opdNo}</div>
      </div>
      ${rec.vitals && (rec.vitals.bp || rec.vitals.pulse || rec.vitals.weight || rec.vitals.height) ? `
      <div class="rx-patient-strip">
        ${rec.vitals.bp ? `<div><b>BP</b>${rec.vitals.bp} mmHg</div>` : ''}
        ${rec.vitals.pulse ? `<div><b>Pulse</b>${rec.vitals.pulse} bpm</div>` : ''}
        ${rec.vitals.weight ? `<div><b>Weight</b>${rec.vitals.weight} kg</div>` : ''}
        ${rec.vitals.height ? `<div><b>Height</b>${rec.vitals.height} cm</div>` : ''}
      </div>` : ''}

      <div class="rx-section"><h4>Diagnosis</h4><p>${rec.diagnosis || '—'}</p></div>
      <div class="rx-section"><h4>Prescription / Medicines</h4>${medsHtml}</div>
      <div class="rx-section"><h4>Investigations Advised</h4>${investHtml}</div>
      <div class="rx-section"><h4>Advice</h4><p>${rec.advice || '—'}</p></div>
      <div class="rx-section"><h4>Follow-up Date</h4><p>${rec.follow_up_date || '—'}</p></div>

      <p class="rx-emergency-note">Please follow-up in case of emergency with prior appointment.</p>

      <div class="rx-footer">
        <div></div>
        <div class="rx-signature">
          <div class="line"></div>
          Doctor Signature
        </div>
      </div>

      ${autoPrint ? '' : '<button id="rx-print-btn" style="margin-top:20px; padding:10px 18px; font-size:13px; font-weight:600; border:none; border-radius:6px; background:#0d9488; color:#fff; cursor:pointer;" onclick="window.print()">🖨️ Print This Page</button>'}
      <script>${autoPrint ? 'window.onload = () => window.print();' : ''}</script>
    </body></html>
  `);
  win.document.close();
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
      body: JSON.stringify({ ...data, ticket_type: 'WALKIN', queue_date: state.queueDate }),
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

  const data = Object.fromEntries(new FormData($('appt-form')));
  Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });

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

// Doctor said "go get the X-Ray and come back today with the report" — pause
// the visit without completing it or booking a future-dated follow-up.
async function handleHoldVisit() {
  const queueId = parseInt($('of2-queue-entry-id').value);
  const entry = state.queue.find(q => q.id === queueId);
  if (!entry) return;

  const result = await queueAction(queueId, 'hold', { reason: 'Gone for investigation — will return today with report' });
  if (result?.success) {
    toast('success', `⏸ ${entry.patient_name} put on hold — will resume when back`);
    closeModal('opd-modal');
  }
}

async function handleServeSubmit(e) {
  e.preventDefault();
  const queueId = $('sf-queue-id').value;
  const data = Object.fromEntries(new FormData($('serve-form')));

  const willAutoCall = state.autoCallNext && (data.status === 'DONE' || data.status === 'NOSHOW' || data.status === 'MISSED');

  // 👇 CRITICAL FIX: Manually grab the date because FormData ignores 'disabled' fields! 👇
  const dateField = $('sf-followup');
  const actualFollowUpDate = dateField ? dateField.value : null;

  const payload = {
    status: data.status,
    amount_paid: data.amount_paid ? parseFloat(data.amount_paid) : 0,
    follow_up_date: actualFollowUpDate // <-- Uses the manual value! Diagnosis/Rx come from the linked OPD record.
  };

  const result = await queueAction(parseInt(queueId), 'complete', payload);

  if (result?.success) {
    const statusMsg = { DONE: '✅ Marked done', NOSHOW: '❌ Marked no-show', MISSED: '⏭ Moved to missed', SERVING: '🔄 Still serving' };
    
    if (actualFollowUpDate) {
      toast('success', `✅ Saved! Follow-up date noted for ${new Date(actualFollowUpDate).toLocaleDateString()}`);
    } else {
      toast('success', statusMsg[data.status] || 'Updated');
    }

    closeModal('serve-modal');

    if (willAutoCall) {
      state.autoCallNext = true;
      updateQueueButtonState();

      setTimeout(async () => {
        const waiting = state.queue.filter(x => x.status === 'WAITING');
        if (waiting.length > 0) {
          await queueAction(waiting[0].id, 'call');
        }
        state.autoCallNext = false;
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