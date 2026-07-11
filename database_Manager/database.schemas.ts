// database_Manager/database.schemas.ts
// ═══════════════════════════════════════════════════════════════
// Unified schemas — Patients, Queue, Appointments, Tenants, etc.
// ═══════════════════════════════════════════════════════════════

// ─── PATIENT SCHEMA ───────────────────────────────────────────
export const PATIENT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS patients (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id                  TEXT UNIQUE,
    full_name                   TEXT NOT NULL,
    mobile                      TEXT,
    alt_mobile                  TEXT,
    email                       TEXT,
    dob                         TEXT,
    age                         INTEGER,
    gender                      TEXT,
    blood_group                 TEXT,
    height_cm                   REAL,
    weight_kg                   REAL,
    allergies                   TEXT,
    chronic_conditions          TEXT,
    current_medications         TEXT,
    address                     TEXT,
    city                        TEXT,
    pin_code                    TEXT,
    emergency_contact_name      TEXT,
    emergency_contact_mobile    TEXT,
    emergency_contact_relation  TEXT,
    visit_type                  TEXT,
    department                  TEXT,
    assigned_doctor             TEXT,
    insurance_policy            TEXT,
    chief_complaint             TEXT,
    notes                       TEXT,
    tenant_id                   TEXT DEFAULT 'default',
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_patients_full_name  ON patients(full_name);
  CREATE INDEX IF NOT EXISTS idx_patients_mobile     ON patients(mobile);
  CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id);
  CREATE INDEX IF NOT EXISTS idx_patients_tenant     ON patients(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at DESC);

  CREATE TABLE IF NOT EXISTS patient_visits (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_date      TEXT NOT NULL,
    visit_type      TEXT,
    doctor          TEXT,
    complaint       TEXT,
    diagnosis       TEXT,
    prescription    TEXT,
    follow_up_date  TEXT,
    notes           TEXT,
    created_at      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON patient_visits(patient_id);
  CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON patient_visits(visit_date DESC);
`;

// ─── QUEUE SCHEMA (replaces both old definitions) ────────────
export const QUEUE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS queue_entries (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id        INTEGER,
    patient_name      TEXT NOT NULL,
    mobile            TEXT,
    ticket_type       TEXT NOT NULL DEFAULT 'WALKIN',
    visit_type        TEXT,
    doctor            TEXT,
    priority          TEXT NOT NULL DEFAULT 'NORMAL',
    status            TEXT NOT NULL DEFAULT 'WAITING',
    token_number      INTEGER NOT NULL,
    queue_date        TEXT NOT NULL,
    slot_time         TEXT,
    appointment_id    INTEGER,
    fee               REAL DEFAULT 0,
    amount_paid       REAL DEFAULT 0,
    chief_complaint   TEXT,
    start_time        TEXT,
    end_time          TEXT,
    notes             TEXT,
    prescription      TEXT,       
    follow_up_date    TEXT,     
    called_at         TEXT,
    served_at         TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_queue_date     ON queue_entries(queue_date);
  CREATE INDEX IF NOT EXISTS idx_queue_status   ON queue_entries(status);
  CREATE INDEX IF NOT EXISTS idx_queue_patient  ON queue_entries(patient_id);

  CREATE TABLE IF NOT EXISTS appointments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id        INTEGER,
    patient_name      TEXT NOT NULL,
    mobile            TEXT,
    appt_date         TEXT NOT NULL,
    slot_time         TEXT,
    duration_min      INTEGER DEFAULT 15,
    doctor            TEXT,
    visit_type        TEXT DEFAULT 'Consultation',
    priority          TEXT DEFAULT 'NORMAL',
    fee               REAL DEFAULT 0,
    notes             TEXT,
    status            TEXT DEFAULT 'WAITING',
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_appts_date     ON appointments(appt_date);
  CREATE INDEX IF NOT EXISTS idx_appts_patient  ON appointments(patient_id);
  CREATE INDEX IF NOT EXISTS idx_appts_status   ON appointments(status);

  CREATE TABLE IF NOT EXISTS sms_logs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_entry_id    INTEGER,
    mobile            TEXT NOT NULL,
    message           TEXT NOT NULL,
    status            TEXT DEFAULT 'QUEUED',
    created_at        TEXT NOT NULL
  );
`;

// ─── TENANT SCHEMA ────────────────────────────────────────────
export const TENANT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS tenants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id   TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    type        TEXT DEFAULT 'clinic',
    plan        TEXT DEFAULT 'basic',
    timezone    TEXT DEFAULT 'Asia/Kolkata',
    config      TEXT DEFAULT '{}',
    active      INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tenant_locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id   TEXT NOT NULL REFERENCES tenants(tenant_id),
    name        TEXT NOT NULL,
    address     TEXT,
    city        TEXT,
    active      INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL
  );
`;

// ─── STAFF SCHEMA ─────────────────────────────────────────────
export const STAFF_SCHEMA = `
  CREATE TABLE IF NOT EXISTS staff (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT DEFAULT 'staff',
    mobile      TEXT,
    email       TEXT,
    department  TEXT,
    active      INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS staff_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id    INTEGER NOT NULL REFERENCES staff(id),
    tenant_id   TEXT NOT NULL,
    service_id  INTEGER,
    counter_no  TEXT,
    status      TEXT DEFAULT 'active',
    started_at  TEXT NOT NULL,
    ended_at    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_staff  ON staff_sessions(staff_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON staff_sessions(tenant_id, status);
`;

// ─── ANALYTICS SCHEMA ─────────────────────────────────────────
export const ANALYTICS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS analytics_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id   TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    ticket_id   INTEGER,
    patient_id  INTEGER,
    service_id  INTEGER,
    staff_id    INTEGER,
    payload     TEXT DEFAULT '{}',
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_tenant  ON analytics_events(tenant_id, event_type);
  CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events(created_at DESC);
`;

// ─── FULL COMBINED SCHEMA ─────────────────────────────────────
export const FULL_SCHEMA =
  PATIENT_SCHEMA +
  QUEUE_SCHEMA +
  TENANT_SCHEMA +
  STAFF_SCHEMA +
  ANALYTICS_SCHEMA;