// ═══════════════════════════════════════════════════════
// add-pabdc.js — Patient & Client Registry Frontend
// ═══════════════════════════════════════════════════════

const API_BASE   = '';
const API        = `${API_BASE}/api/patients`;
const VISITS_API = `${API_BASE}/api/visits`;

const PAGE_SIZE = 20;

let state = {
  patients: [],
  filtered: [],
  page: 1,
  sortBy: 'created_at',
  sortDir: 'desc',
  searchQ: '',
  filterGender: '',
  filterBlood: '',
  editingId: null,
  activeDrawerPatient: null,
  pendingDeleteId: null,
};

// ─── DOM REFS ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const patientTbody   = $('patient-tbody');
const patientModal   = $('patient-modal');
const visitModal     = $('visit-modal');
const drawer         = $('patient-drawer');
const drawerOverlay  = $('drawer-overlay');
const confirmOverlay = $('confirm-overlay');
const globalSearch   = $('global-search');
const searchDropdown = $('search-dropdown');
const patientForm    = $('patient-form');
const visitForm      = $('visit-form');
const toastCont      = $('toast-container');

// ─── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPatients();
  setDefaultVisitTime();
  bindEvents();
});

// ─── LOAD PATIENTS ─────────────────────────────────────
async function loadPatients() {
  try {
    const res = await fetch(API);
    const data = await res.json();
    if (data.success) {
      state.patients = data.patients || [];
      applyFilters();
      updateStats();
    }
  } catch (e) {
    toast('error', 'Failed to load patients');
  }
}

// ─── STATS ─────────────────────────────────────────────
function updateStats() {
  const total = state.patients.length;
  const today = new Date().toDateString();
  const todayCount = state.patients.filter(p =>
    new Date(p.created_at).toDateString() === today
  ).length;
  const totalVisits = state.patients.reduce((a, p) => a + (p.visit_count || 0), 0);
  const thisMonth = new Date();
  const activeCount = state.patients.filter(p => {
    if (!p.last_visit) return false;
    const lv = new Date(p.last_visit);
    return lv.getMonth() === thisMonth.getMonth() && lv.getFullYear() === thisMonth.getFullYear();
  }).length;

  $('stat-total').textContent  = total;
  $('stat-today').textContent  = todayCount;
  $('stat-visits').textContent = totalVisits;
  $('stat-active').textContent = activeCount;
}

// ─── FILTER & SORT ─────────────────────────────────────
function applyFilters() {
  let list = [...state.patients];

  if (state.searchQ) {
    const q = state.searchQ.toLowerCase();
    list = list.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.mobile || '').includes(q) ||
      (p.patient_id || '').toLowerCase().includes(q)
    );
  }
  if (state.filterGender) list = list.filter(p => p.gender === state.filterGender);
  if (state.filterBlood)  list = list.filter(p => p.blood_group === state.filterBlood);

  list.sort((a, b) => {
    let av = a[state.sortBy] ?? '', bv = b[state.sortBy] ?? '';
    if (typeof av === 'number') return state.sortDir === 'asc' ? av - bv : bv - av;
    return state.sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  state.filtered = list;
  state.page = 1;
  renderTable();
}

// ─── RENDER TABLE ──────────────────────────────────────
// ─── RENDER TABLE ──────────────────────────────────────
function renderTable() {
  const start = (state.page - 1) * PAGE_SIZE;
  const page  = state.filtered.slice(start, start + PAGE_SIZE);
  $('record-count').textContent = `${state.filtered.length} record${state.filtered.length !== 1 ? 's' : ''}`;

  if (!page.length) {
    patientTbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="10">
          <div class="empty-state">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="20" r="8" stroke="#cbd5e1" stroke-width="2"/>
              <path d="M8 40c0-8.84 7.16-16 16-16s16 7.16 16 16" stroke="#cbd5e1" stroke-width="2"/>
            </svg>
            <p>${state.searchQ ? 'No matching patients found.' : 'No patients yet. Add your first patient.'}</p>
          </div>
        </td>
      </tr>`;
    renderPagination();
    return;
  }

  patientTbody.innerHTML = page.map((p, i) => `
    <tr class="row-enter" data-id="${p.id}" style="animation-delay:${i * 18}ms">
      <td><span class="patient-id-cell">${p.patient_id || `#${p.id}`}</span></td>
      <td><span class="patient-name">${esc(p.full_name)}</span></td>
      <td>${p.mobile ? `<span class="mobile-badge"><svg viewBox="0 0 14 14" fill="none"><rect x="3" y="1" width="8" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="11" r="0.7" fill="currentColor"/></svg>${esc(p.mobile)}</span>` : '<span style="color:var(--text-faint)">—</span>'}</td>
      <td>${p.age ? `<span class="age-badge">${p.age}Y</span>` : '<span style="color:var(--text-faint)">—</span>'}</td>
      <td><span class="gender-badge ${p.gender?.[0] || 'O'}">${p.gender || '—'}</span></td>
      <td>${p.blood_group ? `<span class="blood-badge">${p.blood_group}</span>` : '<span style="color:var(--text-faint)">—</span>'}</td>
      <td><span class="date-cell"><svg viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M4 1v3M10 1v3M2 6h10" stroke="currentColor" stroke-width="1.3"/></svg>${fmtDate(p.created_at)}</span></td>
      <td>${p.last_visit ? `<span class="date-cell last-visit"><svg viewBox="0 0 14 14" fill="none"><rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M4 1v3M10 1v3M2 6h10" stroke="currentColor" stroke-width="1.3"/></svg>${fmtDate(p.last_visit)}</span>` : '<span style="color:var(--text-faint)">—</span>'}</td>
      <td><span class="visit-count">${p.visit_count || 0}</span></td>
      <td>
        <div class="action-cell">
          <button class="action-btn edit" data-action="edit" data-id="${p.id}" title="Edit">
            <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
          <button class="action-btn delete" data-action="delete" data-id="${p.id}" title="Delete">
            <svg viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5 4V3h6v1M6 7v5M10 7v5M3 4l1 9h8l1-9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(state.filtered.length / PAGE_SIZE);
  $('page-info').textContent  = `Page ${state.page} of ${total || 1}`;
  $('prev-page').disabled     = state.page <= 1;
  $('next-page').disabled     = state.page >= total;
}

// ─── BIND EVENTS ───────────────────────────────────────
function bindEvents() {
  // Open add modal
  $('open-add-btn').addEventListener('click', () => openModal());
  $('close-modal').addEventListener('click', closeModal);
  $('cancel-form').addEventListener('click', closeModal);
  patientModal.addEventListener('click', e => { if (e.target === patientModal) closeModal(); });

  // Form submit
  patientForm.addEventListener('submit', handleFormSubmit);

  // Table row click & action buttons
  patientTbody.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (btn.dataset.action === 'edit') openModal(id);
      if (btn.dataset.action === 'delete') confirmDelete(id);
      return;
    }
    const row = e.target.closest('tr[data-id]');
    if (row) openDrawer(parseInt(row.dataset.id));
  });

  // Sort
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const s = th.dataset.sort;
      if (state.sortBy === s) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortBy = s; state.sortDir = 'asc'; }
      applyFilters();
    });
  });

  // Filters
  $('filter-gender').addEventListener('change', e => { state.filterGender = e.target.value; applyFilters(); });
  $('filter-blood').addEventListener('change', e => { state.filterBlood = e.target.value; applyFilters(); });
  $('refresh-btn').addEventListener('click', () => { loadPatients(); toast('info', 'Refreshed'); });

  // Pagination
  $('prev-page').addEventListener('click', () => { if (state.page > 1) { state.page--; renderTable(); }});
  $('next-page').addEventListener('click', () => {
    if (state.page < Math.ceil(state.filtered.length / PAGE_SIZE)) { state.page++; renderTable(); }
  });

  // Global search (debounced)
  let searchTimer;
  globalSearch.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQ = e.target.value.trim();
      applyFilters();
      updateSearchDropdown(e.target.value.trim());
    }, 200);
  });
  globalSearch.addEventListener('blur', () => {
    setTimeout(() => { searchDropdown.classList.remove('show'); }, 200);
  });

  // DOB → auto-fill age
  $('f-dob').addEventListener('change', e => {
    if (e.target.value) {
      const age = calcAge(e.target.value);
      $('f-age').value = age;
    }
  });

  // Drawer close
  $('close-drawer').addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);
  $('drawer-edit-btn').addEventListener('click', () => {
    if (state.activeDrawerPatient) { closeDrawer(); openModal(state.activeDrawerPatient.id); }
  });
  $('drawer-delete-btn').addEventListener('click', () => {
    if (state.activeDrawerPatient) confirmDelete(state.activeDrawerPatient.id);
  });

  // Drawer tabs
  document.querySelectorAll('.dtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dtab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Visit modal
  $('add-visit-btn').addEventListener('click', () => openVisitModal());
  $('close-visit-modal').addEventListener('click', closeVisitModal);
  $('cancel-visit').addEventListener('click', closeVisitModal);
  visitModal.addEventListener('click', e => { if (e.target === visitModal) closeVisitModal(); });
  visitForm.addEventListener('submit', handleVisitSubmit);

  // Confirm dialog
  $('confirm-cancel').addEventListener('click', () => { confirmOverlay.classList.remove('open'); state.pendingDeleteId = null; });
  $('confirm-ok').addEventListener('click', async () => {
    if (state.pendingDeleteId) await deletePatient(state.pendingDeleteId);
    confirmOverlay.classList.remove('open');
    state.pendingDeleteId = null;
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal(); closeDrawer(); closeVisitModal();
      confirmOverlay.classList.remove('open');
    }
  });
}

// ─── SEARCH DROPDOWN ───────────────────────────────────
function updateSearchDropdown(q) {
  if (!q || q.length < 2) { searchDropdown.classList.remove('show'); return; }
  const matches = state.patients.filter(p =>
    (p.full_name || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.mobile || '').includes(q) ||
    (p.patient_id || '').toLowerCase().includes(q.toLowerCase())
  ).slice(0, 6);

  if (!matches.length) {
    searchDropdown.innerHTML = `<div class="search-no-result">No results for "${esc(q)}"</div>`;
    searchDropdown.classList.add('show');
    return;
  }

  searchDropdown.innerHTML = matches.map(p => `
    <div class="search-result-item" data-id="${p.id}">
      <div class="search-result-avatar">${(p.full_name || '?')[0].toUpperCase()}</div>
      <div>
        <div class="search-result-name">${esc(p.full_name)}</div>
        <div class="search-result-meta">${p.patient_id || `ID #${p.id}`} · ${p.mobile || 'No mobile'}</div>
      </div>
    </div>
  `).join('');
  searchDropdown.classList.add('show');

  searchDropdown.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      searchDropdown.classList.remove('show');
      globalSearch.value = '';
      state.searchQ = '';
      applyFilters();
      openDrawer(parseInt(item.dataset.id));
    });
  });
}

// ─── MODAL: OPEN / CLOSE ───────────────────────────────
function openModal(id = null) {
  state.editingId = id;
  patientForm.reset();
  $('edit-id').value = '';
  $('err-name').textContent = '';

  if (id) {
    const p = state.patients.find(x => x.id === id);
    if (!p) return;
    $('modal-title').textContent = 'Edit Patient';
    $('submit-text').textContent = 'Update Patient';
    $('edit-id').value = p.id;
    fillForm(p);
  } else {
    $('modal-title').textContent = 'Add New Patient';
    $('submit-text').textContent = 'Save Patient';
  }

  patientModal.classList.add('open');
  setTimeout(() => document.getElementById('f-full-name').focus(), 100);
}

function closeModal() {
  patientModal.classList.remove('open');
  state.editingId = null;
}

function fillForm(p) {
  const fields = ['patient_id','full_name','mobile','alt_mobile','email','dob','age','gender',
    'blood_group','height_cm','weight_kg','allergies','chronic_conditions','current_medications',
    'address','city','pin_code','emergency_contact_name','emergency_contact_mobile',
    'emergency_contact_relation','visit_type','department','assigned_doctor',
    'insurance_policy','chief_complaint','notes'];
  fields.forEach(f => {
    const el = patientForm.querySelector(`[name="${f}"]`);
    if (el) el.value = p[f] || '';
  });
}

// ─── FORM SUBMIT ───────────────────────────────────────
async function handleFormSubmit(e) {
  e.preventDefault();
  $('err-name').textContent = '';

  const fullName = $('f-full-name').value.trim();
  if (!fullName) {
    $('f-full-name').classList.add('error');
    $('err-name').textContent = 'Full name is required';
    $('f-full-name').focus();
    return;
  }
  $('f-full-name').classList.remove('error');

  const data = Object.fromEntries(new FormData(patientForm));
  // Clean empty strings to null
  Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });

  $('submit-spinner').style.display = 'inline-block';
  $('submit-text').style.opacity = '0.6';
  $('submit-btn').disabled = true;

  try {
    const isEdit = !!state.editingId;
    const url  = isEdit ? `${API}/${state.editingId}` : API;
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    const result = await res.json();

    if (result.success) {
      toast('success', isEdit ? '✅ Patient updated' : '✅ Patient added');
      closeModal();
      await loadPatients();
    } else {
      toast('error', result.message || 'Save failed');
    }
  } catch (err) {
    toast('error', 'Network error');
  } finally {
    $('submit-spinner').style.display = 'none';
    $('submit-text').style.opacity = '1';
    $('submit-btn').disabled = false;
  }
}

// ─── DELETE ────────────────────────────────────────────
function confirmDelete(id) {
  const p = state.patients.find(x => x.id === id);
  if (!p) return;
  $('confirm-title').textContent = `Delete "${p.full_name}"?`;
  state.pendingDeleteId = id;
  confirmOverlay.classList.add('open');
}

async function deletePatient(id) {
  try {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      toast('success', '🗑️ Patient deleted');
      if (state.activeDrawerPatient?.id === id) closeDrawer();
      await loadPatients();
    } else {
      toast('error', result.message || 'Delete failed');
    }
  } catch {
    toast('error', 'Network error');
  }
}

// ─── DRAWER ────────────────────────────────────────────
async function openDrawer(id) {
  const p = state.patients.find(x => x.id === id);
  if (!p) return;
  state.activeDrawerPatient = p;

  // Header
  $('drawer-name').textContent = p.full_name;
  $('drawer-pid').textContent  = `ID: ${p.patient_id || `#${p.id}`}`;
  $('drawer-avatar').textContent = (p.full_name || '?')[0].toUpperCase();

  // Bio tab
  $('bio-grid').innerHTML = bioFields([
    ['Patient ID', p.patient_id || `#${p.id}`],
    ['Full Name', p.full_name],
    ['Age', p.age],
    ['Gender', p.gender],
    ['Date of Birth', p.dob ? fmtDate(p.dob) : null],
    ['Blood Group', p.blood_group],
    ['Mobile', p.mobile],
    ['Alt. Mobile', p.alt_mobile],
    ['Email', p.email],
    ['Registered', fmtDateTime(p.created_at), true],
  ]);

  // Medical tab
  $('medical-grid').innerHTML = bioFields([
    ['Blood Group', p.blood_group],
    ['Height', p.height_cm ? `${p.height_cm} cm` : null],
    ['Weight', p.weight_kg ? `${p.weight_kg} kg` : null],
    ['BMI', (p.height_cm && p.weight_kg) ? calcBMI(p.weight_kg, p.height_cm) : null],
    ['Allergies', p.allergies, true],
    ['Chronic Conditions', p.chronic_conditions, true],
    ['Current Medications', p.current_medications, true],
    ['Chief Complaint', p.chief_complaint, true],
    ['Department', p.department],
    ['Doctor', p.assigned_doctor],
    ['Visit Type', p.visit_type],
    ['Insurance', p.insurance_policy],
    ['Notes', p.notes, true],
  ]);

  // Contact tab
  $('contact-grid').innerHTML = bioFields([
    ['Mobile', p.mobile],
    ['Alt. Mobile', p.alt_mobile],
    ['Email', p.email],
    ['Address', p.address, true],
    ['City', p.city],
    ['PIN / ZIP', p.pin_code],
    ['Emergency Name', p.emergency_contact_name],
    ['Emergency Mobile', p.emergency_contact_mobile],
    ['Emergency Relation', p.emergency_contact_relation],
  ]);

  // Load visits
  await loadVisits(id);

  // Reset to bio tab
  document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dtab-panel').forEach(b => b.classList.remove('active'));
  document.querySelector('.dtab').classList.add('active');
  $('tab-bio').classList.add('active');

  drawerOverlay.classList.add('open');
  drawer.classList.add('open');
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  state.activeDrawerPatient = null;
}

function bioFields(pairs) {
  return pairs.map(([label, val, wide]) => `
    <div class="bio-field${wide ? ' wide' : ''}">
      <span class="bio-field-label">${label}</span>
      <span class="bio-field-value${!val ? ' empty' : ''}">${val || 'Not provided'}</span>
    </div>
  `).join('');
}

// ─── VISITS ────────────────────────────────────────────
async function loadVisits(patientId) {
  try {
    const res = await fetch(`${VISITS_API}?patient_id=${patientId}`);
    const data = await res.json();
    if (data.success) renderVisits(data.visits || []);
  } catch {
    $('visit-timeline').innerHTML = `<div class="empty-visits">Could not load visits.</div>`;
  }
}

function renderVisits(visits) {
  $('visits-count').textContent = `${visits.length} visit${visits.length !== 1 ? 's' : ''}`;
  if (!visits.length) {
    $('visit-timeline').innerHTML = `<div class="empty-visits">No visits recorded yet.</div>`;
    return;
  }
  $('visit-timeline').innerHTML = visits.map(v => `
    <div class="visit-card">
      <div class="visit-card-header">
        <span class="visit-date">${fmtDateTime(v.visit_date)}</span>
        <span class="visit-type-badge">${v.visit_type || 'Visit'}</span>
      </div>
      ${v.doctor ? `<div class="visit-doctor">👨‍⚕️ ${esc(v.doctor)}</div>` : ''}
      ${v.complaint ? `<div class="visit-complaint"><strong>Complaint:</strong> ${esc(v.complaint)}</div>` : ''}
      ${v.diagnosis ? `<div class="visit-diagnosis"><strong>Diagnosis/Notes:</strong> ${esc(v.diagnosis)}</div>` : ''}
      ${v.prescription ? `<div class="visit-diagnosis"><strong>Rx:</strong> ${esc(v.prescription)}</div>` : ''}
      ${v.follow_up_date ? `<div class="visit-followup">📅 Follow-up: ${fmtDate(v.follow_up_date)}</div>` : ''}
      
      ${v.notes ? (
        v.notes.startsWith('💰') 
          ? `<div style="margin-top:8px; background:#ecfdf5; color:#059669; padding:4px 8px; border-radius:4px; font-weight:700; font-size:11px; display:inline-block; border:1px solid #a7f3d0;">${esc(v.notes)}</div>`
          : `<div class="visit-diagnosis" style="margin-top:4px;font-style:italic"><strong>Note:</strong> ${esc(v.notes)}</div>`
      ) : ''}
    </div>
  `).join('');
}

// ─── VISIT MODAL ───────────────────────────────────────
function openVisitModal() {
  if (!state.activeDrawerPatient) return;
  visitForm.reset();
  setDefaultVisitTime();
  $('visit-patient-id').value = state.activeDrawerPatient.id;
  visitModal.classList.add('open');
}
function closeVisitModal() { visitModal.classList.remove('open'); }

async function handleVisitSubmit(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(visitForm));
  Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });
  data.patient_id = $('visit-patient-id').value;

  try {
    const res = await fetch(VISITS_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      toast('success', '✅ Visit logged');
      closeVisitModal();
      await loadVisits(data.patient_id);
      await loadPatients();
    } else {
      toast('error', result.message || 'Failed to log visit');
    }
  } catch {
    toast('error', 'Network error');
  }
}

function setDefaultVisitTime() {
  const vdt = $('v-datetime');
  if (vdt) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    vdt.value = now.toISOString().slice(0,16);
  }
}

// ─── TOAST ─────────────────────────────────────────────
function toast(type, message) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${esc(message)}</span>`;
  toastCont.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

// ─── UTILS ─────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function calcAge(dob) {
  const d = new Date(dob), now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}
function calcBMI(weight, height) {
  const h = height / 100;
  const bmi = (weight / (h * h)).toFixed(1);
  const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  return `${bmi} (${cat})`;
}