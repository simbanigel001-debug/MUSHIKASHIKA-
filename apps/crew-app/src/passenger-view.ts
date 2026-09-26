// apps/crew-app/src/passenger-view.ts
export const PASSENGER_VIEW = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mushikashika - Digital Boarding Pass</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0d1117; color: #c9d1d9; margin: 0; padding: 20px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 20px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
    h1 { color: #58a6ff; font-size: 1.4rem; margin-top: 0; text-align: center; }
    .route-badge { background: #238636; color: #ffffff; text-align: center; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 0.85rem; margin-bottom: 20px; }
    .seat-box { background: #21262d; border: 2px dashed #8b949e; border-radius: 8px; text-align: center; padding: 15px; margin: 15px 0; }
    .seat-number { font-size: 2.5rem; font-weight: 800; color: #3fb950; }
    .btn { display: block; width: 100%; background: #238636; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; margin-top: 10px; }
    .btn:hover { background: #2ea043; }
    .btn-secondary { background: #1f6beb; }
    .pass-details { font-size: 0.9rem; line-height: 1.6; color: #8b949e; }
    .pass-details strong { color: #f0f6fc; }
  </style>
</head>
<body>
  <div class="card">
    <div class="route-badge">BULAWAYO CBD ➔ ASCOT / CRAWFORD</div>
    <h1>Boarding Pass</h1>
    
    <div id="booking-form">
      <p class="pass-details">Select mobile payment method to reserve seat on Kombi <strong>#998</strong>:</p>
      <button class="btn" onclick="payAndBoard('ECOCASH')">Pay $0.50 via EcoCash</button>
      <button class="btn btn-secondary" onclick="payAndBoard('INNBUCKS')">Pay $0.50 via InnBucks</button>
    </div>

    <div id="pass-display" style="display:none;">
      <div class="seat-box">
        <div style="font-size:0.8rem; color:#8b949e;">YOUR SEAT NUMBER</div>
        <div class="seat-number" id="seatNum">#--</div>
      </div>
      <div class="pass-details">
        <p>Pass ID: <strong id="passId">---</strong></p>
        <p>Fare Paid: <strong>$0.50 USD</strong></p>
        <p>Status: <strong style="color:#3fb950;">VERIFIED BOARDED</strong></p>
      </div>
    </div>
  </div>

  <script>
    async function payAndBoard(provider) {
      const res = await fetch('/api/passenger/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: 'shift-998', rankId: 'CBD-MAIN-RANK', method: provider })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('booking-form').style.display = 'none';
        document.getElementById('pass-display').style.display = 'block';
        document.getElementById('seatNum').innerText = '#' + data.pass.seatNumber;
        document.getElementById('passId').innerText = data.pass.passId;
      } else {
        alert('Bus is full or offline!');
      }
    }
  </script>
</body>
</html>
`;
