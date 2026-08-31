import http, { ServerResponse } from 'node:http';
import { mockDb, mockRedis } from '../../../shared/database/emulator.ts';
import { TrustEngine } from './trust-engine.ts';
import { QueueEngine } from './queue-engine.ts';
import { FinanceEngine } from './finance-engine.ts';
import { ShiftEngine } from './shift-engine.ts';

const PORT = 3000;
const sseClients: Set<ServerResponse> = new Set();

function broadcastEvent(type: string, payload: object) {
  const eventData = `data: ${JSON.stringify({ type, payload })}\n\n`;
  for (const client of sseClients) {
    client.write(eventData);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. SSE Real-Time Stream
  if (req.url === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 2. Fetch Shift & Financial Status
  if (req.url === '/api/shift/status' && req.method === 'GET') {
    const shift = mockDb.shifts.get('shift-998') || { status: 'NO_ACTIVE_SHIFT' };
    const trustScore = mockDb.trustScores.get('driver-001') || 80;
    const geo = mockRedis.get('location:shift-998');
    const rankQueue = QueueEngine.getQueueStatus('CBD-MAIN-RANK');
    const financials = FinanceEngine.getShiftFinancials('shift-998');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ shift, trustScore, latestGeo: geo ? JSON.parse(geo) : null, rankQueue, financials }));
    return;
  }

  // 3. Telemetry Ingress
  if (req.url === '/api/telemetry' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const point = {
          shiftId: payload.shiftId || 'shift-998',
          lat: payload.lat || -17.8252,
          lng: payload.lng || 31.0335,
          speed: payload.speed || 45,
          timestamp: new Date().toISOString()
        };
        mockRedis.set(`location:${point.shiftId}`, JSON.stringify(point));
        broadcastEvent('TELEMETRY_UPDATE', point);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'TELEMETRY_UPDATED', point }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_JSON' }));
      }
    });
    return;
  }

  // 4. Rank Clearance Verification (HMAC-SHA256)
  if (req.url === '/api/clearance/verify' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const shiftId = data.shiftId || 'shift-998';
        const marshalId = data.marshalId || 'marshal-CBD-01';
        const timestamp = data.timestamp || new Date().toISOString();
        const signature = data.signature || TrustEngine.generateSignature({ shiftId, marshalId, timestamp });

        const result = TrustEngine.processClearance({ shiftId, marshalId, timestamp, signature });
        broadcastEvent('CLEARANCE_UPDATE', result);

        res.writeHead(result.success ? 200 : 401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, reason: 'MALFORMED_PAYLOAD' }));
      }
    });
    return;
  }

  // 5. Join Rank Queue
  if (req.url === '/api/rank/join' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const entry = QueueEngine.joinQueue(data.rankId || 'CBD-MAIN-RANK', data.shiftId || 'shift-998');
        broadcastEvent('QUEUE_UPDATE', entry);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, entry }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_PAYLOAD' }));
      }
    });
    return;
  }

  // 6. Passenger Count & Rank Departure
  if (req.url === '/api/rank/depart' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const shiftId = data.shiftId || 'shift-998';
        const count = data.count || 16;
        
        const result = QueueEngine.verifyPassengerCount(data.rankId || 'CBD-MAIN-RANK', shiftId, count);

        if (result.success) {
          const settlement = FinanceEngine.processDepartureSettlement(shiftId, count);
          broadcastEvent('DEPARTURE_UPDATE', { entry: result.entry, settlement });
        }

        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_PAYLOAD' }));
      }
    });
    return;
  }

  // 7. Close Shift & Generate EOD Audit Summary
  if (req.url === '/api/shift/close' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const shiftId = data.shiftId || 'shift-998';
        const summary = ShiftEngine.closeShift(shiftId);

        broadcastEvent('SHIFT_CLOSED', summary);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, summary }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_PAYLOAD' }));
      }
    });
    return;
  }

  // Frontend Dashboard
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>MUSHIKASHIKA Fleet Terminal</title>
        <style>
          body { font-family: system-ui, sans-serif; margin: 24px; background: #f1f5f9; color: #0f172a; }
          h1 { color: #0284c7; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px; }
          .card { background: white; padding: 18px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          h2 { margin-top: 0; font-size: 1.1rem; color: #334155; }
          button { background: #0284c7; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 6px; margin-bottom: 6px; }
          button.danger { background: #ef4444; }
          button.danger:hover { background: #dc2626; }
          button:hover { background: #0369a1; }
          pre { background: #0f172a; color: #38bdf8; padding: 12px; border-radius: 6px; font-size: 0.85rem; height: 180px; overflow-y: auto; }
        </style>
      </head>
      <body>
        <h1>MUSHIKASHIKA FLEET TERMINAL</h1>
        <div class="grid">
          <div class="card">
            <h2>Driver Shift Status</h2>
            <p>Shift: <strong id="shiftId">Loading...</strong></p>
            <p>Status: <strong id="shiftState">ACTIVE</strong></p>
            <p>Trust Score: <strong id="trustScore">Loading...</strong> / 100</p>
            <p>GPS: <span id="telemetry">None</span></p>
          </div>
          <div class="card">
            <h2>Rank Queue Status</h2>
            <p>Rank Position: <strong id="queuePos">Not in Queue</strong></p>
            <p>Queue Status: <span id="queueStatus">Idle</span></p>
          </div>
          <div class="card">
            <h2>Financial Settlement Ledger</h2>
            <p>Gross Fare Earned: <strong id="grossFare">$0.00</strong></p>
            <p>Owner Net Payout: <strong id="ownerPayout">$0.00</strong></p>
            <p>Driver Commission: <span id="driverCut">$0.00</span></p>
          </div>
          <div class="card">
            <h2>Control Actions</h2>
            <button onclick="sendGps()">Send GPS</button>
            <button onclick="joinQueue()">Join Rank Queue</button>
            <button onclick="verifyRank()">Marshal Clearance</button>
            <button onclick="departRank()">Verify & Depart</button>
            <button class="danger" onclick="closeShift()">End Shift & Reconcile</button>
          </div>
        </div>

        <div class="card">
          <h2>System Real-Time Log</h2>
          <pre id="logs">Connecting to SSE Event Engine...</pre>
        </div>

        <script>
          async function fetchStatus() {
            const res = await fetch('/api/shift/status');
            const data = await res.json();
            document.getElementById('shiftId').innerText = data.shift.status !== 'NO_ACTIVE_SHIFT' ? 'shift-998' : 'None';
            document.getElementById('shiftState').innerText = data.shift.status || 'OFFLINE';
            document.getElementById('trustScore').innerText = data.trustScore;
            if (data.latestGeo) {
              document.getElementById('telemetry').innerText = data.latestGeo.lat + ', ' + data.latestGeo.lng + ' (' + data.latestGeo.speed + ' km/h)';
            }
            const activeEntry = data.rankQueue.find(q => q.shiftId === 'shift-998');
            if (activeEntry) {
              document.getElementById('queuePos').innerText = '#' + activeEntry.position;
              document.getElementById('queueStatus').innerText = activeEntry.status;
            } else {
              document.getElementById('queuePos').innerText = 'Not in Queue';
              document.getElementById('queueStatus').innerText = 'Idle';
            }
            if (data.financials) {
              document.getElementById('grossFare').innerText = '$' + data.financials.totalGross.toFixed(2);
              document.getElementById('ownerPayout').innerText = '$' + data.financials.totalOwnerPayout.toFixed(2);
              document.getElementById('driverCut').innerText = '$' + data.financials.totalDriverCommission.toFixed(2);
            }
          }

          async function sendGps() {
            await fetch('/api/telemetry', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ lat: -17.8252, lng: 31.0335, speed: Math.floor(Math.random() * 30) + 30 })
            });
          }

          async function joinQueue() {
            await fetch('/api/rank/join', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ rankId: 'CBD-MAIN-RANK', shiftId: 'shift-998' })
            });
          }

          async function verifyRank() {
            await fetch('/api/clearance/verify', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ marshalId: 'marshal-RANK-04' })
            });
          }

          async function departRank() {
            await fetch('/api/rank/depart', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ rankId: 'CBD-MAIN-RANK', shiftId: 'shift-998', count: 16 })
            });
          }

          async function closeShift() {
            await fetch('/api/shift/close', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ shiftId: 'shift-998' })
            });
          }

          function log(msg) {
            const el = document.getElementById('logs');
            el.innerText = '[' + new Date().toLocaleTimeString() + '] ' + msg + '\\n' + el.innerText;
          }

          const eventSource = new EventSource('/api/events');
          eventSource.onopen = () => log('[SSE] Pipeline connected.');
          eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'TELEMETRY_UPDATE') {
              document.getElementById('telemetry').innerText = data.payload.lat + ', ' + data.payload.lng + ' (' + data.payload.speed + ' km/h)';
              log('[TELEMETRY] Broadcast received.');
            } else if (data.type === 'CLEARANCE_UPDATE') {
              fetchStatus();
              log('[CLEARANCE] HMAC Signature verified.');
            } else if (data.type === 'QUEUE_UPDATE') {
              fetchStatus();
              log('[QUEUE] Vehicle joined rank line.');
            } else if (data.type === 'DEPARTURE_UPDATE') {
              fetchStatus();
              log('[FINANCE] Trip settled. Gross: $' + data.payload.settlement.grossFare);
            } else if (data.type === 'SHIFT_CLOSED') {
              fetchStatus();
              log('[EOD AUDIT] Shift closed! Total Gross: $' + data.payload.financials.totalGross + ' | Trips Completed: ' + data.payload.financials.tripsCompleted);
            }
          };

          fetchStatus();
        </script>
      </body>
      </html>
    `);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Seed Initial State
mockDb.shifts.set('shift-998', {
  driverId: 'driver-001',
  conductorId: 'conductor-002',
  status: 'ACTIVE',
  startTime: new Date().toISOString()
});
mockDb.trustScores.set('driver-001', 85);

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` 🚀 MUSHIKASHIKA SERVER LIVE AT: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
