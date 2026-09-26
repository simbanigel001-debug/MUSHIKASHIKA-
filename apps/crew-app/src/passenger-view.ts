// apps/crew-app/src/passenger-view.ts

export const PASSENGER_VIEW = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bulawayo Transit - Passenger App</title>
  <style>
    :root {
      --bg: #0d1117;
      --card: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --green: #2ea043;
      --blue: #58a6ff;
      --orange: #d29922;
      --purple: #8957e5;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .app-container {
      width: 100%;
      max-width: 420px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      color: var(--blue);
      font-size: 1.4rem;
      margin: 0 0 4px 0;
    }
    .header p {
      font-size: 0.85rem;
      color: #8b949e;
      margin: 0;
    }
    .nav-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .tab-btn {
      flex: 1;
      padding: 10px;
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
    }
    .tab-btn.active {
      background: var(--blue);
      color: #ffffff;
      border-color: var(--blue);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .form-group {
      margin-bottom: 12px;
    }
    label {
      display: block;
      font-size: 0.8rem;
      color: #8b949e;
      margin-bottom: 4px;
    }
    input, select {
      width: 100%;
      padding: 10px;
      background: #0d1117;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      box-sizing: border-box;
      font-size: 0.95rem;
    }
    .btn {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-green { background: var(--green); color: white; }
    .btn-orange { background: var(--orange); color: white; }
    .btn:hover { opacity: 0.9; }
    .ticket-pass {
      border: 2px dashed var(--green);
      background: rgba(46, 160, 67, 0.1);
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .token-box {
      background: #21262d;
      border: 1px solid var(--purple);
      padding: 10px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 1.1rem;
      color: #d2a8ff;
      letter-spacing: 2px;
      margin: 8px 0;
    }
    .hidden { display: none; }
    .status-pill {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: bold;
      background: #21262d;
      color: var(--blue);
    }
  </style>
</head>
<body>

  <div class="app-container">
    <div class="header">
      <h1>MUSHIKASHIKA PASSENGER</h1>
      <p>Bulawayo Digital Transit Network</p>
    </div>

    <!-- Mode Selector Tabs -->
    <div class="nav-tabs">
      <button class="tab-btn active" id="tabRankBtn" onclick="switchMode('RANK')">Rank Boarding</button>
      <button class="tab-btn" id="tabLiftBtn" onclick="switchMode('LIFT')">Street Pickup 🙋‍♂️</button>
    </div>

    <!-- Mode 1: Standard Rank Terminal Boarding -->
    <div id="rankMode" class="card">
      <h3 style="margin-top:0; color: var(--blue);">CBD Main Rank Pass</h3>
      <div class="form-group">
        <label>Payment Method</label>
        <select id="paymentMethod">
          <option value="CASH">💵 USD Cash at Rank ($0.50)</option>
          <option value="TOKEN">🎟️ Pre-paid Transit Token Code</option>
          <option value="ECOCASH">📲 EcoCash Wallet</option>
          <option value="INNBUCKS">⚡ InnBucks Wallet</option>
        </select>
      </div>
      <div class="form-group hidden" id="tokenGroup">
        <label>Enter Token Pass ID</label>
        <input type="text" id="tokenInput" placeholder="e.g. TOK-998-8F2A">
      </div>
      <button class="btn btn-green" onclick="buyRankPass()">Confirm & Reserve Seat ($0.50)</button>
    </div>

    <!-- Mode 2: InDrive-Style Street Pickup Request -->
    <div id="liftMode" class="card hidden">
      <h3 style="margin-top:0; color: var(--orange);">Request Street Lift</h3>
      <div class="form-group">
        <label>Pickup Point / Landmark</label>
        <input type="text" id="liftLandmark" value="Ascot Shopping Centre Gate">
      </div>
      <div class="form-group">
        <label>Destination</label>
        <input type="text" id="liftDest" value="CBD Main Rank">
      </div>
      <div class="form-group">
        <label>Seats Needed</label>
        <input type="number" id="liftSeats" value="1" min="1" max="5">
      </div>
      <div class="form-group">
        <label>Payment Method for Lift</label>
        <select id="liftPaymentMethod">
          <option value="CASH">💵 USD Cash to Driver/Conductor</option>
          <option value="TOKEN">🎟️ Transit Token Redempton</option>
          <option value="ECOCASH">📲 Direct Mobile Wallet Transfer</option>
        </select>
      </div>
      <div class="form-group">
        <label>Offered Fare per Seat ($)</label>
        <input type="number" id="liftFare" value="0.50" step="0.25">
      </div>
      <button class="btn btn-orange" onclick="requestStreetLift()">Broadcast Lift Request</button>
    </div>

    <!-- Dynamic Ticket / Request Confirmation Display -->
    <div id="ticketContainer" class="card hidden">
      <div class="ticket-pass" id="ticketContent"></div>
    </div>
  </div>

  <script>
    let activeMode = 'RANK';

    document.getElementById('paymentMethod').addEventListener('change', (e) => {
      document.getElementById('tokenGroup').classList.toggle('hidden', e.target.value !== 'TOKEN');
    });

    function switchMode(mode) {
      activeMode = mode;
      document.getElementById('tabRankBtn').classList.toggle('active', mode === 'RANK');
      document.getElementById('tabLiftBtn').classList.toggle('active', mode === 'LIFT');
      
      document.getElementById('rankMode').classList.toggle('hidden', mode !== 'RANK');
      document.getElementById('liftMode').classList.toggle('hidden', mode !== 'LIFT');
      document.getElementById('ticketContainer').classList.add('hidden');
    }

    async function buyRankPass() {
      const method = document.getElementById('paymentMethod').value;
      const tokenId = document.getElementById('tokenInput').value;

      const res = await fetch('/api/passenger/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shiftId: 'shift-998', 
          rankId: 'CBD-MAIN-RANK', 
          method: method === 'TOKEN' ? 'TOKEN:' + (tokenId || 'TOK-AUTO-001') : method
        })
      });
      const data = await res.json();
      
      if (data.success) {
        const generatedToken = 'TOK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        document.getElementById('ticketContainer').classList.remove('hidden');
        document.getElementById('ticketContent').innerHTML = \`
          <span class="status-pill">\${method === 'CASH' ? 'CASH RESERVATION' : 'CONFIRMED PASS'}</span>
          <h2 style="margin: 8px 0; color: #3fb950;">Pass #\${data.pass.passId.slice(-6)}</h2>
          <p style="margin: 4px 0;">Payment: <strong>\${data.pass.paymentMethod}</strong></p>
          <div class="token-box">\${method === 'TOKEN' ? tokenId : generatedToken}</div>
          <p style="margin: 4px 0; font-size: 0.8rem; color: #8b949e;">Show this token code or hand cash to the conductor upon entry</p>
        \`;
      }
    }

    async function requestStreetLift() {
      const landmark = document.getElementById('liftLandmark').value;
      const destination = document.getElementById('liftDest').value;
      const seats = parseInt(document.getElementById('liftSeats').value);
      const fare = parseFloat(document.getElementById('liftFare').value);
      const paymentMethod = document.getElementById('liftPaymentMethod').value;

      const res = await fetch('/api/lift/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+26377' + Math.floor(1000000 + Math.random() * 9000000),
          landmark,
          destination,
          seats,
          fare,
          paymentMethod,
          lat: -20.1530,
          lng: 28.5950
        })
      });
      const data = await res.json();

      if (data.success) {
        document.getElementById('ticketContainer').classList.remove('hidden');
        document.getElementById('ticketContent').innerHTML = \`
          <span class="status-pill" style="color: var(--orange);">BROADCASTING TO COMBIS...</span>
          <h3 style="margin: 8px 0; color: var(--orange);">Request Live!</h3>
          <p style="margin: 4px 0;">Pickup: <strong>\${data.lift.pickupLandmark}</strong></p>
          <p style="margin: 4px 0;">Seats: <strong>\${data.lift.passengerCount}</strong> | Payment: <strong>\${paymentMethod}</strong></p>
          <p style="margin: 4px 0;">Fare Offer: <strong>$\${data.lift.offeredFare.toFixed(2)}</strong></p>
          <p style="margin: 4px 0; font-size: 0.8rem; color: #8b949e;">Nearby kombis along the route can now accept your lift.</p>
        \`;
      }
    }
  </script>
</body>
</html>
`;
