import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { mockDb, mockRedis } from '../../../shared/database/emulator.ts';
import { RealtimeEngine } from './event-engine.ts';
import { TrustEngine } from './trust-engine.ts';

const PORT = 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve Local Logo Image
  if (req.url === '/assets/logo.png' && req.method === 'GET') {
    const logoPath = path.join(process.cwd(), 'apps/crew-app/src/assets/logo.png');
    if (fs.existsSync(logoPath)) {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(fs.readFileSync(logoPath));
      return;
    }
  }

  // Serve Local Combi Background Image
  if (req.url === '/assets/combi-bg.jpg' && req.method === 'GET') {
    const bgPath = path.join(process.cwd(), 'apps/crew-app/src/assets/combi-bg.jpg');
    if (fs.existsSync(bgPath)) {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(fs.readFileSync(bgPath));
      return;
    }
  }

  // API 1: Fetch Status
  if (req.url === '/api/shift/status' && req.method === 'GET') {
    const shift = mockDb.shifts.get('shift-998') || { status: 'NO_ACTIVE_SHIFT' };
    const trustScore = mockDb.trustScores.get('driver-001') || 80;
    const geo = mockRedis.get('location:shift-998');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ shift, trustScore, latestGeo: geo ? JSON.parse(geo) : null }));
    return;
  }

  // API 2: Telemetry
  if (req.url === '/api/telemetry' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const payload = JSON.parse(body || '{}');
      RealtimeEngine.publishLocation({
        shiftId: 'shift-998',
        lat: payload.lat || -17.8252,
        lng: payload.lng || 31.0335,
        speed: payload.speed || 45,
        timestamp: new Date().toISOString()
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'TELEMETRY_UPDATED' }));
    });
    return;
  }

  // API 3: Verify Rank Clearance
  if (req.url === '/api/clearance/verify' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const data = JSON.parse(body || '{}');
      const result = TrustEngine.processClearance({
        shiftId: 'shift-998',
        marshalId: data.marshalId || 'marshal-CBD-01',
        signature: 'sig_valid_sha256_mock_hash',
        timestamp: new Date().toISOString()
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // Terminal UI
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>MUSHIKASHIKA Crew Terminal</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('/assets/combi-bg.jpg') no-repeat center center fixed;
            background-size: cover;
          }
          .top-header {
            margin-bottom: 20px;
          }
          .brand-logo-img {
            height: 48px;
            width: auto;
            display: block;
            filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.5));
          }
          .main-layout {
            display: grid;
            grid-template-columns: 1fr;
            max-width: 800px;
          }
          .card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(8px);
            padding: 18px 22px;
            border-radius: 16px;
            margin-bottom: 16px;
            border: 1px solid rgba(255, 255, 255, 0.9);
            box-shadow: 0 8px 25px rgba(0,0,0,0.2);
          }
          h2 {
            color: #b93838;
            font-size: 1.3rem;
            margin-top: 0;
            margin-bottom: 10px;
            font-weight: 700;
          }
          p { margin: 6px 0; font-size: 0.95rem; font-weight: 600; color: #1e293b; }
          button {
            background: #0284c7;
            color: white;
            border: none;
            padding: 10px 18px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 0.9rem;
            margin-right: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          button:hover { background: #0369a1; }
          .badge {
            background: #11bfae;
            color: white;
            padding: 3px 10px;
            border-radius: 6px;
            font-weight: bold;
          }
          pre {
            background: rgba(240, 253, 244, 0.95);
            padding: 12px;
            border-radius: 8px;
            color: #166534;
            overflow-x: auto;
            font-family: monospace;
            font-size: 0.85rem;
            border: 1px solid #bbf7d0;
          }
        </style>
      </head>
      <body>
        <div class="top-header">
          <img src="/assets/logo.png" alt="Mushikashika Crew Terminal" class="brand-logo-img" />
        </div>

        <div class="main-layout">
          <div>
            <div class="card">
              <h2>Driver Shift Status</h2>
              <p>Shift ID: <span id="shiftId" style="color: #b93838;">shift-998</span></p>
              <p>Status: <span id="status" class="badge">ACTIVE</span></p>
              <p>Crew Trust Score: <strong id="trustScore" style="color: #d97706;">85</strong> / 100</p>
              <p>Latest GPS Telemetry: <span id="telemetry" style="color: #b93838;">Lat: -17.8252, Lng: 31.0335 (45 km/h)</span></p>
            </div>

            <div class="card">
              <h2>Controls & Actions</h2>
              <button onclick="sendGps()">Update Telemetry (GPS)</button>
              <button onclick="verifyRank()">Submit Rank Clearance</button>
            </div>

            <div class="card">
              <h2>Real-Time Logs</h2>
              <pre id="logs">System ready...
--- EXECUTING] Phases REALTIME TESTS --> Lat: -17.8252, Lng: 31.0335 (45 km/h)
[WS BROADCAST] Shift shift-998 Location > Lat: -17.8252, Lng: 31.0335 (45 km/h)
Redis Geo Cache Cahe: {"lat":-17.8252, lng: 31.0335, "speed":45}

--- LOCAL DATABASE & REDIS MOCK SERVER ---</pre>
            </div>
          </div>
        </div>

        <script>
          async function fetchStatus() {
            const res = await fetch('/api/shift/status');
            const data = await res.json();
            document.getElementById('shiftId').innerText = data.shift.status !== 'NO_ACTIVE_SHIFT' ? 'shift-998' : 'None';
            document.getElementById('status').innerText = data.shift.status || 'OFFLINE';
            document.getElementById('trustScore').innerText = data.trustScore;
            if (data.latestGeo) {
              document.getElementById('telemetry').innerText = 'Lat: ' + data.latestGeo.lat + ', Lng: ' + data.latestGeo.lng + ' (' + data.latestGeo.speed + ' km/h)';
            }
          }
          async function sendGps() {
            const res = await fetch('/api/telemetry', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ lat: -17.8252, lng: 31.0335, speed: Math.floor(Math.random() * 30) + 30 })
            });
            const data = await res.json();
            log('Telemetry Broadcast Sent -> Status: ' + data.status);
            fetchStatus();
          }
          async function verifyRank() {
            const res = await fetch('/api/clearance/verify', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ marshalId: 'marshal-RANK-04' })
            });
            const data = await res.json();
            log('Rank Clearance Processed! Updated Trust Score = ' + data.newScore);
            fetchStatus();
          }
          function log(msg) {
            document.getElementById('logs').innerText = '[' + new Date().toLocaleTimeString() + '] ' + msg + '\\n' + document.getElementById('logs').innerText;
          }
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
