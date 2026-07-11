/* ═══════════════════════════════════════════════════
   dashboard.js — ClinicBase Dashboard
   Connects to: /api/dashboard/* endpoints
═══════════════════════════════════════════════════ */

'use strict';

// ─── STATE ──────────────────────────────────────────
const State = {
    range: 'today',
    from: '',
    to: '',
    patientPage: 1,      // Added for pagination
    patientSearch: '',   // Added for filtering
    charts: {},
    currentPatient: null,
    drawerTab: 'overview',
};

// ─── HELPERS ────────────────────────────────────────
const $ = id => document.getElementById(id);
const today = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

function getDateRange(range) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const d = new Date(now);
    switch (range) {
        case 'today': return { from: fmt(d), to: fmt(d) };
        case 'week': {
            const day = d.getDay();
            const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
            return { from: fmt(mon), to: fmt(d) };
        }
        case 'month': {
            return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: fmt(d) };
        }
        case 'quarter': {
            const qStart = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
            return { from: fmt(qStart), to: fmt(d) };
        }
        case 'year': {
            return { from: `${d.getFullYear()}-01-01`, to: fmt(d) };
        }
        default: return { from: State.from, to: State.to };
    }
}

function fmtMoney(n) {
    if (n === null || n === undefined) return '₹0';
    return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtNum(n) {
    return Number(n || 0).toLocaleString('en-IN');
}

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function fmtTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function statusBadge(s) {
    return `<span class="status-badge status-${s}">${s}</span>`;
}

function priorityBadge(p) {
    return `<span class="priority-badge priority-${p || 'NORMAL'}">${p || 'NORMAL'}</span>`;
}

function toast(msg, type = 'info') {
    const icons = {
        success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
        error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icons[type] || icons.info} <span>${msg}</span>`;
    $('toastContainer').appendChild(el);
    setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 220); }, 3200);
}

// ─── CLOCK ──────────────────────────────────────────
function startClock() {
    const el = $('clock');
    const tick = () => {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('en-IN', { hour12: false });
    };
    tick();
    setInterval(tick, 1000);
}

// ─── API CALLS ───────────────────────────────────────
async function apiFetch(url) {
    const baseUrl = '';
    const r = await fetch(`${baseUrl}${url}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

// ─── MAIN LOAD ───────────────────────────────────────
async function loadDashboard() {
    const { from, to } = State.range === 'custom'
        ? { from: State.from, to: State.to }
        : getDateRange(State.range);

    if (!from || !to) return toast('Select a valid date range', 'error');

    State.from = from;
    State.to = to;

    $('lastUpdated').textContent = 'Loading…';
    $('refreshBtn').querySelector('svg').classList.add('spin');

    try {
        const [kpi, trend, breakdown, doctors] = await Promise.all([
            apiFetch(`/api/dashboard/kpi?from=${from}&to=${to}`),
            apiFetch(`/api/dashboard/trend?from=${from}&to=${to}&group=${$('revenueChartGroup').value}`),
            apiFetch(`/api/dashboard/breakdown?from=${from}&to=${to}`),
        ]);

        renderKPI(kpi.data);
        renderCharts(trend.data, breakdown.data);
        $('lastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour12: false });
    } catch (e) {
        toast('Failed to load dashboard: ' + e.message, 'error');
        console.error(e);
    } finally {
        $('refreshBtn').querySelector('svg').classList.remove('spin');
    }
}

// ─── KPI RENDER ──────────────────────────────────────
function renderKPI(d) {
    // Determine text based on current selected filter
    const rangeLabels = {
        'today': 'today',
        'week': 'this week',
        'month': 'this month',
        'quarter': 'this quarter',
        'year': 'this year',
        'custom': 'in selected period'
    };
    const periodText = rangeLabels[State.range] || 'in period';

    // Make Total Revenue show the collected amount with dynamic subtext
    $('kRevenue').textContent = fmtMoney(d.total_collected);
    $('kRevenueSub').textContent = `Total revenue ${periodText}`;

    $('kPatients').textContent = fmtNum(d.total_patients);
    $('kPatientsSub').textContent = `Registered in system`;

    $('kVisits').textContent = fmtNum(d.total_visits);
    $('kVisitsSub').textContent = `Patient visit records`;

    $('kAppts').textContent = fmtNum(d.total_appointments);
    $('kApptsSub').textContent = `Booked appointments`;

    $('kWalkins').textContent = fmtNum(d.total_footfall);
    $('kWalkinsSub').textContent = 'Checked in today (walk-in + appointment)';

    $('kDone').textContent = fmtNum(d.total_done);
    $('kDoneSub').textContent = `Fully served patients`;

    $('kNoshow').textContent = fmtNum(d.total_noshow + d.total_missed);
    $('kNoshowSub').textContent = `No-shows: ${d.total_noshow}, Missed: ${d.total_missed}`;

    $('kSms').textContent = fmtNum(d.total_sms);
    $('kSmsSub').textContent = `SMS sent in period`;

    $('kNewPat').textContent = fmtNum(d.new_patients);
    $('kNewPatSub').textContent = `Registered in this period`;

    const avgFee = d.total_done > 0 ? (d.total_collected / d.total_done) : 0;
    $('kAvgFee').textContent = fmtMoney(avgFee);
    $('kAvgFeeSub').textContent = `Per completed visit`;

    $('kWaiting').textContent = fmtNum(d.total_waiting);
    $('kWaitingSub').textContent = `Currently in queue`;
}

// ─── CHARTS ──────────────────────────────────────────
function renderCharts(trend, breakdown) {
    // Revenue trend
    buildBarChart('revenueChart', {
        labels: trend.map(r => r.label),
        values: trend.map(r => r.revenue),
        color: '#2563EB',
        label: 'Revenue (₹)',
        yFmt: v => '₹' + Number(v).toLocaleString('en-IN'),
    });

    // Patient trend
    buildBarChart('patientChart', {
        labels: trend.map(r => r.label),
        values: trend.map(r => r.visits),
        color: '#7c3aed',
        label: 'Visits',
        yFmt: v => v,
    });

    // Visit type donut
    buildDoughnut('visitTypeChart', breakdown.visit_types);

    // Status donut
    buildDoughnut('statusChart', breakdown.statuses, [
        '#059669', '#2563EB', '#0891b2', '#d97706', '#dc2626', '#ea580c', '#7c3aed'
    ]);

    // Priority bar
    buildDoughnut('priorityChart', breakdown.priorities, ['#dc2626', '#7c3aed', '#94a3b8']);
}

function buildBarChart(canvasId, { labels, values, color, label, yFmt }) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (State.charts[canvasId]) State.charts[canvasId].destroy();

    State.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label,
                data: values,
                backgroundColor: color + '22',
                borderColor: color,
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => yFmt(ctx.parsed.y) }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 11, family: 'JetBrains Mono' } } },
                y: { grid: { color: 'rgba(15,23,42,0.05)' }, ticks: { font: { size: 11 }, callback: yFmt } }
            }
        }
    });
}

function buildDoughnut(canvasId, items, colors) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (State.charts[canvasId]) State.charts[canvasId].destroy();

    const defaultColors = ['#2563EB', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#ea580c'];
    const palette = colors || defaultColors;

    if (!items || items.length === 0) {
        State.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['No data'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
        return;
    }

    State.charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: items.map(i => i.label),
            datasets: [{
                data: items.map(i => i.count),
                backgroundColor: items.map((_, idx) => palette[idx % palette.length]),
                borderWidth: 2,
                borderColor: '#ffffff',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 12 } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.parsed} (${((ctx.parsed / ctx.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`
                    }
                }
            }
        }
    });
}

// ─── DOCTORS ─────────────────────────────────────────
function renderDoctors(doctors) {
    const grid = $('doctorGrid');
    if (!doctors || doctors.length === 0) {
        grid.innerHTML = '<div class="empty-state">No doctor data for this period.</div>';
        return;
    }
    grid.innerHTML = doctors.map(d => `
    <div class="doctor-card">
      <div class="doctor-avatar">${(d.doctor || 'U')[0].toUpperCase()}</div>
      <div class="doctor-name">${d.doctor || 'Unassigned'}</div>
      <div class="doctor-stats">${fmtNum(d.visits)} visits · ${fmtNum(d.done)} done</div>
      <div class="doctor-revenue">${fmtMoney(d.revenue)}</div>
    </div>
  `).join('');
}


// ─── PATIENT DIRECTORY TABLE ─────────────────────────
async function loadPatientTable(page = 1) {
    State.patientPage = page;
    try {
        const url = `/api/dashboard/all-patients?page=${page}&search=${encodeURIComponent(State.patientSearch || '')}`;
        const data = await apiFetch(url);
        renderPatientTable(data);
    } catch (e) {
        toast('Failed to load patient directory', 'error');
    }
}

function renderPatientTable(res) {
    const { data, total, page } = res;
    $('patientTableCount').textContent = `${fmtNum(total)} total patients`;

    const tbody = $('patientTableBody');
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--text-faint)">No patients found</td></tr>`;
    } else {
        tbody.innerHTML = data.map(p => {
            // Gender badge styling
            const g = (p.gender || '').toUpperCase()[0];
            let gBg = '#f1f5f9', gCol = '#64748b';
            if (g === 'M') { gBg = '#eff6ff'; gCol = '#2563eb'; }
            if (g === 'F') { gBg = '#fdf4ff'; gCol = '#9333ea'; }

            return `
      <tr class="clickable-row" data-pid="${p.id}" style="cursor:pointer;">
        <td>
          <span style="font-family:var(--font-mono);font-size:11.5px;color:var(--text-muted);">
            ${p.patient_id || '—'}
          </span>
        </td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:3px 8px;border-radius:4px;font-size:11.5px;font-weight:600;white-space:nowrap;">
            <svg viewBox="0 0 14 14" fill="none" style="width:11px;height:11px;opacity:0.8"><rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M4 1v3M10 1v3M2 6h10" stroke="currentColor" stroke-width="1.3"/></svg>
            ${fmtDate(p.created_at)}
          </span>
        </td>
        <td>
          <span style="font-weight:600;color:var(--text)">${escHtml(p.full_name)}</span>
        </td>
        <td>
          ${p.mobile ? `
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:#0891b2;background:#ecfeff;padding:3px 8px;border-radius:4px;font-weight:600;">
            <svg viewBox="0 0 14 14" fill="none" style="width:10px;height:10px;"><rect x="3" y="1" width="8" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><circle cx="7" cy="11" r="0.7" fill="currentColor"/></svg>
            ${p.mobile}
          </span>
          ` : '<span style="color:var(--text-faint)">—</span>'}
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:6px;">
            ${p.age ? `<span style="display:inline-block;padding:2px 8px;border-radius:100px;background:#fffbeb;color:#d97706;border:1px solid #fde68a;font-weight:800;font-size:11px;letter-spacing:0.05em;">${p.age}Y</span>` : '<span style="color:var(--text-faint)">—</span>'}
            <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:${gBg};color:${gCol};">
              ${p.gender ? p.gender.charAt(0).toUpperCase() : '—'}
            </span>
          </div>
        </td>
        <td style="font-size:12px;color:var(--text-muted)">${escHtml(p.city || '—')}</td>
      </tr>
    `}).join('');

        tbody.querySelectorAll('.clickable-row').forEach(tr => {
            tr.addEventListener('click', () => {
                openPatientDrawer(tr.dataset.pid);
            });
        });
    }

    renderPagination('patientTablePagination', total, page, 10, p => loadPatientTable(p));
}

// ─── PAGINATION ──────────────────────────────────
function renderPagination(containerId, total, page, pageSize, onPage) {
    const container = $(containerId);
    const pages = Math.ceil(total / pageSize);
    if (pages <= 1) { container.innerHTML = ''; return; }

    // Next / Previous logic
    const prevBtn = `<button class="pg-btn" ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">Previous</button>`;
    const nextBtn = `<button class="pg-btn" ${page >= pages ? 'disabled' : ''} data-p="${page + 1}">Next</button>`;

    container.innerHTML = `
    <div style="display:flex; gap: 8px; align-items: center;">
      ${prevBtn}
      <span style="font-size: 12px; color: var(--text-muted);">Page ${page} of ${pages}</span>
      ${nextBtn}
    </div>
  `;

    // Bind click events to the new buttons
    container.querySelectorAll('.pg-btn').forEach(b =>
        b.addEventListener('click', () => onPage(parseInt(b.dataset.p)))
    );
}

// ─── DAILY SNAPSHOT ──────────────────────────────────
async function loadDaySnapshot(date) {
    try {
        const data = await apiFetch(`/api/dashboard/day?date=${date}`);
        const d = data.data;

        $('dRevenue').textContent = fmtMoney(d.collected);
        $('dAppts').textContent = fmtNum(d.appointments);
        $('dWalkins').textContent = fmtNum(d.walkins);
        $('dDone').textContent = fmtNum(d.done);
        $('dNoshow').textContent = fmtNum(d.noshow);
        $('dNewReg').textContent = fmtNum(d.new_reg || 0);

        $('dayTableTitle').textContent = `Queue for ${fmtDate(date)}`;
        $('dayApptCount').textContent = `${d.entries.length} entries`;

        const tbody = $('dayApptBody');
        if (!d.entries.length) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-faint)">No entries for this date</td></tr>`;
        } else {
            tbody.innerHTML = d.entries.map(r => `
        <tr>
          <td><span class="token-pill">${r.token_number}</span></td>
          <td><span class="patient-link" data-pid="${r.patient_id}" style="font-weight:600;cursor:pointer;color:var(--primary)">${escHtml(r.patient_name)}</span></td>
          <td style="font-size:12px;color:var(--secondary)">${r.mobile || '—'}</td>
          <td><span style="font-size:11px;padding:2px 7px;border-radius:4px;background:var(--surface-2);border:1px solid var(--border)">${r.ticket_type}</span></td>
          <td style="font-size:12px;color:var(--text-muted)">${escHtml(r.doctor) || '—'}</td>
          <td style="font-family:var(--font-mono);font-size:12px">${r.slot_time || '—'}</td>
          <td>${priorityBadge(r.priority)}</td>
          <td>${statusBadge(r.status)}</td>
          <td style="font-family:var(--font-mono);font-weight:600">${fmtMoney(r.fee)}</td>
          <td style="font-family:var(--font-mono);font-weight:600;color:var(--success)">${fmtMoney(r.amount_paid)}</td>
        </tr>
      `).join('');
        }

        tbody.querySelectorAll('.patient-link').forEach(el => {
            el.addEventListener('click', () => {
                const pid = el.dataset.pid;
                if (pid && pid !== 'null') openPatientDrawer(pid);
            });
        });

        // Render missed / not-checked-in appointments
        const missed = d.no_show_appointments || [];
        $('dayMissedApptCount').textContent = `${missed.length} records`;
        const missedTbody = $('dayMissedApptBody');
        if (!missed.length) {
            missedTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-faint)">All booked patients checked in</td></tr>`;
        } else {
            missedTbody.innerHTML = missed.map(a => `
    <tr>
      <td><span class="patient-link" data-pid="${a.patient_id}" style="font-weight:600;cursor:pointer;color:var(--primary)">${escHtml(a.patient_name)}</span></td>
      <td style="font-size:12px;color:var(--secondary)">${a.mobile || '—'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${escHtml(a.doctor) || '—'}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${a.slot_time || '—'}</td>
      <td>${priorityBadge(a.priority)}</td>
      <td><span class="status-badge NOSHOW" style="background:#fee2e2;color:#dc2626;border:1px solid #fecaca;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">NOT CHECKED-IN</span></td>
      <td style="font-family:var(--font-mono);font-weight:600">${fmtMoney(a.fee)}</td>
    </tr>
  `).join('');
        }

        missedTbody.querySelectorAll('.patient-link').forEach(el => {
            el.addEventListener('click', () => {
                const pid = el.dataset.pid;
                if (pid && pid !== 'null') openPatientDrawer(pid);
            });
        });
    } catch (e) {
        toast('Failed to load day data: ' + e.message, 'error');
    }
}

// ─── PATIENT DRAWER ───────────────────────────────────
async function openPatientDrawer(patientId) {
    if (!patientId || patientId === 'null') return;
    try {
        const data = await apiFetch(`/api/patients/${patientId}`);
        const p = data.patient;
        State.currentPatient = p;

        $('drawerAvatar').textContent = (p.full_name || '?')[0].toUpperCase();
        $('drawerName').textContent = p.full_name || 'Unknown';
        $('drawerPid').textContent = p.patient_id || `ID: ${p.id}`;

        renderDrawerTab('overview');

        $('drawerOverlay').classList.add('open');
        $('patientDrawer').classList.add('open');
    } catch (e) {
        toast('Could not load patient: ' + e.message, 'error');
    }
}

function renderDrawerTab(tab) {
    const p = State.currentPatient;
    if (!p) return;
    State.drawerTab = tab;

    document.querySelectorAll('.drawer-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tab)
    );

    const body = $('drawerBody');

    if (tab === 'overview') {
        const fields = [
            ['Patient ID', p.patient_id, 'mono'],
            ['Mobile', p.mobile],
            ['Alt Mobile', p.alt_mobile],
            ['Email', p.email],
            ['DOB', fmtDate(p.dob)],
            ['Age', p.age ? `${p.age} yrs` : '—'],
            ['Gender', p.gender],
            ['Blood Group', p.blood_group],
            ['Height', p.height_cm ? `${p.height_cm} cm` : '—'],
            ['Weight', p.weight_kg ? `${p.weight_kg} kg` : '—'],
            ['City', p.city],
            ['PIN', p.pin_code],
            ['Department', p.department],
            ['Doctor', p.assigned_doctor],
            ['Visit Type', p.visit_type],
            ['Insurance', p.insurance_policy],
            ['Emergency Contact', p.emergency_contact_name],
            ['Emergency Mobile', p.emergency_contact_mobile],
            ['Registered', fmtDate(p.created_at)],
            ['Total Visits', p.visit_count || 0],
        ];

        const medSection = (p.allergies || p.chronic_conditions || p.current_medications) ? `
      <div style="margin-top:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Medical Info</div>
        ${p.allergies ? `<div class="visit-item"><div class="info-label">Allergies</div><div style="font-size:13px">${escHtml(p.allergies)}</div></div>` : ''}
        ${p.chronic_conditions ? `<div class="visit-item"><div class="info-label">Chronic Conditions</div><div style="font-size:13px">${escHtml(p.chronic_conditions)}</div></div>` : ''}
        ${p.current_medications ? `<div class="visit-item"><div class="info-label">Current Medications</div><div style="font-size:13px">${escHtml(p.current_medications)}</div></div>` : ''}
      </div>
    ` : '';

        body.innerHTML = `
      <div class="info-grid">
        ${fields.map(([lbl, val, cls]) => `
          <div class="info-item">
            <span class="info-label">${lbl}</span>
            <span class="info-val ${cls || ''}">${val || '—'}</span>
          </div>
        `).join('')}
      </div>
      ${p.chief_complaint ? `<div class="visit-item"><div class="info-label">Chief Complaint</div><div style="font-size:13px">${escHtml(p.chief_complaint)}</div></div>` : ''}
      ${p.notes ? `<div class="visit-item"><div class="info-label">Notes</div><div style="font-size:13px">${escHtml(p.notes)}</div></div>` : ''}
      ${medSection}
    `;
    }

    if (tab === 'visits') {
        const visits = p.visits || [];
        if (!visits.length) {
            body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div>No visit records yet.</div>`;
            return;
        }
        body.innerHTML = visits.map(v => `
      <div class="visit-item">
        <div class="visit-item-header">
          <span class="visit-date">${fmtDate(v.visit_date)} ${v.visit_date ? fmtTime(v.visit_date) : ''}</span>
          <span class="visit-type-badge">${v.visit_type || 'OPD'}</span>
        </div>
        ${v.doctor ? `<div class="visit-doctor">Dr. ${escHtml(v.doctor)}</div>` : ''}
        ${v.complaint ? `<div class="visit-complaint"><strong>Complaint:</strong> ${escHtml(v.complaint)}</div>` : ''}
        ${v.diagnosis ? `<div class="visit-complaint"><strong>Diagnosis:</strong> ${escHtml(v.diagnosis)}</div>` : ''}
        ${v.prescription ? `<div class="visit-complaint"><strong>Rx:</strong> ${escHtml(v.prescription)}</div>` : ''}
        ${v.notes ? `<div class="visit-complaint" style="color:var(--text-muted)">${escHtml(v.notes)}</div>` : ''}
      </div>
    `).join('');
    }

    if (tab === 'queue') {
        // Load queue history for this patient
        apiFetch(`/api/dashboard/patient-queue?patient_id=${p.id}`)
            .then(data => {
                const entries = data.data || [];
                if (!entries.length) {
                    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🕓</div>No queue history found.</div>`;
                    return;
                }
                body.innerHTML = entries.map(e => `
          <div class="visit-item">
            <div class="visit-item-header">
              <span class="visit-date">${fmtDate(e.queue_date)}</span>
              ${statusBadge(e.status)}
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap">
              <span class="token-pill">#${e.token_number}</span>
              ${e.ticket_type ? `<span style="font-size:11px;color:var(--text-muted)">${e.ticket_type}</span>` : ''}
              ${e.doctor ? `<span style="font-size:11px;color:var(--text-muted)">Dr. ${escHtml(e.doctor)}</span>` : ''}
            </div>
            <div style="margin-top:6px;display:flex;gap:12px">
              <span style="font-size:12px">Fee: <strong style="font-family:var(--font-mono)">${fmtMoney(e.fee)}</strong></span>
              <span style="font-size:12px;color:var(--success)">Paid: <strong style="font-family:var(--font-mono)">${fmtMoney(e.amount_paid)}</strong></span>
            </div>
            ${e.chief_complaint ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">${escHtml(e.chief_complaint)}</div>` : ''}
          </div>
        `).join('');
            })
            .catch(() => {
                body.innerHTML = `<div class="empty-state">Could not load queue history.</div>`;
            });
    }
}

function closeDrawer() {
    $('drawerOverlay').classList.remove('open');
    $('patientDrawer').classList.remove('open');
    State.currentPatient = null;
}

// ─── PATIENT SEARCH ───────────────────────────────────
let searchTimer;
function handleSearch(e) {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    const box = $('searchResults');
    if (q.length < 2) { box.classList.remove('show'); return; }

    searchTimer = setTimeout(async () => {
        try {
            const data = await apiFetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
            const results = data.results || [];
            if (!results.length) {
                box.innerHTML = `<div class="search-no-result">No patients found for "${escHtml(q)}"</div>`;
            } else {
                box.innerHTML = results.map(p => `
          <div class="search-result-item" data-id="${p.id}">
            <div class="search-result-avatar">${(p.full_name || '?')[0].toUpperCase()}</div>
            <div>
              <div class="search-result-name">${escHtml(p.full_name)}</div>
              <div class="search-result-meta">${p.patient_id || ''} · ${p.mobile || 'No mobile'} · Age ${p.age || '?'}</div>
            </div>
          </div>
        `).join('');
                box.querySelectorAll('.search-result-item').forEach(item =>
                    item.addEventListener('click', () => {
                        openPatientDrawer(item.dataset.id);
                        box.classList.remove('show');
                        $('globalSearch').value = '';
                    })
                );
            }
            box.classList.add('show');
        } catch { }
    }, 280);
}

// ─── CHART TREND RELOAD ON GROUP CHANGE ──────────────
async function reloadTrend() {
    const { from, to } = State;
    if (!from || !to) return;
    try {
        const data = await apiFetch(`/api/dashboard/trend?from=${from}&to=${to}&group=${$('revenueChartGroup').value}`);
        buildBarChart('revenueChart', {
            labels: data.data.map(r => r.label),
            values: data.data.map(r => r.revenue),
            color: '#2563EB', label: 'Revenue (₹)',
            yFmt: v => '₹' + Number(v).toLocaleString('en-IN'),
        });
    } catch { }
}

async function reloadPatientTrend() {
    const { from, to } = State;
    if (!from || !to) return;
    try {
        const data = await apiFetch(`/api/dashboard/trend?from=${from}&to=${to}&group=${$('patientChartGroup').value}`);
        buildBarChart('patientChart', {
            labels: data.data.map(r => r.label),
            values: data.data.map(r => r.visits),
            color: '#7c3aed', label: 'Visits',
            yFmt: v => v,
        });
    } catch { }
}

// ─── UTIL ──────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── EVENT BINDING ────────────────────────────────────
function bindEvents() {
    // Range pills
    document.querySelectorAll('.range-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.range-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.range = btn.dataset.range;
            if (State.range === 'custom') {
                $('customRange').classList.add('show');
            } else {
                $('customRange').classList.remove('show');
                loadDashboard();
            }
        });
    });

    $('applyRange').addEventListener('click', () => {
        State.from = $('dateFrom').value;
        State.to = $('dateTo').value;
        if (!State.from || !State.to) return toast('Select both dates', 'error');
        if (State.from > State.to) return toast('From must be before To', 'error');
        loadDashboard();
    });

    $('refreshBtn').addEventListener('click', loadDashboard);

    // Day picker
    $('dayPicker').value = today();
    $('loadDayBtn').addEventListener('click', () => {
        const d = $('dayPicker').value;
        if (d) loadDaySnapshot(d);
    });

    // Chart group change
    $('revenueChartGroup').addEventListener('change', reloadTrend);
    $('patientChartGroup').addEventListener('change', reloadPatientTrend);

    // Patient Table Live Search (Replacing the old Activity Filters)
    $('patientTableSearch').addEventListener('input', (e) => {
        State.patientSearch = e.target.value;
        clearTimeout(window.patientSearchTimer);
        window.patientSearchTimer = setTimeout(() => {
            loadPatientTable(1);
        }, 300);
    });

    // Search
    $('globalSearch').addEventListener('input', handleSearch);
    document.addEventListener('click', e => {
        if (!e.target.closest('.search-wrap')) $('searchResults').classList.remove('show');
    });

    // Drawer
    $('drawerClose').addEventListener('click', closeDrawer);
    $('drawerOverlay').addEventListener('click', closeDrawer);
    document.querySelectorAll('.drawer-tab').forEach(tab => {
        tab.addEventListener('click', () => renderDrawerTab(tab.dataset.tab));
    });
}

// ─── INIT ──────────────────────────────────────────────
(async function init() {
    startClock();
    bindEvents();
    $('dayPicker').value = today();
    await loadDashboard();
    await loadDaySnapshot(today());
    await loadPatientTable(1); // Load the new patient directory
})();