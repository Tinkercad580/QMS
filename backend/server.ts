// backend/server.ts — add these lines to your existing server file

import express from 'express';
import cors from 'cors';
import path from 'path';
import patientRouter, { visitsRouter } from './add/patients';
import queueRouter from './QueueMang/queue';
import appointmentRouter from './QueueMang/appointments';
import opdRouter from './OPD/opd';
import dashboardRouter from './dashboard/dashboard';


const app = express();

// app.use((req, res, next) => {
//   console.log(`[REQUEST] ${req.method} ${req.url}`);
//   next();
// });

app.use(cors());
app.use(express.json());
// app.use(express.static(path.join(__dirname, '../')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Patient & Visit Routes ────────────────────────────────────
app.use('/api/patients', patientRouter);
app.use('/api/visits', visitsRouter);
app.use('/api/queue', queueRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/opd', opdRouter);
app.use('/api/dashboard', dashboardRouter);


// ─── Serve add-pandc.html ──────────────────────────────────────
app.get('/patients', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/add-pandc.html'));
});

app.get('/queue', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/QueueMang.html'));
});

app.get('/opd', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/OPD.html'));
});

// Serve index.html (dashboard)
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.get('/api/dashboard/ping', (_req, res) => res.json({ ok: true }));


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
export default app;