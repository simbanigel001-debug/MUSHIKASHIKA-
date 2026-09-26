// apps/crew-app/src/server.ts
import http, { ServerResponse } from 'node:http';
import { mockDb, mockRedis } from '../../../shared/database/emulator.ts';
import { TrustEngine } from './trust-engine.ts';
import { QueueEngine } from './queue-engine.ts';
import { FinanceEngine } from './finance-engine.ts';
import { ShiftEngine } from './shift-engine.ts';
import { AuthEngine } from './auth-engine.ts';
import { MARSHAL_VIEW, OWNER_VIEW } from './router-views.ts';
import { TelemetryEmulator } from './telemetry-emulator.ts';
import { ExportEngine } from './export-engine.ts';
import { OfflineEngine, type OfflineQueueItem } from './offline-engine.ts';
import { AlertEngine } from './alert-engine.ts';
import { PassengerEngine } from './passenger-engine.ts';
import { PASSENGER_VIEW } from './passenger-view.ts';
import { AnomalyEngine } from './anomaly-engine.ts';
import { LiftEngine } from './lift-engine.ts';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 0. Service Worker Route
  if (req.url === '/sw.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(`
      self.addEventListener('install', (e) => self.skipWaiting());
      self.addEventListener('activate', (e) => self.clients.claim());
    `);
    return;
  }

  // 1. Dedicated Role Views & Passenger Web App
  if (req.url === '/passenger') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PASSENGER_VIEW);
    return;
  }

  if (req.url === '/marshal') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(MARSHAL_VIEW);
    return;
  }

  if (req.url === '/owner') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(OWNER_VIEW);
    return;
  }

  // 2. CSV Export Endpoint
  if (req.url === '/api/owner/export-csv' && req.method === 'GET') {
    const csvData = ExportEngine.generateOwnerCsv('shift-998');
    res.writeHead(200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="owner-shift-report.csv"'
    });
    res.end(csvData);
    return;
  }

  // 2.2 Lift Request Endpoints (InDrive Model)
  if (req.url === '/api/lift/request' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const lift = LiftEngine.createRequest({
          passengerPhone: data.phone || '+263770000000',
          pickupLat: data.lat || -20.1550,
          pickupLng: data.lng || 28.5900,
          pickupLandmark: data.landmark || 'Ascot Shopping Centre',
          destination: data.destination || 'CBD Main Rank',
          passengerCount: data.seats || 1,
          offeredFare: data.fare || 0.50
        });

        broadcastEvent('LIFT_REQUESTED', { lift, pendingCount: LiftEngine.getPendingRequests().length });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, lift }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (req.url === '/api/lift/accept' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const lift = LiftEngine.acceptRequest(data.requestId, data.shiftId || 'shift-998');

        broadcastEvent('LIFT_ACCEPTED', { lift });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, lift }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (req.url === '/api/lift/pending' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pendingLifts: LiftEngine.getPendingRequests() }));
    return;
  }

  // 2.3 Passenger Self-Boarding API Endpoint
  if (req.url === '/api/passenger/board' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const pass = PassengerEngine.issuePass(
          data.shiftId || 'shift-998',
          data.rankId || 'CBD-MAIN-RANK',
          data.method || 'ECOCASH'
        );

        broadcastEvent('PASSENGER_BOARDED', {
          pass,
          count: PassengerEngine.getBoardedCount(data.shiftId || 'shift-998')
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, pass }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 3. Auth Helper Endpoint
  if (req.url === '/api/auth/demo-tokens' && req.method === 'GET') {
    const driverToken = AuthEngine.generateToken({ userId: 'driver-001', role: 'DRIVER', shiftId: 'shift-998' });
    const marshalToken = AuthEngine.generateToken({ userId: 'marshal-CBD-01', role: 'MARSHAL' });
    const ownerToken = AuthEngine.generateToken({ userId: 'owner-101', role: 'OWNER' });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ driverToken, marshalToken, ownerToken }));
    return;
  }

  // 4. SSE Stream Endpoint
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

  // 5. Shift Status Endpoint
  if (req.url === '/api/shift/status' && req.method === 'GET') {
    const shift = mockDb.shifts.get('shift-998') || { status: 'NO_ACTIVE_SHIFT' };
    const trustScore = mockDb.trustScores.get('driver-001') || 85;
    const geo = mockRedis.get('location:shift-998');
    const rankQueue = QueueEngine.getQueueStatus('CBD-MAIN-RANK');
    const financials = FinanceEngine.getShiftFinancials('shift-998');
    const passengerCount = PassengerEngine.getBoardedCount('shift-998');
    const anomalies = AnomalyEngine.getActiveAnomalies('shift-998');
    const pendingLifts = LiftEngine.getPendingRequests();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      shift,
      trustScore,
      latestGeo: geo ? JSON.parse(geo) : null,
      rankQueue,
      financials,
      passengerCount,
      anomalies,
      pendingLifts
    }));
    return;
  }

  // 6. Telemetry Ingress Endpoint
  if (req.url === '/api/telemetry' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const shiftId = payload.shiftId || 'shift-998';
        const lat = payload.lat || -20.1585;
        const lng = payload.lng || 28.6028;
        const speed = payload.speed || 45;

        const point = {
          shiftId,
          lat,
          lng,
          speed,
          timestamp: new Date().toISOString()
        };
        mockRedis.set(`location:${point.shiftId}`, JSON.stringify(point));
        broadcastEvent('TELEMETRY_UPDATE', point);

        // Run Anomaly Inspection
        const shift = mockDb.shifts.get(shiftId);
        const hasClearance = shift ? shift.status === 'DEPARTED' : false;
        const anomaly = AnomalyEngine.inspectTelemetry(shiftId, lat, lng, speed, hasClearance);

        if (anomaly) {
          const currentTrust = mockDb.trustScores.get('driver-001') || 85;
          const newTrust = Math.max(0, currentTrust - anomaly.deductedTrust);
          mockDb.trustScores.set('driver-001', newTrust);

          broadcastEvent('ANOMALY_DETECTED', { anomaly, newTrust });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'TELEMETRY_UPDATED', point, anomalyDetected: !!anomaly }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_JSON' }));
      }
    });
    return;
  }

  // 7. Marshal Clearance Endpoint (HMAC Signature Verification)
  if (req.url === '/api/clearance/verify' && req.method === 'POST') {
    const token = AuthEngine.extractTokenFromHeader(req.headers.authorization);
    const auth = token ? AuthEngine.verifyToken(token) : null;

    if (!auth || (auth.role !== 'MARSHAL' && auth.role !== 'DRIVER')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED_MARSHAL_ACCESS' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const shiftId = data.shiftId || 'shift-998';
        const marshalId = auth.userId;
        const timestamp = new Date().toISOString();
        const signature = TrustEngine.generateSignature({ shiftId, marshalId, timestamp });

        const result = TrustEngine.processClearance({ shiftId, marshalId, timestamp, signature });
        
        const shift = mockDb.shifts.get(shiftId);
        if (shift) shift.status = 'DEPARTED';

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

  // 8. Join Rank Queue Endpoint
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

  // 9. Depart Rank & Financial Settlement Endpoint (with WhatsApp/SMS Alerts)
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

          AlertEngine.sendDepartureAlert('+263771234567', shiftId, settlement.grossFare, settlement.ownerNetPayout);
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

  // 10. Close Shift Endpoint
  if (req.url === '/api/shift/close' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const shiftId = data.shiftId || 'shift-998';
        const summary = ShiftEngine.closeShift(shiftId);

        broadcastEvent('SHIFT_CLOSED', summary);

        AlertEngine.sendShiftClosedAlert('+263771234567', shiftId, summary.financials.totalGross, summary.financials.totalOwnerPayout);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, summary }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_PAYLOAD' }));
      }
    });
    return;
  }

  // 11. Fleet Dashboard View (Bulawayo Map Terminal)
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>MUSHIKASHIKA Fleet Terminal</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; background: #f1f5f9; color: #0f172a; }
          h1 { color: #0284c7; margin-bottom: 20px; font-weight: 700; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px; }
          .card { background: white; padding: 18px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          h2 { margin-top: 0; font-size: 1.1rem; color: #334155; }
          button { background: #0284c7; color: white; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-right: 6px; margin-bottom: 6px; }
          button.danger { background: #ef4444; }
          button.warning { background: #d97706; }
          button.success { background: #16a34a; }
          button:hover { opacity: 0.9; }
          #map { height: 320px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          pre { background: #0f172a; color: #38bdf8; padding: 12px; border-radius: 6px; font-size: 0.85rem; height: 160px; overflow-y: auto; }
          .lift-badge { background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>MUSHIKASHIKA FLEET TERMINAL (BULAWAYO LIVE MAP)</h1>
        <div id="map"></div>

        <div class="grid">
          <div class="card">
            <h2>Driver Shift Status</h2>
            <p>Shift: <strong id="shiftId">Loading...</strong></p>
            <p>Status: <strong id="shiftState">ACTIVE</strong></p>
            <p>Trust Score: <strong id="trustScore" style="color:#16a34a;">85</strong> / 100</p>
            <p>GPS: <span id="telemetry">None</span></p>
          </div>
          <div class="card">
            <h2>Rank & Lift Demand</h2>
            <p>Rank Position: <strong id="queuePos">Not in Queue</strong></p>
            <p>Street Pickup Requests: <span class="lift-badge" id="liftCount">0 Pending</span></p>
            <p>Digital Boarded: <strong id="passengerCount" style="color:#0284c7;">0 Passengers</strong></p>
          </div>
          <div class="card">
            <h2>Financial Settlement Ledger</h2>
            <p>Gross Fare Earned: <strong id="grossFare">$0.00</strong></p>
            <p>Owner Net Payout: <strong id="ownerPayout">$0.00</strong></p>
            <p>Driver Commission: <span id="driverCut">$0.00</span></p>
          </div>
          <div class="card">
            <h2>Control Actions</h2>
            <button class="success" onclick="requestTestLift()">Simulate Street Pickup Request</button>
            <button onclick="sendGps()">Send Normal GPS</button>
            <button class="warning" onclick="simulateHighSpeed()">Simulate Spoofing (140 km/h)</button>
            <button onclick="joinQueue()">Join Rank Queue</button>
            <button onclick="verifyRank()">Marshal Clearance (Auth)</button>
            <button onclick="departRank()">Verify & Depart</button>
            <button class="danger" onclick="closeShift()">End Shift & Reconcile</button>
          </div>
        </div>

        <div class="card">
          <h2>System Real-Time Log</h2>
          <pre id="logs">Connecting to SSE Event Engine...</pre>
        </div>

        <script>
          let authToken = '';
          let map, vehicleMarker;
          let liftMarkers = [];

          function initMap() {
            map = L.map('map').setView([-20.1500, 28.5830], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '© OpenStreetMap'
            }).addTo(map);

            vehicleMarker = L.marker([-20.1585, 28.6028]).addTo(map)
              .bindPopup('<b>Mushikashika #998</b><br>Ascot Corridor')
              .openPopup();
          }

          async function initAuth() {
            const res = await fetch('/api/auth/demo-tokens');
            const data = await res.json();
            authToken = data.marshalToken;
            log('[AUTH] Demo JWT session acquired.');
          }

          async function fetchStatus() {
            const res = await fetch('/api/shift/status');
            const data = await res.json();
            document.getElementById('shiftId').innerText = data.shift.status !== 'NO_ACTIVE_SHIFT' ? 'shift-998' : 'None';
            document.getElementById('shiftState').innerText = data.shift.status || 'OFFLINE';
            document.getElementById('trustScore').innerText = data.trustScore;

            if (data.pendingLifts) {
              document.getElementById('liftCount').innerText = data.pendingLifts.length + ' Pending';
            }
            
            if (data.passengerCount !== undefined) {
              document.getElementById('passengerCount').innerText = data.passengerCount + ' Passengers';
            }
            if (data.latestGeo) {
              updateTelemetryUI(data.latestGeo);
            }
            const activeEntry = data.rankQueue.find(q => q.shiftId === 'shift-998');
            if (activeEntry) {
              document.getElementById('queuePos').innerText = '#' + activeEntry.position;
            } else {
              document.getElementById('queuePos').innerText = 'Not in Queue';
            }
            if (data.financials) {
              document.getElementById('grossFare').innerText = '$' + data.financials.totalGross.toFixed(2);
              document.getElementById('ownerPayout').innerText = '$' + data.financials.totalOwnerPayout.toFixed(2);
              document.getElementById('driverCut').innerText = '$' + data.financials.totalDriverCommission.toFixed(2);
            }
          }

          function updateTelemetryUI(point) {
            const text = point.lat + ', ' + point.lng + ' (' + point.speed + ' km/h)';
            document.getElementById('telemetry').innerText = text;
            if (vehicleMarker && map) {
              const newLatLng = new L.LatLng(point.lat, point.lng);
              vehicleMarker.setLatLng(newLatLng);
            }
          }

          async function requestTestLift() {
            await fetch('/api/lift/request', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                phone: '+263779876543',
                landmark: 'Ascot Shopping Centre Gate',
                seats: 2,
                fare: 1.00,
                lat: -20.1530,
                lng: 28.5950
              })
            });
          }

          async function sendGps() {
            await fetch('/api/telemetry', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ lat: -20.1585, lng: 28.6028, speed: 45 })
            });
          }

          async function simulateHighSpeed() {
            await fetch('/api/telemetry', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ lat: -20.1200, lng: 28.6500, speed: 140 })
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
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
              },
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
              updateTelemetryUI(data.payload);
            } else if (data.type === 'LIFT_REQUESTED') {
              fetchStatus();
              const lift = data.payload.lift;
              log('🙋‍♂️ [STREET LIFT REQUEST] Pickup at ' + lift.pickupLandmark + ' (' + lift.passengerCount + ' seat(s) for $' + lift.offeredFare.toFixed(2) + ')');
              
              const marker = L.marker([lift.pickupLat, lift.pickupLng]).addTo(map)
                .bindPopup('<b>Street Pickup Request</b><br>' + lift.pickupLandmark + '<br>Seats: ' + lift.passengerCount)
                .openPopup();
              liftMarkers.push(marker);
            } else if (data.type === 'ANOMALY_DETECTED') {
              fetchStatus();
              log('⚠️ [ANOMALY DETECTED] ' + data.payload.anomaly.description);
            } else if (data.type === 'CLEARANCE_UPDATE') {
              fetchStatus();
              log('[CLEARANCE] HMAC Signature verified.');
            } else if (data.type === 'QUEUE_UPDATE') {
              fetchStatus();
              log('[QUEUE] Vehicle joined rank line.');
            } else if (data.type === 'DEPARTURE_UPDATE') {
              fetchStatus();
              log('[FINANCE] Trip settled & WhatsApp Alert Dispatched.');
            } else if (data.type === 'SHIFT_CLOSED') {
              fetchStatus();
              log('[EOD AUDIT] Shift closed! SMS EOD Summary Dispatched.');
            } else if (data.type === 'PASSENGER_BOARDED') {
              fetchStatus();
              log('[PASSENGER] Seat reserved via ' + data.payload.pass.paymentMethod);
            }
          };

          initMap();
          initAuth();
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

// Seed Initial Shift State
mockDb.shifts.set('shift-998', {
  driverId: 'driver-001',
  conductorId: 'conductor-002',
  status: 'ACTIVE',
  startTime: new Date().toISOString()
});
mockDb.trustScores.set('driver-001', 85);

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` 🚀 BULAWAYO FLEET SERVER LIVE AT: http://localhost:${PORT}`);
  console.log(` 📱 PASSENGER APP AVAILABLE AT: http://localhost:${PORT}/passenger`);
  console.log(`==================================================\n`);

  TelemetryEmulator.startSimulation('shift-998', (point) => {
    mockRedis.set('location:shift-998', JSON.stringify(point));
    broadcastEvent('TELEMETRY_UPDATE', point);
  });
});
