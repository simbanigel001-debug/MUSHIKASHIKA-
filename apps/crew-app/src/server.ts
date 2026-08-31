import http from 'node:http';
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
          body {
            font-family: sans-serif;
            margin: 20px;
            background: #f4f4f9;
            color: #333;
          }
          h1 { color: #005b96; }
          .card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          button {
            background: #005b96;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            margin-right: 5px;
          }
          button:hover { background: #003366; }
          pre {
            background: #222;
            color: #0ef;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <h1>MUSHIKASHIKA FLEET TERMINAL</h1>

        <div class="card">
          <h2>Driver Shift Status</h2>
          <p>Shift ID: <strong id="shiftId">Loading...</strong></p>
          <p>Status: <strong id="status">Loading...</strong></p>
          <p>Crew Trust Score: <strong id="trustScore">Loading...</strong> / 100</p>
          <p>Latest GPS Telemetry: <span id="telemetry">None</span></p>
        </div>

        <div class="card">
          <h2>Controls & Actions</h2>
          <button onclick="sendGps()">Update Telemetry (GPS)</button>
          <button onclick="verifyRank()">Submit Rank Clearance</button>
        </div>

        <div class="card">
          <h2>Real-Time Logs</h2>
          <pre id="logs">System ready...</pre>
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
