// backend/OPD/opd.ts
import { Router, Request, Response } from 'express';
import DynamicDatabaseService from '../../database_Manager/database.service';
import { QUEUE_SCHEMA, OPD_SCHEMA } from '../../database_Manager/database.schemas';

const router = Router();
// Stored in the same 'queue' database file, alongside queue_entries/appointments.
const db = DynamicDatabaseService.getDatabase('queue', QUEUE_SCHEMA);
// Ensure opd_records exists even if 'queue' db was already initialized by queue.ts/appointments.ts first.
db.createTable('opd_records', OPD_SCHEMA);

// ─── GET OPD records (by patient_id, queue_entry_id, or date) ─
router.get('/', (req: Request, res: Response) => {
    try {
        const { patient_id, queue_entry_id, date } = req.query;
        let where = '1=1';
        const params: any[] = [];

        if (patient_id) { where += ' AND patient_id = ?'; params.push(patient_id); }
        if (queue_entry_id) { where += ' AND queue_entry_id = ?'; params.push(queue_entry_id); }
        if (date) { where += ' AND visit_date = ?'; params.push(date); }

        const records = db.select('opd_records', where, params);
        res.json({ success: true, records });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── GET single OPD record ────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
    try {
        const record = db.selectOne('opd_records', 'id = ?', [req.params.id as string]);
        if (!record) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, record });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── POST: create OPD record ──────────────────────────
router.post('/', (req: Request, res: Response) => {
    try {
        const body = req.body;
        if (!body.patient_name?.trim()) {
            return res.status(400).json({ success: false, message: 'patient_name required' });
        }

        const now = new Date().toISOString();
        const data: Record<string, any> = {
            patient_id: body.patient_id ? parseInt(body.patient_id) : null,
            queue_entry_id: body.queue_entry_id ? parseInt(body.queue_entry_id) : null,
            appointment_id: body.appointment_id ? parseInt(body.appointment_id) : null,
            patient_name: body.patient_name.trim(),
            mobile: body.mobile?.trim() || null,
            age: body.age ? parseInt(body.age) : null,
            gender: body.gender || null,
            visit_date: body.visit_date || now.slice(0, 10),
            doctor_name: body.doctor_name?.trim() || null,
            complaints: body.complaints?.trim() || null,
            history: body.history?.trim() || null,
            previous_illness: body.previous_illness?.trim() || null,
            signs_examination: body.signs_examination?.trim() || null,
            vitals: body.vitals ? JSON.stringify(body.vitals) : null,
            diagnosis: body.diagnosis?.trim() || null,
            investigations: body.investigations ? JSON.stringify(body.investigations) : null,
            investigations_advised: body.investigations_advised?.trim() || null,
            previous_investigations: body.previous_investigations?.trim() || null,
            medicines: body.medicines ? JSON.stringify(body.medicines) : null,
            prescription: body.prescription?.trim() || null,
            advice: body.advice?.trim() || null,
            follow_up_date: body.follow_up_date || null,
            notes: body.notes?.trim() || null,
            created_at: now,
            updated_at: now,
        };

        const id = db.insert('opd_records', data);
        res.status(201).json({ success: true, id, message: 'OPD record saved' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── PUT: update OPD record ───────────────────────────
router.put('/:id', (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const body = req.body;
        const existing = db.selectOne('opd_records', 'id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'OPD record not found' });

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        ['patient_name', 'mobile', 'age', 'gender', 'visit_date', 'doctor_name', 'complaints',
            'history', 'previous_illness', 'signs_examination', 'diagnosis', 'investigations_advised',
            'previous_investigations', 'prescription', 'advice', 'follow_up_date', 'notes'].forEach(f => {
                if (body[f] !== undefined) updates[f] = body[f] === '' ? null : body[f];
            });
        if (body.medicines !== undefined) updates.medicines = body.medicines ? JSON.stringify(body.medicines) : null;
        if (body.investigations !== undefined) updates.investigations = body.investigations ? JSON.stringify(body.investigations) : null;
        if (body.vitals !== undefined) updates.vitals = body.vitals ? JSON.stringify(body.vitals) : null;

        db.update('opd_records', updates, 'id = ?', [id]);
        res.json({ success: true, message: 'OPD record updated' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── DELETE: remove OPD record ────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const existing = db.selectOne('opd_records', 'id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        db.delete('opd_records', 'id = ?', [id]);
        res.json({ success: true, message: 'OPD record deleted' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

export default router;
