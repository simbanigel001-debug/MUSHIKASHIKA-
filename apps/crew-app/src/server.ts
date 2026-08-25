// Frontend Driver Dashboard UI
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MUSHIKASHIKA Crew Terminal</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            background: #f0fdf4;
            background-image: 
              linear-gradient(135deg, rgba(254, 240, 138, 0.4) 0%, rgba(186, 230, 253, 0.4) 50%, rgba(254, 215, 170, 0.4) 100%),
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80' opacity='0.05'%3E%3Crect x='10' y='25' width='100' height='40' rx='8' fill='%3C%230284c7'%3E%3C/rect%3E%3Ccircle cx='30' cy='65' r='8' fill='%3C%23334155'%3E%3C/circle%3E%3Ccircle cx='90' cy='65' r='8' fill='%3C%23334155'%3E%3C/circle%3E%3C/svg%3E");
            color: #0f172a;
            padding: 24px;
            margin: 0;
            min-height: 100vh;
          }
          .header-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            padding: 8px 0;
          }
          .brand-logo {
            width: 42px;
            height: 42px;
          }
          .brand-title {
            font-size: 1.35rem;
            font-weight: 800;
            color: #0369a1;
            letter-spacing: 0.5px;
            margin: 0;
            text-transform: uppercase;
          }
          .card {
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(8px);
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 16px;
            border: 1px solid rgba(186, 230, 253, 0.8);
            box-shadow: 0 4px 12px -2px rgba(14, 165, 233, 0.08);
          }
          h2 {
            color: #0284c7;
            margin-top: 0;
            font-size: 1.1rem;
            font-weight: 700;
            border-bottom: 2px solid #bae6fd;
            padding-bottom: 8px;
          }
          p { margin: 8px 0; font-size: 0.95rem; }
          button {
            background: #0284c7;
            color: white;
            border: none;
            padding: 10px 18px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            margin-right: 8px;
            transition: background 0.2s, transform 0.1s;
          }
          button:hover { background: #0369a1; transform: translateY(-1px); }
          .badge {
            background: #22c55e;
            color: white;
            padding: 3px 10px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 0.85rem;
          }
          pre {
            background: #0f172a;
            padding: 14px;
            border-radius: 8px;
            color: #4ade80;
            overflow-x: auto;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.85rem;
          }
        </style>
      </head>
      <body>
        <div class="header-brand">
          <svg class="brand-logo" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="14" fill="#0284C7"/>
            <path d="M12 38C12 32.4772 16.4772 28 22 28H42C47.5228 28 52 32.4772 52 38V42H12V38Z" fill="#E0F2FE"/>
            <rect x="16" y="31" width="10" height="7" rx="2" fill="#0284C7"/>
            <rect x="29" y="31" width="10" height="7" rx="2" fill="#0284C7"/>
            <rect x="42" y="31" width="6" height="7" rx="2" fill="#0284C7"/>
            <circle cx="22" cy="44" r="5" fill="#0F172A"/>
            <circle cx="22" cy="44" r="2" fill="#F8FAFC"/>
            <circle cx="42" cy="44" r="5" fill="#0F172A"/>
            <circle cx="42" cy="44" r="2" fill="#F8FAFC"/>
          </svg>
          <h1 class="brand-title">Mushikashika Fleet Terminal</h1>
        </div>

        <div class="card">
          <h2>Driver Shift Status</h2>
          <p>Shift ID: <strong id="shiftId">Loading...</strong></p>
          <p>Status: <span id="status" class="badge">--</span></p>
          <p>Crew Trust Score: <strong id="trustScore" style="color: #d97706; font-size: 1.15em;">--</strong> / 100</p>
          <p>Latest GPS Telemetry: <span id="telemetry" style="color: #64748b;">No data streamed yet</span></p>
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
