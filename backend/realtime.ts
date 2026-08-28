// backend/realtime.ts
// ═══════════════════════════════════════════════════════════════════════════
// Live updates over Server-Sent Events.
//
// The queue page used to poll three endpoints every 30 seconds regardless of
// whether anything had changed — wasted round-trips when idle, and up to a
// 30-second lag when it mattered (reception adds a walk-in; the doctor's
// screen doesn't know for half a minute).
//
// SSE rather than WebSockets on purpose: every message here travels
// server → client, and the browser already talks back over ordinary REST.
// EventSource also reconnects on its own with backoff, which is the part of a
// hand-rolled WebSocket setup that usually goes wrong.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';

const router = Router();

type Client = { id: number; res: Response };
let clients: Client[] = [];
let nextClientId = 1;

// Proxies and browsers will drop an idle connection; a periodic comment frame
// keeps it alive without waking any application code on the client.
const HEARTBEAT_MS = 25_000;

router.get('/events', (req: Request, res: Response) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Disables buffering in nginx, which would otherwise hold events back.
        'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');           // client reconnect delay
    res.write(': connected\n\n');
    if (typeof (res as any).flushHeaders === 'function') (res as any).flushHeaders();

    const client: Client = { id: nextClientId++, res };
    clients.push(client);

    const heartbeat = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { /* cleaned up by 'close' */ }
    }, HEARTBEAT_MS);

    req.on('close', () => {
        clearInterval(heartbeat);
        clients = clients.filter(c => c.id !== client.id);
    });
});

/**
 * Notifies every connected client that some data changed.
 * Deliberately carries only *what* changed, not the data itself — clients
 * refetch through the normal endpoints, so there is one code path for loading
 * data whether it came from a page load or a live update.
 */
export function broadcast(topic: string, detail: Record<string, any> = {}): void {
    if (!clients.length) return;
    const payload = JSON.stringify({ topic, ...detail, at: new Date().toISOString() });
    const frame = `event: change\ndata: ${payload}\n\n`;
    // Iterate a copy: a failed write removes the client from the live list.
    [...clients].forEach(c => {
        try {
            c.res.write(frame);
        } catch {
            clients = clients.filter(x => x.id !== c.id);
        }
    });
}

export function connectedClientCount(): number {
    return clients.length;
}

export default router;
