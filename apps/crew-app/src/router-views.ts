export const PASSENGER_VIEW = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commuter Terminal - Mushikashika</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b0f19; color: #f8fafc; padding: 16px; max-width: 480px; margin: 0 auto; min-height: 100vh; }
    
    /* Top Greeting & Dynamic Weather Hero */
    .hero-banner {
      height: 180px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(11,15,25,0.2) 0%, rgba(11,15,25,0.95) 100%),
                  url('https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80') center/cover no-repeat;
      border: 1px solid #1e293b;
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      margin-bottom: 12px;
      position: relative;
    }
    .hero-greeting { font-size: 1.4rem; font-weight: 900; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
    .hero-sub { font-size: 0.85rem; color: #cbd5e1; font-weight: 600; }

    /* Zim Pulse Ticker */
    .pulse-card {
      background: #161e2e;
      border: 1px solid #facc15;
      border-radius: 12px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pulse-badge { background: #facc15; color: #0b0f19; font-weight: 900; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
    .pulse-text { font-size: 0.82rem; color: #e2e8f0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Booking & Search Card */
    .card { background: #161e2e; padding: 16px; border-radius: 16px; border: 1px solid #1e293b; margin-bottom: 16px; }
    .form-group { margin-bottom: 12px; }
    label { display: block; font-size: 0.75rem; font-weight: 800; color: #94a3b8; margin-bottom: 6px; letter-spacing: 0.5px; }
    select, input { width: 100%; padding: 12px; background: #0b0f19; border: 1px solid #334155; border-radius: 10px; color: #ffffff; font-size: 0.95rem; outline: none; }

    /* Kombi Queue Display */
    .kombi-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .reg-badge { background: #1e293b; color: #facc15; padding: 4px 8px; border-radius: 6px; font-weight: 800; font-size: 0.85rem; border: 1px solid #334155; }
    .fare-tag { font-size: 1.25rem; font-weight: 900; color: #4ade80; }
    .progress-bar-container { background: #0b0f19; height: 10px; border-radius: 5px; overflow: hidden; margin: 10px 0; }
    .progress-bar { background: #facc15; height: 100%; width: 71%; border-radius: 5px; }

    /* Buttons & Modal */
    .btn-main { width: 100%; padding: 14px; background: #facc15; color: #0b0f19; border: none; border-radius: 10px; font-size: 1rem; font-weight: 800; cursor: pointer; }
    .btn-report { width: 100%; padding: 10px; background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 8px; font-size: 0.85rem; font-weight: 700; margin-top: 10px; cursor: pointer; }
    
    .modal { display: none; background: #161e2e; padding: 20px; border-radius: 16px; border: 1px solid #334155; margin-top: 16px; }
    .ticket-view { background: #ffffff; color: #0b0f19; padding: 20px; border-radius: 16px; text-align: center; margin-top: 16px; }
    .qr-box { width: 130px; height: 130px; background: #0b0f19; margin: 12px auto; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 2rem; }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
    <div style="font-size: 1.1rem; font-weight: 900; color: #facc15;">🚌 MUSHIKASHIKA</div>
    <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Harare CBD</span>
  </div>

  <div class="hero-banner">
    <div class="hero-greeting" id="greetingText">Mamuka sei, Tendai!</div>
    <div class="hero-sub">7°C Harare CBD • Chilly morning on the routes</div>
  </div>

  <div class="pulse-card">
    <span class="pulse-badge">Zim Pulse</span>
    <div class="pulse-text">Winky D live in Kadoma this weekend! Long distance ranks packing early 🔥</div>
  </div>

  <div class="card">
    <div class="form-group">
      <label>SELECT DESTINATION ROUTE</label>
      <select id="routeSelect">
        <option value="chitungwiza">Chitungwiza Unit L ($1.50 USD)</option>
        <option value="avondale">Avondale / Shopping Centre ($0.50 USD)</option>
        <option value="msasa">Msasa Industrial ($0.75 USD)</option>
      </select>
    </div>
  </div>

  <div class="card">
    <div class="kombi-header">
      <div>
        <span class="reg-badge">ABJ 4920</span>
        <span style="font-size: 0.85rem; color: #94a3b8; margin-left: 6px;">Toyota Hiace</span>
      </div>
      <div class="fare-tag">$1.50</div>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #cbd5e1;">
      <span>Queue Status: <strong>Boarding</strong></span>
      <span><strong>10 / 14</strong> Seats Filled</span>
    </div>
    <div class="progress-bar-container"><div class="progress-bar"></div></div>
    <button class="btn-main" onclick="bookSeat()">Reserve Seat & Pay</button>
  </div>

  <!-- QR Ticket Output -->
  <div id="ticketModal" class="ticket-view" style="display:none;">
    <h3 style="font-size: 1.1rem; font-weight: 900;">DIGITAL BOARDING PASS</h3>
    <div class="qr-box">🏁</div>
    <div style="font-weight: 800; font-size: 0.95rem;" id="ticketRef">REF: MSHK-8920-X</div>
    <div style="font-size: 0.8rem; color: #475569; margin-top: 4px;">Show to Rank Marshal or Conductor</div>
    <button class="btn-report" onclick="openReportModal()">Report Crew Incident</button>
  </div>

  <!-- Incident Report Modal -->
  <div id="reportModal" class="modal">
    <h3 style="color: #ef4444; font-size: 1rem; margin-bottom: 10px;">Report Crew / Vehicle Incident</h3>
    <div class="form-group">
      <label>WHO WAS INVOLVED?</label>
      <select id="targetCrew">
        <option value="driver">Driver (Speeding / Misconduct)</option>
        <option value="conductor">Conductor (Fare Dispute / Overcharge)</option>
        <option value="marshal">Rank Marshal (Coercion / Delay)</option>
      </select>
    </div>
    <div class="form-group">
      <label>INCIDENT DETAILS</label>
      <input type="text" id="reportDetails" placeholder="Describe issue briefly..." />
    </div>
    <button class="btn-main" style="background: #ef4444; color: #ffffff;" onclick="submitReport()">Submit Complaint</button>
  </div>

  <script>
    function bookSeat() {
      document.getElementById('ticketModal').style.display = 'block';
      document.getElementById('ticketModal').scrollIntoView({ behavior: 'smooth' });
    }
    function openReportModal() {
      document.getElementById('reportModal').style.display = 'block';
      document.getElementById('reportModal').scrollIntoView({ behavior: 'smooth' });
    }
    function submitReport() {
      alert('Report submitted directly to Fleet Owner & Council Transit Inspectors.');
      document.getElementById('reportModal').style.display = 'none';
    }
  </script>
</body>
</html>
`;
