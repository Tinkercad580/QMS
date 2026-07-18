// backend/add/patients.ts
import { Router, Request, Response } from 'express';
import DynamicDatabaseService from '../../database_Manager/database.service';
import { PATIENT_SCHEMA } from '../../database_Manager/database.schemas';

const router = Router();
const db = DynamicDatabaseService.getDatabase('patients', PATIENT_SCHEMA);

function generatePatientId(): string {
    const now = new Date();
    const yr = now.getFullYear().toString().slice(-2);
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `P${yr}${mo}-${rand}`;
}

// ══════════════════════════════════════════════
// ✅ EXACT ORDER MATTERS — specific before /:id
// ══════════════════════════════════════════════

// 1️⃣ GET all patients
router.get('/', (req: Request, res: Response) => {
    try {
        const patients = db.query(`
            SELECT
                p.*,
                COUNT(v.id) AS visit_count,
                MAX(v.visit_date) AS last_visit
            FROM patients p
            LEFT JOIN patient_visits v ON v.patient_id = p.id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `);
        res.json({ success: true, patients });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 2️⃣ POST create patient
router.post('/', (req: Request, res: Response) => {
    try {
        const body = req.body;
        if (!body.full_name?.trim()) {
            return res.status(400).json({ success: false, message: 'full_name is required' });
        }

        const now = new Date().toISOString();
        const data: Record<string, any> = {
            patient_id: body.patient_id?.trim() || generatePatientId(),
            full_name: body.full_name.trim(),
            mobile: body.mobile?.trim() || null,
            alt_mobile: body.alt_mobile?.trim() || null,
            email: body.email?.trim() || null,
            dob: body.dob || null,
            age: body.age ? parseInt(body.age, 10) : null,
            gender: body.gender || null,
            blood_group: body.blood_group || null,
            height_cm: body.height_cm ? parseFloat(body.height_cm) : null,
            weight_kg: body.weight_kg ? parseFloat(body.weight_kg) : null,
            allergies: body.allergies?.trim() || null,
            chronic_conditions: body.chronic_conditions?.trim() || null,
            current_medications: body.current_medications?.trim() || null,
            address: body.address?.trim() || null,
            city: body.city?.trim() || null,
            pin_code: body.pin_code?.trim() || null,
            emergency_contact_name: body.emergency_contact_name?.trim() || null,
            emergency_contact_mobile: body.emergency_contact_mobile?.trim() || null,
            emergency_contact_relation: body.emergency_contact_relation || null,
            visit_type: body.visit_type || null,
            department: body.department?.trim() || null,
            assigned_doctor: body.assigned_doctor?.trim() || null,
            insurance_policy: body.insurance_policy?.trim() || null,
            chief_complaint: body.chief_complaint?.trim() || null,
            notes: body.notes?.trim() || null,
            created_at: now,
            updated_at: now,
        };

        const insertedId = db.insert('patients', data);
        
        res.status(201).json({ success: true, id: insertedId, message: 'Patient created' });
    } catch (e: any) {
        console.error('POST /patients failed:', e.message);
        res.status(500).json({ success: false, message: e.message });
    }
});

// 3️⃣ GET /search  ← MUST be before /:id
router.get('/search', (req: Request, res: Response) => {
    try {
        const q = `%${(req.query.q as string) || ''}%`;
        const results = db.query(
            `SELECT id, patient_id, full_name, mobile, age, gender, blood_group, created_at
             FROM patients
             WHERE full_name LIKE ? OR mobile LIKE ? OR patient_id LIKE ?
             ORDER BY full_name ASC LIMIT 20`,
            [q, q, q]
        );
        res.json({ success: true, results });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 4️⃣ GET /visits  ← MUST be before /:id
router.get('/visits', (req: Request, res: Response) => {
    try {
        const { patient_id } = req.query;
        if (!patient_id) return res.status(400).json({ success: false, message: 'patient_id required' });
        const visits = db.query(
            `SELECT * FROM patient_visits WHERE patient_id = ? ORDER BY visit_date DESC`,
            [patient_id]
        );
        res.json({ success: true, visits });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 5️⃣ POST /visits  ← MUST be before /:id
router.post('/visits', (req: Request, res: Response) => {
    try {
        const body = req.body;
        if (!body.patient_id) return res.status(400).json({ success: false, message: 'patient_id required' });

        const patient = db.selectOne('patients', 'id = ?', [body.patient_id]);
        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

        const now = new Date().toISOString();
        const data = {
            patient_id: parseInt(body.patient_id, 10),
            visit_date: body.visit_date || now,
            visit_type: body.visit_type || 'OPD',
            doctor: body.doctor?.trim() || null,
            complaint: body.complaint?.trim() || null,
            diagnosis: body.diagnosis?.trim() || null,
            prescription: body.prescription?.trim() || null,
            follow_up_date: body.follow_up_date || null,
            notes: body.notes?.trim() || null,
            created_at: now,
        };

        const id = db.insert('patient_visits', data);
        res.status(201).json({ success: true, id, message: 'Visit logged' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 6️⃣ GET /:id  ← wildcard, AFTER all named routes
router.get('/:id', (req: Request, res: Response) => {
    try {
        const patient = db.selectOne('patients', 'id = ?', [req.params.id as string]);
        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
        const visits = db.select('patient_visits', 'patient_id = ?', [req.params.id]);
        res.json({ success: true, patient: { ...patient, visits } });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 7️⃣ PUT /:id
router.put('/:id', (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const body = req.body;

        const existing = db.selectOne('patients', 'id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Patient not found' });

        if (body.full_name !== undefined && !body.full_name?.trim()) {
            return res.status(400).json({ success: false, message: 'full_name cannot be empty' });
        }

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        const editable = [
            'full_name', 'mobile', 'alt_mobile', 'email', 'dob', 'age', 'gender', 'blood_group',
            'height_cm', 'weight_kg', 'allergies', 'chronic_conditions', 'current_medications',
            'address', 'city', 'pin_code', 'emergency_contact_name', 'emergency_contact_mobile',
            'emergency_contact_relation', 'visit_type', 'department', 'assigned_doctor',
            'insurance_policy', 'chief_complaint', 'notes', 'patient_id',
        ];
        editable.forEach(f => {
            if (body[f] !== undefined) updates[f] = body[f] === '' ? null : body[f];
        });

        const changed = db.update('patients', updates, 'id = ?', [id]);
        res.json({ success: true, changes: changed, message: 'Patient updated' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 8️⃣ DELETE /:id
router.delete('/:id', (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const existing = db.selectOne('patients', 'id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Patient not found' });

        db.transaction(() => {
            db.delete('patient_visits', 'patient_id = ?', [id]);
            db.delete('patients', 'id = ?', [id]);
        });

        res.json({ success: true, message: 'Patient and all visit history deleted' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── Separate /api/visits router ──────────────────────────────
export const visitsRouter = Router();

visitsRouter.get('/', (req: Request, res: Response) => {
    try {
        const { patient_id } = req.query;
        if (!patient_id) return res.status(400).json({ success: false, message: 'patient_id required' });
        const visits = db.query(
            `SELECT * FROM patient_visits WHERE patient_id = ? ORDER BY visit_date DESC`,
            [patient_id]
        );
        res.json({ success: true, visits });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

visitsRouter.post('/', (req: Request, res: Response) => {
    try {
        const body = req.body;
        if (!body.patient_id) return res.status(400).json({ success: false, message: 'patient_id required' });
        const now = new Date().toISOString();
        const data = {
            patient_id: parseInt(body.patient_id, 10),
            visit_date: body.visit_date || now,
            visit_type: body.visit_type || 'OPD',
            doctor: body.doctor?.trim() || null,
            complaint: body.complaint?.trim() || null,
            diagnosis: body.diagnosis?.trim() || null,
            prescription: body.prescription?.trim() || null,
            follow_up_date: body.follow_up_date || null,
            notes: body.notes?.trim() || null,
            created_at: now,
        };
        const id = db.insert('patient_visits', data);
        res.status(201).json({ success: true, id, message: 'Visit logged' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

export default router;