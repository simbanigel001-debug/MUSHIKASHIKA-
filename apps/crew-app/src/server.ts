import http from 'http';
import { URL } from 'url';

// ============================================================================
// 1. IN-MEMORY TYPES & DATA STORES
// ============================================================================

interface LiftRequest {
  id: string;
  phone: string;
  pickupLandmark: string;
  destination: string;
  passengerCount: number;
  offeredFare: number;
  paymentMethod: string;
  lat: number;
  lng: number;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED';
  createdAt: string;
}

interface BoardingPass {
  passId: string;
  shiftId: string;
  rankId: string;
  paymentMethod: string;
  amount: number;
  issuedAt: string;
}

interface ChangeToken {
  tokenId: string;
  issuedByShiftId: string;
  amount: number;
  status: 'ACTIVE' | 'REDEEMED' | 'CASHED_OUT';
  issuedAt: string;
}

const liftRequests: Map<string, LiftRequest> = new Map();
const boardingPasses: BoardingPass[] = [];
const changeTokens: Map<string, ChangeToken> = new Map();
const clients: Set<http.ServerResponse> = new Set();

// ============================================================================
// 2. CORE BUSINESS ENGINES
// ============================================================================

class TokenEngine {
  static issueChangeToken(shiftId: string, amount: number): ChangeToken {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const tokenId = `CHG-${randomCode}`;
    
    const token: ChangeToken = {
      tokenId,
      issuedByShiftId: shiftId,
      amount,
      status: 'ACTIVE',
      issuedAt: new Date().toISOString()
    };

    changeTokens.set(tokenId, token);
    return token;
  }

  static redeemToken(tokenId: string, requiredAmount: number): { success: boolean; remainingBalance: number; message: string } {
    const token = changeTokens.get(tokenId);
    if (!token) return { success: false, remainingBalance: 0, message: 'INVALID_TOKEN' };
    if (token.status !== 'ACTIVE') return { success: false, remainingBalance: 0, message: 'TOKEN_ALREADY_USED' };
    if (token.amount < requiredAmount) return { success: false, remainingBalance: token.amount, message: 'INSUFFICIENT_TOKEN_BALANCE' };

    token.amount -= requiredAmount;
    if (token.amount === 0) {
      token.status = 'REDEEMED';
    }
    
    changeTokens.set(tokenId, token);
    return { success: true, remainingBalance: token.amount, message: 'TOKEN_REDEEMED' };
  }
}

// ============================================================================
// 3. SERVER-SENT EVENTS (SSE) BROADCAST ENGINE
// ============================================================================

function broadcastEvent(eventType: string, data: Record<string, any>) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

// ============================================================================
// 4. EMBEDDED PASSENGER WEB UI HTML (MOBILE RESPONSIVE)
// ============================================================================

const PASSENGER_HTML = `
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
    .btn-purple { background: var(--purple); color: white; margin-top: 8px; }
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
        <select id="paymentMethod" onchange="toggleTokenInput()">
          <option value="CASH">💵 USD Cash at Rank ($0.50)</option>
          <option value="TOKEN">🎟️ Pre-paid Transit Token / Change Code</option>
          <option value="ECOCASH">📲 EcoCash Wallet</option>
          <option value="INNBUCKS">⚡ InnBucks Wallet</option>
        </select>
      </div>
      <div class="form-group hidden" id="tokenGroup">
        <label>Enter Token / Change Code</label>
        <input type="text" id="tokenInput" placeholder="e.g. CHG-8821">
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
          <option value="TOKEN">🎟️ Transit / Change Token Redemption</option>
          <option value="ECOCASH">📲 Direct Mobile Wallet Transfer</option>
        </select>
      </div>
      <div class="form-group">
        <label>Offered Fare per Seat ($)</label>
        <input type="number" id="liftFare" value="0.50" step="0.25">
      </div>
      <button class="btn btn-orange" onclick="requestStreetLift()">Broadcast Lift Request</button>
    </div>

    <!-- Conductor Quick Change Simulator -->
    <div class="card">
      <h3 style="margin-top:0; color: var(--purple);">Conductor Tools</h3>
      <p style="font-size:0.8rem; color:#8b949e;">Simulate issuing change tokens to passengers paying large notes.</p>
      <div class="form-group">
        <label>Change Amount Due ($)</label>
        <input type="number" id="changeAmt" value="4.50" step="0.50">
      </div>
      <button class="btn btn-purple" onclick="issueConductorChange()">Issue Change Token Code</button>
    </div>

    <!-- Dynamic Ticket / Confirmation Display -->
    <div id="ticketContainer" class="card hidden">
      <div class="ticket-pass" id="ticketContent"></div>
    </div>
  </div>

  <script>
    let activeMode = 'RANK';

    function toggleTokenInput() {
      const method = document.getElementById('paymentMethod').value;
      document.getElementById('tokenGroup').classList.toggle('hidden', method !== 'TOKEN');
    }

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
          method: method === 'TOKEN' ? 'TOKEN:' + tokenId : method
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
          <div class="token-box">\${method === 'TOKEN' ? (tokenId || 'TOK-REDEEMED') : generatedToken}</div>
          <p style="margin: 4px 0; font-size: 0.8rem; color: #8b949e;">Show this code or hand cash to conductor upon boarding</p>
        \`;
      } else {
        alert(data.error || 'Failed to process board request');
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

    async function issueConductorChange() {
      const amount = parseFloat(document.getElementById('changeAmt').value);
      const res = await fetch('/api/conductor/issue-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: 'shift-998', amount })
      });
      const data = await res.json();

      if (data.success) {
        document.getElementById('ticketContainer').classList.remove('hidden');
        document.getElementById('ticketContent').innerHTML = \`
          <span class="status-pill" style="color: var(--purple);">CHANGE TOKEN ISSUED</span>
          <h2 style="margin: 8px 0; color: #d2a8ff;">$\${data.token.amount.toFixed(2)} USD</h2>
          <div class="token-box">\${data.token.tokenId}</div>
          <p style="margin: 4px 0; font-size: 0.8rem; color: #8b949e;">Passenger can redeem this code on their next ride or cash out at CBD Rank</p>
        \`;
      }
    }
  </script>
</body>
</html>
`;

// ============================================================================
// 5. MAIN HTTP SERVER AND API ROUTING
// ============================================================================

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = parsedUrl.pathname;

  // Serve Main Terminal
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bulawayo Fleet Live Server</title>
        <style>
          body { font-family: monospace; background: #0d1117; color: #58a6ff; padding: 20px; }
          .card { background: #161b22; border: 1px solid #30363d; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
          a { color: #2ea043; text-decoration: none; font-size: 1.2rem; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>==================================================</h1>
        <h1>BULAWAYO FLEET SERVER LIVE AT: http://localhost:3000</h1>
        <h1>PASSENGER APP AVAILABLE AT: http://localhost:3000/passenger</h1>
        <h1>==================================================</h1>
        <div class="card">
          <p>GPS Telemetry Emulator (Bulawayo Route) started for shift: <strong>shift-998</strong></p>
          <a href="/passenger" target="_blank">Open Passenger App Interface &rarr;</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Serve Passenger Web App Interface
  if (pathname === '/passenger' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(PASSENGER_HTML);
    return;
  }

  // SSE Stream Endpoint
  if (pathname === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // API: Passenger Boarding Pass
  if (pathname === '/api/passenger/board' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const method = data.method || 'CASH';

        if (method.startsWith('TOKEN:')) {
          const tokenId = method.replace('TOKEN:', '').trim();
          const redemption = TokenEngine.redeemToken(tokenId, 0.50);
          if (!redemption.success && tokenId !== '') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: redemption.message }));
            return;
          }
        }

        const pass: BoardingPass = {
          passId: `PASS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          shiftId: data.shiftId || 'shift-998',
          rankId: data.rankId || 'CBD-MAIN-RANK',
          paymentMethod: method,
          amount: 0.50,
          issuedAt: new Date().toISOString()
        };

        boardingPasses.push(pass);
        broadcastEvent('PASSENGER_BOARDED', { pass });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, pass }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API: Street Lift Request (InDrive Style)
  if (pathname === '/api/lift/request' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const lift: LiftRequest = {
          id: `LIFT-${Date.now()}`,
          phone: data.phone || '+263770000000',
          pickupLandmark: data.landmark || 'Ascot Shopping Centre',
          destination: data.destination || 'CBD Main Rank',
          passengerCount: data.seats || 1,
          offeredFare: data.fare || 0.50,
          paymentMethod: data.paymentMethod || 'CASH',
          lat: data.lat || -20.1530,
          lng: data.lng || 28.5950,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        };

        liftRequests.set(lift.id, lift);
        broadcastEvent('STREET_LIFT_REQUESTED', { lift });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, lift }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API: Conductor Issues Change Token
  if (pathname === '/api/conductor/issue-change' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const shiftId = data.shiftId || 'shift-998';
        const changeAmount = data.amount || 4.50;

        const token = TokenEngine.issueChangeToken(shiftId, changeAmount);
        broadcastEvent('CHANGE_TOKEN_ISSUED', { token });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, token }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
});

// Start listening
const PORT = 3000;
server.listen(PORT, () => {
  console.log('==================================================');
  console.log(`BULAWAYO FLEET SERVER LIVE AT: http://localhost:${PORT}`);
  console.log(`PASSENGER APP AVAILABLE AT: http://localhost:${PORT}/passenger`);
  console.log('==================================================');
  console.log('GPS Telemetry Emulator (Bulawayo Route) started for shift: shift-998');
});
