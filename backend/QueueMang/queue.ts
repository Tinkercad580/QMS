// backend/QueueMang/queue.ts
import { Router, Request, Response } from 'express';
import DynamicDatabaseService from '../../database_Manager/database.service';
import { QUEUE_SCHEMA, PATIENT_SCHEMA } from '../../database_Manager/database.schemas';
import { sendSms } from '../../Sms/sms.service'; // ⬅️ Import the real SMS utility

const router = Router();
const queueDb = DynamicDatabaseService.getDatabase('queue', QUEUE_SCHEMA);
const patientDb = DynamicDatabaseService.getDatabase('patients', PATIENT_SCHEMA);

// ─── HELPER: Next Token ───────────────────────────────
function getNextToken(date: string): number {
    const result = queueDb.query(
        `SELECT MAX(token_number) as max_token FROM queue_entries WHERE queue_date = ?`,
        [date]
    ) as any[];
    return (result[0]?.max_token || 0) + 1;
}

// ─── HELPER: Smart Staggered SMS Logic ────────────────
// This looks at the next 3 people in line and sends a "Get Ready" SMS if they haven't gotten one.
async function triggerStaggeredSms(queueDate: string) {
    try {
        // Updated LIMIT to 3 to notify the next 3 people in the queue
        const waitingPatients = queueDb.query(`
            SELECT * FROM queue_entries
            WHERE queue_date = ? AND status = 'WAITING'
            ORDER BY
                CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'VIP' THEN 1 ELSE 2 END ASC,
                CASE WHEN called_at IS NOT NULL THEN 1 ELSE 0 END ASC,
                CASE WHEN called_at IS NOT NULL THEN updated_at ELSE '0' END ASC,
                token_number ASC
            LIMIT 3
        `, [queueDate]) as any[];

        for (let i = 0; i < waitingPatients.length; i++) {
            const p = waitingPatients[i];
            if (!p.mobile) continue;

            // Check if they already received the 'GET_READY' message today
            const alreadySent = queueDb.query(`
                SELECT id FROM sms_logs 
                WHERE queue_entry_id = ? AND status = 'GET_READY'
            `, [p.id]) as any[];

            if (alreadySent.length === 0) {
                // Dynamically build their position and send
                // i=0 is 1st in line, i=1 is 2nd, i=2 is 3rd
                const posTexts = ["next in line", "2nd in line", "3rd in line"];
                const positionText = posTexts[i] || `${i + 1}th in line`;

                const msg = `Hello ${p.patient_name}, you are currently ${positionText} (Token #${p.token_number}). Please be ready for your turn! - ClinicBase`;

                // 1. Log as sent
                queueDb.insert('sms_logs', {
                    queue_entry_id: p.id,
                    mobile: p.mobile,
                    message: msg,
                    status: 'GET_READY',
                    created_at: new Date().toISOString(),
                });

                // 2. Fire the real SMS
                await sendSms(p.mobile, msg);
            }
        }
    } catch (err) {
        console.error('[Staggered SMS Error]', err);
    }
}

// ─── GET queue for a date ─────────────────────────────
router.get('/', (req: Request, res: Response) => {
    try {
        const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
        const queue = queueDb.query(`
            SELECT * FROM queue_entries
            WHERE queue_date = ?
            ORDER BY
                CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'VIP' THEN 1 ELSE 2 END ASC,
                CASE status
                    WHEN 'SERVING' THEN 0 WHEN 'CALLED'  THEN 1 WHEN 'WAITING' THEN 2
                    WHEN 'MISSED'  THEN 3 WHEN 'DONE'    THEN 4 WHEN 'NOSHOW'  THEN 5 ELSE 6
                END ASC,
                CASE WHEN status = 'WAITING' AND called_at IS NOT NULL THEN 1 ELSE 0 END ASC,
                CASE WHEN status = 'WAITING' AND called_at IS NOT NULL THEN updated_at ELSE '0' END ASC,
                token_number ASC
        `, [date]);
        res.json({ success: true, queue });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── POST: add walk-in ────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body;
        if (!body.patient_name?.trim()) {
            return res.status(400).json({ success: false, message: 'patient_name required' });
        }

        const now = new Date().toISOString();
        const date = body.queue_date || now.slice(0, 10);
        const token = getNextToken(date);

        const data: Record<string, any> = {
            patient_id: body.patient_id ? parseInt(body.patient_id) : null,
            patient_name: body.patient_name.trim(),
            mobile: body.mobile?.trim() || null,
            ticket_type: body.ticket_type || 'WALKIN',
            visit_type: body.visit_type || null,
            doctor: body.doctor?.trim() || null,
            priority: body.priority || 'NORMAL',
            status: 'WAITING',
            token_number: token,
            queue_date: date,
            slot_time: body.slot_time || null,
            fee: body.fee ? parseFloat(body.fee) : 0,
            amount_paid: 0,
            chief_complaint: body.chief_complaint?.trim() || null,
            start_time: body.start_time || null,
            end_time: body.end_time || null,
            created_at: now,
            updated_at: now,
        };

        const id = queueDb.insert('queue_entries', data);

        // Immediate Welcome SMS
        if (body.mobile) {
            const msg = `Dear ${body.patient_name}, you've been added to the Live Queue (Token #${token}). Please wait for your turn. - ClinicBase`;
            queueDb.insert('sms_logs', { queue_entry_id: id, mobile: body.mobile, message: msg, status: 'WELCOME', created_at: now });
            sendSms(body.mobile, msg).catch((e: any) => console.error("SMS error:", e));
        }

        // Trigger staggered look-ahead for the line
        triggerStaggeredSms(date);

        res.status(201).json({ success: true, id, token_number: token, message: 'Added to queue' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── POST: inject appointment into queue ─────────────
router.post('/inject-appointment', async (req: Request, res: Response) => {
    try {
        const { appointment_id } = req.body;
        if (!appointment_id) return res.status(400).json({ success: false, message: 'appointment_id required' });

        const appt = queueDb.selectOne('appointments', 'id = ?', [appointment_id]) as any;
        if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });

        const existing = queueDb.query(`SELECT id FROM queue_entries WHERE appointment_id = ?`, [appointment_id]) as any[];
        if (existing.length) return res.status(400).json({ success: false, message: 'Already in queue' });

        const now = new Date().toISOString();
        const date = appt.appt_date;
        const token = getNextToken(date);

        const id = queueDb.insert('queue_entries', {
            patient_id: appt.patient_id || null,
            patient_name: appt.patient_name,
            mobile: appt.mobile || null,
            ticket_type: 'APPOINTMENT',
            visit_type: appt.visit_type || null,
            doctor: appt.doctor || null,
            priority: appt.priority || 'NORMAL',
            status: 'WAITING',
            token_number: token,
            queue_date: date,
            slot_time: appt.slot_time || null,
            appointment_id: appt.id,
            fee: appt.fee || 0,
            amount_paid: 0,
            chief_complaint: appt.notes || null,
            start_time: null,
            end_time: null,
            created_at: now,
            updated_at: now,
        });

        queueDb.update('appointments', { status: 'QUEUED', updated_at: now }, 'id = ?', [appointment_id]);

        // Immediate Queue Addition SMS
        if (appt.mobile) {
            const msg = `Dear ${appt.patient_name}, you have checked in for your appointment. Your Live Queue Token is #${token}. - ClinicBase`;
            queueDb.insert('sms_logs', { queue_entry_id: id, mobile: appt.mobile, message: msg, status: 'WELCOME', created_at: now });
            sendSms(appt.mobile, msg).catch((e: any) => console.error("SMS error:", e));
        }

        // Trigger staggered look-ahead for the line
        triggerStaggeredSms(date);

        res.status(201).json({ success: true, id, token_number: token });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── POST: queue action ───────────────────────────────
// ─── POST: queue action ───────────────────────────────
router.post('/:id/action', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const { action, status, amount_paid, notes, prescription, follow_up_date } = req.body;
        const now = new Date().toISOString();

        const entry = queueDb.selectOne('queue_entries', 'id = ?', [id]) as any;
        if (!entry) return res.status(404).json({ success: false, message: 'Queue entry not found' });

        let updates: Record<string, any> = { updated_at: now };

        switch (action) {
            case 'start': {
                const firstWaiting = queueDb.query(`
                    SELECT * FROM queue_entries
                    WHERE queue_date = ? AND status = 'WAITING'
                    ORDER BY
                        CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'VIP' THEN 1 ELSE 2 END ASC,
                        CASE WHEN called_at IS NOT NULL THEN 1 ELSE 0 END ASC,
                        CASE WHEN called_at IS NOT NULL THEN updated_at ELSE '0' END ASC,
                        token_number ASC
                    LIMIT 1
                `, [entry.queue_date]) as any[];

                if (!firstWaiting.length) return res.json({ success: false, message: 'No waiting patients' });
                const firstId = firstWaiting[0].id;
                queueDb.update('queue_entries', { status: 'CALLED', called_at: now, updated_at: now }, 'id = ?', [firstId]);
                triggerStaggeredSms(entry.queue_date);
                return res.json({ success: true, message: 'Queue started' });
            }

            case 'call': {
                updates.status = 'CALLED';
                updates.called_at = now;
                break;
            }

            case 'serve': {
                updates.status = 'SERVING';
                break;
            }

            case 'complete': {
                const finalStatus = status || 'DONE';
                updates.status = finalStatus;
                updates.served_at = now;
                updates.amount_paid = amount_paid ? parseFloat(amount_paid) : 0;
                updates.notes = notes || null;
                updates.prescription = prescription || null;
                updates.follow_up_date = follow_up_date || null;

                if (finalStatus === 'DONE' || finalStatus === 'NOSHOW') {
                    if (entry.patient_id && finalStatus === 'DONE') {
                        try {
                            const paymentAmount = amount_paid ? parseFloat(amount_paid) : 0;
                            const paymentTag = paymentAmount > 0 ? `💰 Amount Paid: ₹${paymentAmount}` : null;

                            const visitPayload = {
                                patient_id: entry.patient_id,
                                queue_entry_id: entry.id,
                                visit_date: now,
                                visit_type: entry.visit_type || 'OPD',
                                doctor: entry.doctor || null,
                                complaint: entry.chief_complaint || null,
                                diagnosis: notes || null,
                                prescription: prescription || null,
                                follow_up_date: follow_up_date || null,
                                notes: paymentTag,
                            };

                            const existingVisit = patientDb.selectOne('patient_visits', 'queue_entry_id = ?', [entry.id]) as any;

                            if (existingVisit) {
                                patientDb.update('patient_visits', visitPayload, 'id = ?', [existingVisit.id]);
                            } else {
                                patientDb.insert('patient_visits', { ...visitPayload, created_at: now });
                            }
                        } catch (ve) {
                            console.error('[Visit Log Error]', ve);
                        }
                    }
                    if (entry.appointment_id) {
                        const apptStatus = finalStatus === 'DONE' ? 'DONE' : 'NOSHOW';
                        queueDb.update('appointments', { status: apptStatus, updated_at: now }, 'id = ?', [entry.appointment_id]);
                    }
                }
                if (finalStatus === 'MISSED') updates.status = 'MISSED';
                break;
            }

            case 'noshow': {
                updates.status = 'NOSHOW';
                updates.served_at = now;
                if (entry.appointment_id) {
                    queueDb.update('appointments', { status: 'NOSHOW', updated_at: now }, 'id = ?', [entry.appointment_id]);
                }
                break;
            }

            case 'miss': {
                updates.status = 'MISSED';
                break;
            }

            case 'requeue': {
                updates.status = 'WAITING';
                updates.called_at = entry.called_at || now;
                updates.served_at = null;
                break;
            }

            case 'remove': {
                if (entry.appointment_id) {
                    queueDb.update('appointments', { status: 'WAITING', updated_at: now }, 'id = ?', [entry.appointment_id]);
                }
                queueDb.delete('queue_entries', 'id = ?', [id]);
                triggerStaggeredSms(entry.queue_date);
                return res.json({ success: true, message: 'Removed' });
            }

            default: return res.status(400).json({ success: false, message: 'Unknown action' });
        }

        queueDb.update('queue_entries', updates, 'id = ?', [id]);
        triggerStaggeredSms(entry.queue_date);
        res.json({ success: true, message: 'Updated' });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── GET single ───────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
    try {
        const entry = queueDb.selectOne('queue_entries', 'id = ?', [req.params.id as string]);
        if (!entry) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, entry });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
});

export default router;