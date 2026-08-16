// frontend/OPD.js
const OPD_API = '/api/opd';
const PAT_API = '/api/patients';
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
const MED_DOSE_OPTIONS = [
  '1 tablet', '2 tablets', '1 capsule', '5 ml', '10 ml', '1 tsp', '1 injection', 'Apply locally', '1 drop', '2 drops',
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
const INVESTIGATION_OPTIONS = [
  'X-Ray', 'MRI', 'CT Scan', 'Bone Density (DEXA)', 'Ultrasound',
  'CBC', 'Blood Sugar (Fasting/PP)', 'HbA1c', 'ESR/CRP', 'Serum Calcium', 'Vitamin D',
  'ECG', 'Other',
];

const state = {
  records: [],
  editingId: null,
};

// ─── Toast ─────────────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── Load query params (link from Queue's serve modal) ──
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    queue_entry_id: params.get('queue_entry_id') || '',
    appointment_id: params.get('appointment_id') || '',
    patient_id: params.get('patient_id') || '',
    patient_name: params.get('patient_name') || '',
    mobile: params.get('mobile') || '',
    age: params.get('age') || '',
    gender: params.get('gender') || '',
    doctor: params.get('doctor') || '',
  };
}

function prefillFromQuery() {
  const q = getQueryParams();
  if (q.queue_entry_id) document.getElementById('of-queue-entry-id').value = q.queue_entry_id;
  if (q.appointment_id) document.getElementById('of-appointment-id').value = q.appointment_id;
  if (q.patient_id) document.getElementById('of-patient-id').value = q.patient_id;
  if (q.patient_name) document.getElementById('of-name').value = q.patient_name;
  if (q.mobile) document.getElementById('of-mobile').value = q.mobile;
  if (q.age) document.getElementById('of-age').value = q.age;
  if (q.gender) document.getElementById('of-gender').value = q.gender;
  if (q.doctor) document.getElementById('of-doctor').value = q.doctor;
  if (q.patient_id) autofillVitalsFromPatient(q.patient_id);
}

// Fills a vitals input with a value carried over from the patient profile or a
// past visit (not freshly measured this visit) and marks it visually so the
// doctor can tell at a glance it's a carried-over value.
function setAutofilledVital(id, value) {
  const el = document.getElementById(id);
  if (el.value.trim()) return; // don't clobber a value already set for this visit
  el.value = value;
  el.classList.add('autofilled');
}

async function autofillVitalsFromPatient(patientId) {
  const idField = document.getElementById('of-patient-id-visible');
  idField.disabled = true;

  try {
    const res = await fetch(`${PAT_API}/${patientId}`);
    const data = await res.json();
    const pat = data.patient;
    if (pat?.weight_kg) setAutofilledVital('of-vital-weight', pat.weight_kg);
    if (pat?.height_cm) setAutofilledVital('of-vital-height', pat.height_cm);
    if (pat?.patient_id) idField.value = pat.patient_id;
  } catch (e) { console.error('[OPD] patient vitals lookup failed', e); }

  try {
    const res = await fetch(`${OPD_API}?patient_id=${patientId}`);
    const data = await res.json();
    const records = data.records || [];
    if (!records.length) {
      // First OPD visit for this patient — safe to let the doctor enter/correct the ID.
      idField.disabled = false;
      return;
    }
    const last = records.sort((a, b) => b.id - a.id)[0];
    let lastVitals = {};
    try { lastVitals = last.vitals ? JSON.parse(last.vitals) : {}; } catch { lastVitals = {}; }
    if (lastVitals.bp) setAutofilledVital('of-vital-bp', lastVitals.bp);
    if (lastVitals.pulse) setAutofilledVital('of-vital-pulse', lastVitals.pulse);
    if (lastVitals.weight) setAutofilledVital('of-vital-weight', lastVitals.weight);
    if (lastVitals.height) setAutofilledVital('of-vital-height', lastVitals.height);
  } catch (e) { console.error('[OPD] last vitals lookup failed', e); }
}

// ─── Form helpers ──────────────────────────────────────
function resetForm() {
  document.getElementById('opd-form').reset();
  document.getElementById('of-id').value = '';
  document.getElementById('of-queue-entry-id').value = '';
  document.getElementById('of-appointment-id').value = '';
  document.getElementById('of-patient-id').value = '';
  document.getElementById('opd-record-id').textContent = '';
  document.getElementById('of-visit-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('of-doctor').value = DEFAULT_REFERRED_BY;
  document.getElementById('of-advice').value = '';
  const idField = document.getElementById('of-patient-id-visible');
  idField.value = '';
  idField.disabled = false;
  idField.placeholder = 'First visit — enter/confirm ID';
  clearMedicineRows();
  addMedicineRow();
  clearInvestigationRows();
  addInvestigationRow();
  state.editingId = null;
  refreshAllTextareaSizes();
}

// ─── Medicine rows (structured Prescription / Medicines) ──
function clearMedicineRows() {
  document.getElementById('opd-med-list').innerHTML = '';
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Builds a <select> dropdown + a hidden "Other" text fallback for a field whose
// value might not be on the fixed picklist.
function dropdownFieldHtml(cls, options, value) {
  const isOther = value && !options.includes(value);
  const opts = options.map(o => `<option value="${escapeAttr(o)}" ${value === o ? 'selected' : ''}>${o}</option>`).join('');
  return `
    <select class="${cls}">
      <option value="">Select…</option>
      ${opts}
      <option value="__other__" ${isOther ? 'selected' : ''}>Other (type manually)</option>
    </select>
    <input type="text" class="${cls}-other" placeholder="Type custom value" value="${isOther ? escapeAttr(value) : ''}"
      style="margin-top:4px; ${isOther ? '' : 'display:none;'}" />
  `;
}

function bindOtherToggle(row, cls) {
  const select = row.querySelector(`.${cls}`);
  const other = row.querySelector(`.${cls}-other`);
  select.addEventListener('change', () => {
    other.style.display = select.value === '__other__' ? '' : 'none';
    if (select.value === '__other__') other.focus();
  });
}

function fieldValue(row, cls) {
  const select = row.querySelector(`.${cls}`);
  if (select.value === '__other__') return row.querySelector(`.${cls}-other`).value.trim();
  return select.value;
}

function addMedicineRow(med = {}) {
  const list = document.getElementById('opd-med-list');
  const row = document.createElement('div');
  row.className = 'opd-med-row';
  row.innerHTML = `
    <div><label>Medicine</label>${dropdownFieldHtml('med-name', MED_NAME_OPTIONS, med.name)}</div>
    <div><label>Dose</label>${dropdownFieldHtml('med-dose', MED_DOSE_OPTIONS, med.dose)}</div>
    <div><label>Frequency</label>${dropdownFieldHtml('med-frequency', MED_FREQUENCY_OPTIONS, med.frequency)}</div>
    <div><label>Duration</label>${dropdownFieldHtml('med-duration', MED_DURATION_OPTIONS, med.duration)}</div>
    <div><label>Route</label>${dropdownFieldHtml('med-route', MED_ROUTE_OPTIONS, med.route)}</div>
    <div><label>Instruction</label>${dropdownFieldHtml('med-instruction', MED_INSTRUCTION_OPTIONS, med.instruction)}</div>
    <button type="button" class="opd-med-remove" title="Remove">✕</button>
  `;
  ['med-name', 'med-dose', 'med-frequency', 'med-duration', 'med-route', 'med-instruction'].forEach(cls => bindOtherToggle(row, cls));
  row.querySelector('.opd-med-remove').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function collectMedicines() {
  return Array.from(document.getElementById('opd-med-list').querySelectorAll('.opd-med-row')).map(row => ({
    name: fieldValue(row, 'med-name'),
    dose: fieldValue(row, 'med-dose'),
    frequency: fieldValue(row, 'med-frequency'),
    duration: fieldValue(row, 'med-duration'),
    route: fieldValue(row, 'med-route'),
    instruction: fieldValue(row, 'med-instruction'),
  })).filter(m => m.name);
}

function medicinesToText(meds) {
  return meds.map(m => {
    const parts = [m.dose, m.frequency, m.duration].filter(Boolean).join(' | ');
    return [m.name, parts, m.instruction].filter(Boolean).join('\n');
  }).join('\n\n');
}

// ─── Investigation rows (structured Investigations Advised) ──
function clearInvestigationRows() {
  document.getElementById('opd-invest-list').innerHTML = '';
}

function addInvestigationRow(inv = {}) {
  const list = document.getElementById('opd-invest-list');
  const row = document.createElement('div');
  row.className = 'opd-invest-row';
  const options = INVESTIGATION_OPTIONS.map(opt =>
    `<option value="${opt}" ${inv.type === opt ? 'selected' : ''}>${opt}</option>`
  ).join('');
  row.innerHTML = `
    <div><label>Investigation</label><select class="inv-type"><option value="">Select…</option>${options}</select></div>
    <div><label>Detail / Area</label><input type="text" class="inv-detail" placeholder="e.g. Right Knee" value="${escapeAttr(inv.detail)}" /></div>
    <div><label>Instruction</label><input type="text" class="inv-instruction" placeholder="e.g. get done before next visit" value="${escapeAttr(inv.instruction)}" /></div>
    <div><label>Report Comment</label><input type="text" class="inv-comment" placeholder="Findings once report is in…" value="${escapeAttr(inv.comment)}" /></div>
    <button type="button" class="opd-med-remove" title="Remove">✕</button>
  `;
  row.querySelector('.opd-med-remove').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function collectInvestigations() {
  return Array.from(document.getElementById('opd-invest-list').querySelectorAll('.opd-invest-row')).map(row => ({
    type: row.querySelector('.inv-type').value,
    detail: row.querySelector('.inv-detail').value.trim(),
    instruction: row.querySelector('.inv-instruction').value.trim(),
    comment: row.querySelector('.inv-comment').value.trim(),
  })).filter(i => i.type);
}

function investigationsToText(invs) {
  return invs.map(i => {
    const label = [i.type, i.detail].filter(Boolean).join(' - ');
    const extra = [i.instruction, i.comment ? `Report: ${i.comment}` : ''].filter(Boolean).join(' | ');
    return [label, extra].filter(Boolean).join('\n');
  }).join('\n\n');
}

function fillForm(rec) {
  document.getElementById('of-id').value = rec.id;
  document.getElementById('of-queue-entry-id').value = rec.queue_entry_id || '';
  document.getElementById('of-appointment-id').value = rec.appointment_id || '';
  document.getElementById('of-patient-id').value = rec.patient_id || '';
  const idField = document.getElementById('of-patient-id-visible');
  if (rec.patient_id) {
    idField.disabled = true;
    fetch(`${PAT_API}/${rec.patient_id}`).then(r => r.json()).then(d => {
      if (d.patient?.patient_id) idField.value = d.patient.patient_id;
    }).catch(() => {});
  } else {
    idField.value = '';
    idField.disabled = false;
  }
  document.getElementById('of-name').value = rec.patient_name || '';
  document.getElementById('of-mobile').value = rec.mobile || '';
  document.getElementById('of-age').value = rec.age || '';
  document.getElementById('of-gender').value = rec.gender || '';
  document.getElementById('of-visit-date').value = rec.visit_date || '';
  document.getElementById('of-doctor').value = rec.doctor_name || DEFAULT_REFERRED_BY;
  document.getElementById('of-history').value = rec.history || '';
  document.getElementById('of-prev-illness').value = rec.previous_illness || '';
  document.getElementById('of-signs').value = rec.signs_examination || '';
  let vitals = {};
  try { vitals = rec.vitals ? JSON.parse(rec.vitals) : {}; } catch { vitals = {}; }
  document.getElementById('of-vital-bp').value = vitals.bp || '';
  document.getElementById('of-vital-pulse').value = vitals.pulse || '';
  document.getElementById('of-vital-weight').value = vitals.weight || '';
  document.getElementById('of-vital-height').value = vitals.height || '';
  document.getElementById('of-diagnosis').value = rec.diagnosis || '';
  document.getElementById('of-invest-prev').value = rec.previous_investigations || '';
  document.getElementById('of-advice').value = rec.advice || '';
  document.getElementById('of-followup').value = rec.follow_up_date || '';
  document.getElementById('of-notes').value = rec.notes || '';
  document.getElementById('opd-record-id').textContent = `Record #${rec.id}`;
  state.editingId = rec.id;

  clearMedicineRows();
  let meds = [];
  try { meds = rec.medicines ? JSON.parse(rec.medicines) : []; } catch { meds = []; }
  if (meds.length) meds.forEach(m => addMedicineRow(m));
  else addMedicineRow();

  clearInvestigationRows();
  let invs = [];
  try { invs = rec.investigations ? JSON.parse(rec.investigations) : []; } catch { invs = []; }
  if (invs.length) invs.forEach(i => addInvestigationRow(i));
  else addInvestigationRow();

  refreshAllTextareaSizes();
}

// ─── Load & render list ────────────────────────────────
async function loadRecords() {
  try {
    const res = await fetch(OPD_API);
    const data = await res.json();
    state.records = data.records || [];
    renderList();
  } catch (e) {
    toast('Failed to load OPD records', 'error');
  }
}

function renderList() {
  const listEl = document.getElementById('opd-list');
  const search = (document.getElementById('opd-search').value || '').toLowerCase();
  const filtered = state.records
    .filter(r => !search || r.patient_name?.toLowerCase().includes(search) || r.mobile?.includes(search))
    .sort((a, b) => (b.id - a.id));

  document.getElementById('opd-count-badge').textContent = `${filtered.length} records`;

  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-queue"><p>No OPD records found.</p></div>`;
    return;
  }

  listEl.innerHTML = filtered.map(r => `
    <div class="opd-record-card" data-id="${r.id}">
      <div class="opd-card-top">
        <span class="opd-card-name">${escapeHtml(r.patient_name)}</span>
        <span class="opd-card-date">${r.visit_date || ''}</span>
      </div>
      <div class="opd-card-diag">${escapeHtml(r.diagnosis || r.history || 'No diagnosis recorded')}</div>
    </div>
  `).join('');

  listEl.querySelectorAll('.opd-record-card').forEach(card => {
    card.addEventListener('click', () => {
      const rec = state.records.find(r => String(r.id) === card.dataset.id);
      if (rec) { fillForm(rec); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ─── Submit ────────────────────────────────────────────
function buildOpdPayload() {
  const name = document.getElementById('of-name').value.trim();
  const errEl = document.getElementById('of-err-name');
  if (!name) {
    errEl.textContent = 'Patient name is required';
    return null;
  }
  errEl.textContent = '';

  const medicines = collectMedicines();
  const investigations = collectInvestigations();
  return {
    patient_id: document.getElementById('of-patient-id').value || null,
    queue_entry_id: document.getElementById('of-queue-entry-id').value || null,
    appointment_id: document.getElementById('of-appointment-id').value || null,
    patient_name: name,
    mobile: document.getElementById('of-mobile').value.trim(),
    age: document.getElementById('of-age').value || null,
    gender: document.getElementById('of-gender').value || null,
    visit_date: document.getElementById('of-visit-date').value || new Date().toISOString().slice(0, 10),
    doctor_name: document.getElementById('of-doctor').value.trim() || DEFAULT_REFERRED_BY,
    history: document.getElementById('of-history').value.trim(),
    previous_illness: document.getElementById('of-prev-illness').value.trim(),
    signs_examination: document.getElementById('of-signs').value.trim(),
    vitals: {
      bp: document.getElementById('of-vital-bp').value.trim(),
      pulse: document.getElementById('of-vital-pulse').value.trim(),
      weight: document.getElementById('of-vital-weight').value.trim(),
      height: document.getElementById('of-vital-height').value.trim(),
    },
    diagnosis: document.getElementById('of-diagnosis').value.trim(),
    investigations,
    investigations_advised: investigationsToText(investigations),
    previous_investigations: document.getElementById('of-invest-prev').value.trim(),
    medicines,
    prescription: medicinesToText(medicines),
    advice: document.getElementById('of-advice').value.trim(),
    follow_up_date: document.getElementById('of-followup').value || null,
    notes: document.getElementById('of-notes').value.trim(),
  };
}

async function saveOpdRecord(payload) {
  const id = state.editingId;
  const res = await fetch(id ? `${OPD_API}/${id}` : OPD_API, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);

  // Keep the patient's profile in sync with the latest measured weight/height.
  if (payload.patient_id && (payload.vitals?.weight || payload.vitals?.height)) {
    const patchBody = {};
    if (payload.vitals.weight) patchBody.weight_kg = payload.vitals.weight;
    if (payload.vitals.height) patchBody.height_cm = payload.vitals.height;
    fetch(`${PAT_API}/${payload.patient_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    }).catch(e => console.error('[OPD] patient vitals sync failed', e));
  }

  // First-visit patients can have their Patient ID entered/corrected right here.
  const idField = document.getElementById('of-patient-id-visible');
  if (payload.patient_id && idField && !idField.disabled && idField.value.trim()) {
    fetch(`${PAT_API}/${payload.patient_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: idField.value.trim() }),
    }).catch(e => console.error('[OPD] patient ID sync failed', e));
  }

  return { id: id || data.id, ...payload };
}

async function handleSubmit(e) {
  e.preventDefault();
  const payload = buildOpdPayload();
  if (!payload) return;

  try {
    const wasEditing = !!state.editingId;
    await saveOpdRecord(payload);
    toast(wasEditing ? 'OPD record updated' : 'OPD record saved');
    resetForm();
    loadRecords();
  } catch (err) {
    toast(err.message || 'Save failed', 'error');
  }
}

async function handlePrint() {
  const payload = buildOpdPayload();
  if (!payload) return;

  try {
    const saved = await saveOpdRecord(payload);
    toast('OPD record saved — opening print preview…');
    printOpdRecord(saved);
    loadRecords();
  } catch (err) {
    toast(err.message || 'Save failed', 'error');
  }
}

// ─── Printable Prescription ───────────────────────────
function printOpdRecord(rec) {
  const age = rec.age ? `${rec.age}Y ${rec.gender || ''}`.trim() : '—';
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
      .rx-footer { display: flex; justify-content: space-between; margin-top: 50px; }
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
        <div><b>Age / Gender</b>${age}</div>
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

      <div class="rx-footer">
        <div></div>
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

// ─── Init ──────────────────────────────────────────────
function bindEvents() {
  document.getElementById('opd-form').addEventListener('submit', handleSubmit);
  document.getElementById('opd-clear-btn').addEventListener('click', resetForm);
  document.getElementById('opd-print-btn').addEventListener('click', handlePrint);
  document.getElementById('opd-add-med-btn').addEventListener('click', () => addMedicineRow());
  document.getElementById('opd-add-invest-btn').addEventListener('click', () => addInvestigationRow());
  document.getElementById('new-opd-btn').addEventListener('click', () => {
    resetForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('opd-search').addEventListener('input', renderList);
  document.querySelectorAll('#opd-form .opd-vital-box input').forEach(input => {
    input.addEventListener('input', () => input.classList.remove('autofilled'));
  });
  bindAdviceBullets('of-advice');
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
  const el = document.getElementById(id);
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

document.addEventListener('DOMContentLoaded', () => {
  resetForm();
  prefillFromQuery();
  bindEvents();
  bindTextareaAutosize();
  refreshAllTextareaSizes();
  loadRecords();
});

// ─── Auto-growing textareas ─────────────────────────────
// Every textarea in the form grows with its content instead of scrolling internally.
function autosizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function refreshAllTextareaSizes() {
  document.querySelectorAll('textarea').forEach(autosizeTextarea);
}

function bindTextareaAutosize() {
  document.addEventListener('input', e => {
    if (e.target.tagName === 'TEXTAREA') autosizeTextarea(e.target);
  });
}
