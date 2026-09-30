// apps/crew-app/src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import http from 'node:http';
import cors from 'cors';
import { mockDb, mockRedis } from '../../../shared/database/emulator.ts';
import { TrustEngine } from './trust-engine.ts';
import { QueueEngine } from './queue-engine.ts';
import { FinanceEngine } from './finance-engine.ts';
import { ShiftEngine } from './shift-engine.ts';
import { AuthEngine } from './auth-engine.ts';
import { MARSHAL_VIEW, OWNER_VIEW } from './router-views.ts';
import { TelemetryEmulator } from './telemetry-emulator.ts';
import { ExportEngine } from './export-engine.ts';
import { AlertEngine } from './alert-engine.ts';
import { PassengerEngine } from './passenger-engine.ts';
import { PASSENGER_VIEW } from './passenger-view.ts';
import { AnomalyEngine } from './anomaly-engine.ts';
import { LiftEngine } from './lift-engine.ts';
import { MushikashikaTerminalEngine } from './mushikashika-terminal.ts';

const PORT = 3000;
const app = express();
const server = http.createServer(app);

const sseClients: Set<Response> = new Set();
const sabhukuEngine = new MushikashikaTerminalEngine();

// ==========================================
// 🛡️ MIDDLEWARES
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Authentication Middleware for Protected Routes
function authenticateRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = AuthEngine.extractTokenFromHeader(req.headers.authorization);
    const auth = token ? AuthEngine.verifyToken(token) : null;

    if (!auth || !allowedRoles.includes(auth.role)) {
      return res.status(401).json({ error: 'UNAUTHORIZED_ACCESS', requiredRoles: allowedRoles });
    }

    (req as any).user = auth;
    next();
  };
}

// SSE Event Broadcaster Utility
function broadcastEvent(type: string, payload: object) {
  const eventData = `data: ${JSON.stringify({ type, payload })}\n\n`;
  for (const client of sseClients) {
    if (client.writableEnded) {
      sseClients.delete(client);
      continue;
    }
    try {
      client.write(eventData);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ==========================================
// 📄 0 & 1. VIEWS & SERVICE WORKER
// ==========================================

app.get('/sw.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    self.addEventListener('install', (e) => self.skipWaiting());
    self.addEventListener('activate', (e) => self.clients.claim());
  `);
});

app.get('/passenger', (_req: Request, res: Response) => {
  res.type('html').send(PASSENGER_VIEW || '<h1>Passenger View Unavailable</h1>');
});

app.get('/marshal', (_req: Request, res: Response) => {
  res.type('html').send(MARSHAL_VIEW || '<h1>Marshal View Unavailable</h1>');
});

app.get('/owner', (_req: Request, res: Response) => {
  res.type('html').send(OWNER_VIEW || '<h1>Owner View Unavailable</h1>');
});

app.get('/terminal/sabhuku', (req: Request, res: Response) => {
  const count = Number(req.query.count) || 14;
  const plate = String(req.query.plate || 'AGE-3109');
  const driverId = String(req.query.driverId || 'DRV-8812');

  const screen = sabhukuEngine.renderSabhukuScreen(plate, count, driverId);
  res.type('text').send(screen);
});

// ==========================================
// 📡 2. REAL-TIME SSE STREAM ENDPOINT
// ==========================================

app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  req.on('close', () => sseClients.delete(res));
  req.on('error', () => sseClients.delete(res));
  res.on('error', () => sseClients.delete(res));
});

// ==========================================
// 🔑 3. AUTH & HELPER ENDPOINTS
// ==========================================

app.get('/api/auth/demo-tokens', (_req: Request, res: Response) => {
  try {
    const driverToken = AuthEngine.generateToken({ userId: 'driver-001', role: 'DRIVER', shiftId: 'shift-998' });
    const marshalToken = AuthEngine.generateToken({ userId: 'marshal-CBD-01', role: 'MARSHAL' });
    const ownerToken = AuthEngine.generateToken({ userId: 'owner-101', role: 'OWNER' });

    res.json({ driverToken, marshalToken, ownerToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 📊 4. OWNER FINANCIALS & EXPORTS
// ==========================================

app.get('/api/owner/export-csv', (_req: Request, res: Response) => {
  try {
    const csvData = ExportEngine.generateOwnerCsv('shift-998');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="owner-shift-report.csv"');
    res.send(csvData);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/owner/financials', (_req: Request, res: Response) => {
  try {
    const activeShifts = Array.from(mockDb.shifts.keys());
    
    let totalGross = 0;
    let totalOwnerPayout = 0;
    let totalDriverCommission = 0;
    let totalRankFees = 0;
    const shiftSummaries = [];

    for (const sId of activeShifts) {
      const financials = FinanceEngine.getShiftFinancials(sId);
      totalGross += financials.totalGross || 0;
      totalOwnerPayout += financials.totalOwnerPayout || 0;
      totalDriverCommission += financials.totalDriverCommission || 0;
      totalRankFees += financials.totalRankFees || 0;

      shiftSummaries.push({
        shiftId: sId,
        status: mockDb.shifts.get(sId)?.status,
        financials
      });
    }

    res.json({
      success: true,
      summary: {
        totalGross,
        totalOwnerPayout,
        totalDriverCommission,
        totalRankFees,
        activeShiftCount: activeShifts.length
      },
      shifts: shiftSummaries
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🚕 5. STREET LIFT PICKUP ROUTES
// ==========================================

app.post('/api/lift/request', (req: Request, res: Response) => {
  try {
    const data = req.body || {};
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
    res.json({ success: true, lift });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/lift/accept', (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const lift = LiftEngine.acceptRequest(data.requestId, data.shiftId || 'shift-998');

    broadcastEvent('LIFT_ACCEPTED', { lift });
    res.json({ success: true, lift });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/lift/pending', (_req: Request, res: Response) => {
  try {
    res.json({ pendingLifts: LiftEngine.getPendingRequests() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 🎟️ 6. PASSENGER BOARDING & TRACKING
// ==========================================

app.post('/api/passenger/board', (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const pass = PassengerEngine.issuePass(
      data.shiftId || 'shift-998',
      data.rankId || 'CBD-MAIN-RANK',
      data.method || 'ECOCASH'
    );

    broadcastEvent('PASSENGER_BOARDED', {
      pass,
      count: PassengerEngine.getBoardedCount(data.shiftId || 'shift-998')
    });

    res.json({ success: true, pass });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/passenger/track', (req: Request, res: Response) => {
  try {
    const passId = String(req.query.passId || '');
    const trackingData = PassengerEngine.trackPassenger(passId);

    if (!trackingData.pass) {
      return res.status(404).json({ success: false, error: 'INVALID_PASS_DIGITAL_ID' });
    }

    res.json({ success: true, tracking: trackingData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ⏱️ 7. TELEMETRY, SI 118 & SABHUKU ROUTES
// ==========================================

app.get('/api/shift/status', (_req: Request, res: Response) => {
  try {
    const shift = mockDb.shifts.get('shift-998') || { status: 'NO_ACTIVE_SHIFT' };
    const trustScore = mockDb.trustScores.get('driver-001') || 85;
    const geo = mockRedis.get('location:shift-998');
    const rankQueue = QueueEngine.getQueueStatus('CBD-MAIN-RANK');
    const financials = FinanceEngine.getShiftFinancials('shift-998');
    const passengerCount = PassengerEngine.getBoardedCount('shift-998');
    const anomalies = AnomalyEngine.getActiveAnomalies('shift-998');
    const pendingLifts = LiftEngine.getPendingRequests();

    res.json({
      shift,
      trustScore,
      latestGeo: geo ? JSON.parse(geo) : null,
      rankQueue,
      financials,
      passengerCount,
      anomalies,
      pendingLifts
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telemetry', (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
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

    const sabhukuEval = sabhukuEngine.processInTransitTelemetry(
      {
        vehicleId: payload.plateNumber || 'AGE-3109',
        currentSpeedKmH: speed,
        roadType: payload.roadType || 'SUBURBAN',
        durationOverSpeedSec: payload.durationOverSpeedSec || 0,
      },
      { lat, lng }
    );

    const shift = mockDb.shifts.get(shiftId);
    const hasClearance = shift ? shift.status === 'DEPARTED' : false;
    const anomaly = AnomalyEngine.inspectTelemetry(shiftId, lat, lng, speed, hasClearance);

    if (anomaly) {
      const currentTrust = mockDb.trustScores.get('driver-001') || 85;
      const newTrust = Math.max(0, currentTrust - anomaly.deductedTrust);
      mockDb.trustScores.set('driver-001', newTrust);

      broadcastEvent('ANOMALY_DETECTED', { anomaly, newTrust });
    }

    res.json({ status: 'TELEMETRY_UPDATED', point, anomalyDetected: !!anomaly, sabhukuEval });
  } catch {
    res.status(400).json({ error: 'INVALID_JSON' });
  }
});

app.post('/api/sabhuku/dispatch', (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const result = sabhukuEngine.dispatchVehicle(
      data.plateNumber || 'AGE-3109',
      data.passengerCount ?? 14,
      data.driverId || 'DRV-8812'
    );

    broadcastEvent('SABHUKU_DISPATCH', result);

    res.status(result.success ? 200 : 400).json(result);
  } catch {
    res.status(400).json({ success: false, message: 'MALFORMED_DISPATCH_PAYLOAD' });
  }
});

// ==========================================
// 👮 8. RANK QUEUE, MARSHAL CLEARANCE & SHIFT CLOSE
// ==========================================

// Authenticated clearance route using middleware
app.post('/api/clearance/verify', authenticateRole('MARSHAL', 'DRIVER'), (req: Request, res: Response) => {
  try {
    const auth = (req as any).user;
    const data = req.body || {};
    const shiftId = data.shiftId || 'shift-998';
    const marshalId = auth.userId;
    const timestamp = new Date().toISOString();
    const signature = TrustEngine.generateSignature({ shiftId, marshalId, timestamp });

    const result = TrustEngine.processClearance({ shiftId, marshalId, timestamp, signature });
    
    const shift = mockDb.shifts.get(shiftId);
    if (shift) shift.status = 'DEPARTED';

    broadcastEvent('CLEARANCE_UPDATE', result);
    res.status(result.success ? 200 : 401).json(result);
  } catch {
    res.status(400).json({ success: false, reason: 'MALFORMED_PAYLOAD' });
  }
});

app.post('/api/rank/join', (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const entry = QueueEngine.joinQueue(data.rankId || 'CBD-MAIN-RANK', data.shiftId || 'shift-998');
    broadcastEvent('QUEUE_UPDATE', entry);
    res.json({ success: true, entry });
  } catch {
    res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }
});

app.post('/api/rank/depart', (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const shiftId = data.shiftId || 'shift-998';
    const count = data.count || 16;
    
    const result = QueueEngine.verifyPassengerCount(data.rankId || 'CBD-MAIN-RANK', shiftId, count);

    if (result.success) {
      const settlement = FinanceEngine.processDepartureSettlement(shiftId, count);
      const cumulativeFinancials = FinanceEngine.getShiftFinancials(shiftId);

      broadcastEvent('DEPARTURE_UPDATE', { entry: result.entry, settlement });
      broadcastEvent('OWNER_FINANCIAL_UPDATE', {
        shiftId,
        settlement,
        cumulative: cumulativeFinancials
      });

      AlertEngine.sendDepartureAlert('+263771234567', shiftId, settlement.grossFare, settlement.ownerNetPayout);
    }

    res.status(result.success ? 200 : 400).json(result);
  } catch {
    res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }
});

app.post('/api/shift/close', (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const shiftId = data.shiftId || 'shift-998';
    const summary = ShiftEngine.closeShift(shiftId);

    broadcastEvent('SHIFT_CLOSED', summary);
    broadcastEvent('OWNER_FINANCIAL_UPDATE', {
      shiftId,
      status: 'CLOSED',
      cumulative: summary.financials
    });

    AlertEngine.sendShiftClosedAlert('+263771234567', shiftId, summary.financials.totalGross, summary.financials.totalOwnerPayout);

    res.json({ success: true, summary });
  } catch {
    res.status(400).json({ error: 'INVALID_PAYLOAD' });
  }
});

// ==========================================
// 🗺️ 9. MAIN FLEET TERMINAL UI
// ==========================================

app.get(['/', '/index.html'], (_req: Request, res: Response) => {
  res.type('html').send(`
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
          <button onclick="dispatchSabhuku()">Sabhuku Dispatch</button>
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

        async function dispatchSabhuku() {
          const res = await fetch('/api/sabhuku/dispatch', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ plateNumber: 'AGE-3109', passengerCount: 14, driverId: 'DRV-8812' })
          });
          const data = await res.json();
          log('[SABHUKU DISPATCH] ' + (data.success ? 'TOKEN: ' + data.token : 'FAILED: ' + data.message));
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
          } else if (data.type === 'SABHUKU_EVENT') {
            fetchStatus();
            log('👑 [SABHUKU EVENT] ' + data.payload.message);
          }
        };

        initMap();
        initAuth();
        fetchStatus();
      </script>
    </body>
    </html>
  `);
});

// 404 Fallback Middleware
app.use((_req: Request, res: Response) => {
  res.status(404).type('text').send('Not Found');
});

// ==========================================
// 🚀 INITIALIZATION & SERVER STARTUP
// ==========================================

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
  console.log(` 👮 MARSHAL VIEW AVAILABLE AT: http://localhost:${PORT}/marshal`);
  console.log(` 👑 SABHUKU TERMINAL AVAILABLE AT: http://localhost:${PORT}/terminal/sabhuku`);
  console.log(` 🏢 OWNER VIEW AVAILABLE AT: http://localhost:${PORT}/owner`);
  console.log(`==================================================\n`);

  TelemetryEmulator.startSimulation('shift-998', (point) => {
    mockRedis.set('location:shift-998', JSON.stringify(point));
    broadcastEvent('TELEMETRY_UPDATE', point);
  });
});
