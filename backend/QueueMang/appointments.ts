// backend/QueueMang/appointments.ts
import { Router, Request, Response } from 'express';
import DynamicDatabaseService from '../../database_Manager/database.service';
import { QUEUE_SCHEMA } from '../../database_Manager/database.schemas';
import { sendSms } from '../../Sms/sms.service';

const router = Router();
const db = DynamicDatabaseService.getDatabase('queue', QUEUE_SCHEMA);

// ─── GET appointments by date ─────────────────────────
router.get('/', (req: Request, res: Response) => {
    try {
        const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
        const appointments = db.query(`
            SELECT * FROM appointments
            WHERE appt_date = ?
            ORDER BY slot_time ASC
        `, [date]);
        res.json({ success: true, appointments });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── GET appointments range (for calendar dots) ───────
router.get('/range', (req: Request, res: Response) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ success: false, message: 'from and to required' });
        const appointments = db.query(`
            SELECT appt_date, COUNT(*) as count
            FROM appointments
            WHERE appt_date BETWEEN ? AND ?
            GROUP BY appt_date
        `, [from, to]);
        res.json({ success: true, appointments });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── POST: create appointment ─────────────────────────
// ─── POST: create appointment ─────────────────────────
router.post('/', (req: Request, res: Response) => {
    try {
        const body = req.body;
        if (!body.patient_name?.trim()) {
            return res.status(400).json({ success: false, message: 'patient_name required' });
        }
        if (!body.appt_date) {
            return res.status(400).json({ success: false, message: 'appt_date required' });
        }

        // ─── NEW: PREVENT DUPLICATE BOOKINGS ──────────────
        if (body.patient_id) {
            const existing = db.selectOne('appointments', 'patient_id = ? AND appt_date = ?', [body.patient_id, body.appt_date]);
            if (existing) {
                return res.status(400).json({ success: false, message: 'Patient already booked an appointment for this date.' });
            }
        } else if (body.mobile?.trim()) {
            const existing = db.selectOne('appointments', 'mobile = ? AND appt_date = ?', [body.mobile.trim(), body.appt_date]);
            if (existing) {
                return res.status(400).json({ success: false, message: 'An appointment with this mobile number already exists for this date.' });
            }
        }
        // ──────────────────────────────────────────────────

        const now = new Date().toISOString();
        const data: Record<string, any> = {
            patient_id: body.patient_id ? parseInt(body.patient_id) : null,
            patient_name: body.patient_name.trim(),
            mobile: body.mobile?.trim() || null,
            appt_date: body.appt_date,
            slot_time: body.slot_time || null,
            duration_min: body.duration_min ? parseInt(body.duration_min) : 15,
            doctor: body.doctor?.trim() || null,
            visit_type: body.visit_type || 'Consultation',
            priority: body.priority || 'NORMAL',
            fee: body.fee ? parseFloat(body.fee) : 0,
            notes: body.notes?.trim() || null,
            status: 'WAITING',
            created_at: now,
            updated_at: now,
        };

        const id = db.insert('appointments', data);

        // Send confirmation SMS
        if (body.mobile) {
            const msg = `Dear ${body.patient_name}, your appointment is confirmed for ${body.appt_date} at ${body.slot_time || 'as scheduled'}. - ClinicBase`;

            // Log it to your database
            try {
                db.insert('sms_logs', {
                    queue_entry_id: null,
                    mobile: body.mobile,
                    message: msg,
                    status: 'QUEUED',
                    created_at: now,
                });
            } catch (e) { console.error("Database log failed", e); }
            // 3. ACTUAL CALL TO SEND THE SMS
            // We don't await this inside the POST so the user doesn't wait for the SMS to send
            sendSms(body.mobile, msg)
                .then(success => {
                    if (success) {
                        console.log(`✅ SMS successfully sent to ${body.mobile}`);
                    } else {
                        console.log(`❌ SMS failed to send to ${body.mobile}`);
                    }
                })
                .catch(err => console.error("SMS Service error:", err));
        }

        res.status(201).json({ success: true, id, message: 'Appointment booked' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── PUT: update appointment ──────────────────────────
router.put('/:id', (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const body = req.body;
        const existing = db.selectOne('appointments', 'id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Appointment not found' });

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        ['patient_name', 'mobile', 'appt_date', 'slot_time', 'duration_min', 'doctor',
            'visit_type', 'priority', 'fee', 'notes', 'status'].forEach(f => {
                if (body[f] !== undefined) updates[f] = body[f] === '' ? null : body[f];
            });

        db.update('appointments', updates, 'id = ?', [id]);
        res.json({ success: true, message: 'Appointment updated' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── DELETE: cancel appointment ───────────────────────
router.delete('/:id', (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const existing = db.selectOne('appointments', 'id = ?', [id]);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        db.delete('appointments', 'id = ?', [id]);
        res.json({ success: true, message: 'Appointment cancelled' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

export default router;