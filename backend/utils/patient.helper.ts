// backend/utils/patient.helper.ts
import DynamicDatabaseService from '../../database_Manager/database.service';
import { PATIENT_SCHEMA } from '../../database_Manager/database.schemas';

const patientDb = DynamicDatabaseService.getDatabase('patients', PATIENT_SCHEMA);

function generatePatientId(): string {
    const now = new Date();
    const yr = now.getFullYear().toString().slice(-2);
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `P${yr}${mo}-${rand}`;
}

// Reuses an existing patient by mobile if one exists, otherwise registers a new
// patient record — so patients created via Walk-in/Appointment booking show up
// in the Patients list the same way as patients added through the Add Patient page.
export async function findOrCreatePatient(opts: { full_name: string; mobile?: string | null; visit_type?: string | null; }): Promise<number> {
    const name = opts.full_name?.trim();
    const mobile = opts.mobile?.trim() || null;

    if (mobile) {
        const existing = await patientDb.selectOne('patients', 'mobile = ?', [mobile]) as any;
        if (existing) return existing.id;
    }

    const now = new Date().toISOString();
    return patientDb.insert('patients', {
        patient_id: generatePatientId(),
        full_name: name,
        mobile,
        visit_type: opts.visit_type || null,
        created_at: now,
        updated_at: now,
    });
}
