// backend/dashboard/dashboard.ts
import { Router, Request, Response } from 'express';
import DynamicDatabaseService from '../../database_Manager/database.service';
import { QUEUE_SCHEMA, PATIENT_SCHEMA } from '../../database_Manager/database.schemas';

const router = Router();
const queueDb   = DynamicDatabaseService.getDatabase('queue',    QUEUE_SCHEMA);
const patientDb = DynamicDatabaseService.getDatabase('patients', PATIENT_SCHEMA);

// ─── HELPER ──────────────────────────────────────────────────
function getGroupLabel(dateStr: string, group: string): string {
  const d = new Date(dateStr);
  if (group === 'month') return d.toLocaleString('default', { month: 'short', year: '2-digit' });
  if (group === 'week') {
    // ISO week: label as "DD MMM"
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }
  return dateStr; // day
}

// ─── GET /api/dashboard/kpi?from=&to= ────────────────────────
// Returns all KPI numbers for the given date range
router.get('/kpi', (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    if (!from || !to) return res.status(400).json({ success: false, message: 'from and to required' });

    // Queue stats (fee, collected, walkins, done, noshow, missed, waiting)
    const queueStats = queueDb.query(`
      SELECT
        COUNT(*)                                              AS total_queue,
        SUM(fee)                                              AS total_fee,
        SUM(amount_paid)                                      AS total_collected,
        SUM(CASE WHEN ticket_type = 'WALKIN'        THEN 1 ELSE 0 END) AS total_walkins,
        SUM(CASE WHEN status = 'DONE'               THEN 1 ELSE 0 END) AS total_done,
        SUM(CASE WHEN status = 'NOSHOW'             THEN 1 ELSE 0 END) AS total_noshow,
        SUM(CASE WHEN status = 'MISSED'             THEN 1 ELSE 0 END) AS total_missed,
        SUM(CASE WHEN status IN ('WAITING','CALLED','SERVING') THEN 1 ELSE 0 END) AS total_waiting
      FROM queue_entries
      WHERE queue_date BETWEEN ? AND ?
    `, [from, to]) as any[];

    // Appointment count
    const apptStats = queueDb.query(`
      SELECT COUNT(*) AS total_appointments
      FROM appointments
      WHERE appt_date BETWEEN ? AND ?
    `, [from, to]) as any[];

    // SMS count (Fixed using IST offset)
    const smsStats = queueDb.query(`
      SELECT COUNT(*) AS total_sms
      FROM sms_logs
      WHERE date(created_at, '+5 hours', '+30 minutes') BETWEEN ? AND ?
    `, [from, to]) as any[];

    // Total patients (all-time)
    const patientTotal = patientDb.query(`
      SELECT COUNT(*) AS total_patients FROM patients
    `, []) as any[];

    // New patients in range (Fixed using IST offset)
    const newPatients = patientDb.query(`
      SELECT COUNT(*) AS new_patients
      FROM patients
      WHERE date(created_at, '+5 hours', '+30 minutes') BETWEEN ? AND ?
    `, [from, to]) as any[];

    // Total visit records in range (Restored to check actual medical records, with IST fix)
    const visitStats = patientDb.query(`
      SELECT COUNT(*) AS total_visits
      FROM patient_visits
      WHERE date(visit_date, '+5 hours', '+30 minutes') BETWEEN ? AND ?
    `, [from, to]) as any[];

    const q = queueStats[0] || {};
    const data = {
      total_queue:        q.total_queue        || 0,
      total_fee:          q.total_fee          || 0,
      total_collected:    q.total_collected    || 0,
      total_walkins:      q.total_walkins      || 0,
      total_done:         q.total_done         || 0,
      total_noshow:       q.total_noshow       || 0,
      total_missed:       q.total_missed       || 0,
      total_waiting:      q.total_waiting      || 0,
      total_appointments: apptStats[0]?.total_appointments || 0,
      total_sms:          smsStats[0]?.total_sms           || 0,
      total_patients:     patientTotal[0]?.total_patients  || 0,
      new_patients:       newPatients[0]?.new_patients     || 0,
      total_visits:       visitStats[0]?.total_visits      || 0, // Restored to distinct medical visits
    };

    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── GET /api/dashboard/trend?from=&to=&group= ───────────────
// Returns revenue + visit counts grouped by day/week/month
router.get('/trend', (req: Request, res: Response) => {
  try {
    const { from, to, group = 'day' } = req.query as Record<string, string>;
    if (!from || !to) return res.status(400).json({ success: false, message: 'from and to required' });

    let groupExpr: string;
    if (group === 'month') groupExpr = `strftime('%Y-%m', queue_date)`;
    else if (group === 'week') groupExpr = `strftime('%Y-W%W', queue_date)`;
    else groupExpr = `queue_date`;

    const rows = queueDb.query(`
      SELECT
        ${groupExpr}          AS period,
        SUM(amount_paid)      AS revenue,
        COUNT(*)              AS visits
      FROM queue_entries
      WHERE queue_date BETWEEN ? AND ?
      GROUP BY period
      ORDER BY period ASC
    `, [from, to]) as any[];

    // Build human-friendly labels
    const data = rows.map(r => ({
      label:   group === 'day'   ? r.period.slice(5)  // "MM-DD"
             : group === 'month' ? r.period            // "YYYY-MM"
             : r.period,                               // "YYYY-Www"
      revenue: r.revenue || 0,
      visits:  r.visits  || 0,
    }));

    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── GET /api/dashboard/breakdown?from=&to= ──────────────────
// Returns visit type, queue status and priority distributions
router.get('/breakdown', (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    if (!from || !to) return res.status(400).json({ success: false, message: 'from and to required' });

    const visitTypes = queueDb.query(`
      SELECT COALESCE(visit_type, 'Unknown') AS label, COUNT(*) AS count
      FROM queue_entries
      WHERE queue_date BETWEEN ? AND ? AND visit_type IS NOT NULL AND visit_type != ''
      GROUP BY label ORDER BY count DESC LIMIT 10
    `, [from, to]) as any[];

    const statuses = queueDb.query(`
      SELECT status AS label, COUNT(*) AS count
      FROM queue_entries
      WHERE queue_date BETWEEN ? AND ?
      GROUP BY status ORDER BY count DESC
    `, [from, to]) as any[];

    const priorities = queueDb.query(`
      SELECT priority AS label, COUNT(*) AS count
      FROM queue_entries
      WHERE queue_date BETWEEN ? AND ?
      GROUP BY priority ORDER BY count DESC
    `, [from, to]) as any[];

    res.json({
      success: true,
      data: { visit_types: visitTypes, statuses, priorities }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── GET /api/dashboard/all-patients ───────────────────
// Replaces the old activity route to serve a paginated patient directory
router.get('/all-patients', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 10; // Exactly 10 records per page as requested
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';

    let whereClause = '';
    let params: any[] = [];

    if (search) {
      whereClause = `WHERE full_name LIKE ? OR mobile LIKE ? OR patient_id LIKE ?`;
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }

    // Get total count for pagination math
    const countQuery = `SELECT COUNT(*) as total FROM patients ${whereClause}`;
    const totalResult = patientDb.query(countQuery, params) as any[];
    const total = totalResult[0]?.total || 0;

    // Get paginated rows
    const rowsQuery = `
      SELECT id, patient_id, full_name, mobile, age, gender, city, created_at
      FROM patients
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = patientDb.query(rowsQuery, [...params, limit, offset]) as any[];

    res.json({ success: true, data: rows, total, page });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});
// ─── GET /api/dashboard/day?date= ────────────────────────────
// Single-day deep snapshot including all queue entries for that day
router.get('/day', (req: Request, res: Response) => {
  try {
    const { date } = req.query as Record<string, string>;
    if (!date) return res.status(400).json({ success: false, message: 'date required' });

    // 1. Queue stats: Calculate Revenue, Collected, Pending, etc.
    const stats = queueDb.query(`
      SELECT
        SUM(fee)                                              AS revenue,
        SUM(amount_paid)                                      AS collected,
        SUM(fee - amount_paid)                                AS pending,
        COUNT(DISTINCT patient_id)                            AS patients,
        SUM(CASE WHEN ticket_type = 'APPOINTMENT' THEN 1 ELSE 0 END) AS appointments,
        SUM(CASE WHEN ticket_type = 'WALKIN'      THEN 1 ELSE 0 END) AS walkins,
        SUM(CASE WHEN status = 'DONE'             THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN status IN ('NOSHOW','MISSED') THEN 1 ELSE 0 END) AS noshow
      FROM queue_entries
      WHERE queue_date = ?
    `, [date]) as any[];

    // 2. New Registrations: Count patients registered on this specific date (with IST fix)
    const newReg = patientDb.query(`
      SELECT COUNT(*) as count 
      FROM patients 
      WHERE date(created_at, '+5 hours', '+30 minutes') = ?
    `, [date]) as any[];

    // 3. Get all entries
    const entries = queueDb.query(`
      SELECT
        id, token_number, patient_id, patient_name, mobile,
        ticket_type, visit_type, doctor, priority, status,
        fee, amount_paid, chief_complaint, slot_time,
        called_at, served_at, notes
      FROM queue_entries
      WHERE queue_date = ?
      ORDER BY
        CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'VIP' THEN 1 ELSE 2 END ASC,
        token_number ASC
    `, [date]) as any[];

    const s = stats[0] || {};
    res.json({
      success: true,
      data: {
        revenue:      s.revenue      || 0,
        collected:    s.collected    || 0,
        pending:      s.pending      || 0, // Now includes calculated pending
        patients:     s.patients     || 0,
        appointments: s.appointments || 0,
        walkins:      s.walkins      || 0,
        done:         s.done         || 0,
        noshow:       s.noshow       || 0,
        new_reg:      newReg[0]?.count || 0, // Added new registration count
        entries,
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── GET /api/dashboard/patient-queue?patient_id= ────────────
// Full queue history for a specific patient (for drawer)
router.get('/patient-queue', (req: Request, res: Response) => {
  try {
    const { patient_id } = req.query as Record<string, string>;
    if (!patient_id) return res.status(400).json({ success: false, message: 'patient_id required' });

    const rows = queueDb.query(`
      SELECT
        id, token_number, queue_date, ticket_type, visit_type,
        doctor, priority, status, fee, amount_paid,
        chief_complaint, slot_time, served_at, notes
      FROM queue_entries
      WHERE patient_id = ?
      ORDER BY queue_date DESC, token_number DESC
    `, [patient_id]) as any[];

    res.json({ success: true, data: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;