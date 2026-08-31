// apps/crew-app/src/router-views.ts

export const MARSHAL_VIEW = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Marshal Control Terminal</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 20px; background: #0f172a; color: #f8fafc; }
    h1 { color: #38bdf8; }
    .card { background: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #334155; }
    button { background: #0284c7; color: white; border: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1rem; }
    button:hover { background: #0369a1; }
    input { width: 100%; padding: 10px; margin: 8px 0 16px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; box-sizing: border-box; }
    #log { background: #020617; padding: 12px; border-radius: 6px; color: #4ade80; font-family: monospace; }
  </style>
</head>
<body>
  <h1>👮 MARSHAL CONTROL TERMINAL</h1>
  <div class="card">
    <label>Shift ID to Authorize</label>
    <input type="text" id="targetShift" value="shift-998">
    <button onclick="authorizeClearance()">Issue HMAC Clearance</button>
  </div>
  <div class="card">
    <label>Verified Passenger Count</label>
    <input type="number" id="passCount" value="16">
    <button onclick="authorizeDeparture()">Authorize Rank Departure</button>
  </div>
  <div id="log">Status: Initializing Auth...</div>

  <script>
    let token = '';
    async function init() {
      const res = await fetch('/api/auth/demo-tokens');
      const data = await res.json();
      token = data.marshalToken;
      document.getElementById('log').innerText = '✅ Marshal JWT Session Active';
    }

    async function authorizeClearance() {
      const shiftId = document.getElementById('targetShift').value;
      const res = await fetch('/api/clearance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ shiftId })
      });
      const data = await res.json();
      document.getElementById('log').innerText = '[CLEARANCE] ' + JSON.stringify(data);
    }

    async function authorizeDeparture() {
      const shiftId = document.getElementById('targetShift').value;
      const count = Number(document.getElementById('passCount').value);
      const res = await fetch('/api/rank/depart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankId: 'CBD-MAIN-RANK', shiftId, count })
      });
      const data = await res.json();
      document.getElementById('log').innerText = '[DEPARTURE] Total Gross $' + data.entry?.passengerCount * 1.50;
    }

    init();
  </script>
</body>
</html>
`;

export const OWNER_VIEW = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Owner Financial Portal</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 20px; background: #f8fafc; color: #0f172a; }
    h1 { color: #059669; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 4px solid #059669; }
    .val { font-size: 1.8rem; font-weight: bold; color: #047857; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>📊 FLEET OWNER FINANCIAL DASHBOARD</h1>
  <div class="grid">
    <div class="card">
      <div>Net Owner Payout</div>
      <div class="val" id="ownerNet">$0.00</div>
    </div>
    <div class="card">
      <div>Total Gross Revenue</div>
      <div class="val" id="gross">$0.00</div>
    </div>
    <div class="card">
      <div>Driver Commissions Paid</div>
      <div class="val" id="driverCut">$0.00</div>
    </div>
  </div>

  <script>
    async function loadStats() {
      const res = await fetch('/api/shift/status');
      const data = await res.json();
      if (data.financials) {
        document.getElementById('ownerNet').innerText = '$' + data.financials.totalOwnerPayout.toFixed(2);
        document.getElementById('gross').innerText = '$' + data.financials.totalGross.toFixed(2);
        document.getElementById('driverCut').innerText = '$' + data.financials.totalDriverCommission.toFixed(2);
      }
    }
    setInterval(loadStats, 2000);
    loadStats();
  </script>
</body>
</html>
`;
