// apps/crew-app/src/passenger-view.ts
export const PASSENGER_VIEW = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mushikashika - Passenger Commuter Portal</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 16px; background: #0f172a; color: #f8fafc; }
    .card { background: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #334155; }
    h1 { color: #38bdf8; font-size: 1.4rem; margin-top: 0; }
    h2 { font-size: 1.1rem; color: #94a3b8; margin-top: 0; }
    #pickerMap { height: 240px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #475569; }
    input, select, button { width: 100%; padding: 12px; margin-top: 8px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; box-sizing: border-box; }
    button { background: #0284c7; font-weight: bold; cursor: pointer; border: none; margin-top: 14px; }
    button:hover { background: #0369a1; }
    .coords { font-size: 0.8rem; color: #38bdf8; margin-top: 4px; }
    .ticket { background: #0284c7; color: white; padding: 12px; border-radius: 8px; text-align: center; display: none; }
  </style>
</head>
<body>
  <h1>🚕 COMMUTER LIFT & TICKET PORTAL</h1>

  <div class="card">
    <h2>1. Pin Your Pickup Location</h2>
    <p style="font-size: 0.85rem; color: #94a3b8;">Tap or drag the marker to your exact street location:</p>
    <div id="pickerMap"></div>
    <div class="coords">Selected Coordinates: <span id="coordText">-20.1550, 28.5900</span></div>
  </div>

  <div class="card">
    <h2>2. Lift & Boarding Details</h2>
    <label>Landmark / Pickup Note:</label>
    <input type="text" id="landmark" value="Ascot Shopping Centre Gate">

    <label>Destination:</label>
    <input type="text" id="destination" value="CBD Main Rank">

    <label>Seats Needed:</label>
    <input type="number" id="seats" value="1" min="1" max="7">

    <label>Offered Fare ($):</label>
    <input type="number" id="fare" value="0.50" step="0.50">

    <button onclick="requestStreetLift()">Request Street Pickup</button>
    <button onclick="selfBoardRank()" style="background: #16a34a; margin-top: 8px;">Board Rank Vehicle (EcoCash)</button>
  </div>

  <div id="ticketCard" class="card ticket">
    <h3>PASS ISSUED</h3>
    <p>Digital ID: <strong id="digitalId">-</strong></p>
    <p>Status: <span id="passStatus">BOARDED / TRACKING LIVE</span></p>
  </div>

  <script>
    let map, marker;
    let selectedLat = -20.1550;
    let selectedLng = 28.5900;

    function initPickerMap() {
      map = L.map('pickerMap').setView([selectedLat, selectedLng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      marker = L.marker([selectedLat, selectedLng], { draggable: true }).addTo(map);

      marker.on('dragend', function (e) {
        const latLng = marker.getLatLng();
        updateCoords(latLng.lat, latLng.lng);
      });

      map.on('click', function (e) {
        marker.setLatLng(e.latlng);
        updateCoords(e.latlng.lat, e.latlng.lng);
      });
    }

    function updateCoords(lat, lng) {
      selectedLat = parseFloat(lat.toFixed(6));
      selectedLng = parseFloat(lng.toFixed(6));
      document.getElementById('coordText').innerText = selectedLat + ', ' + selectedLng;
    }

    async function requestStreetLift() {
      const landmark = document.getElementById('landmark').value;
      const destination = document.getElementById('destination').value;
      const seats = parseInt(document.getElementById('seats').value);
      const fare = parseFloat(document.getElementById('fare').value);

      const res = await fetch('/api/lift/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: selectedLat,
          lng: selectedLng,
          landmark,
          destination,
          seats,
          fare
        })
      });

      const data = await res.json();
      if (data.success) {
        document.getElementById('ticketCard').style.display = 'block';
        document.getElementById('digitalId').innerText = data.lift.id;
        document.getElementById('passStatus').innerText = 'LIFT REQUESTED (PENDING DRIVER)';
        alert('Pickup requested! Driver notified on fleet radar.');
      }
    }

    async function selfBoardRank() {
      const res = await fetch('/api/passenger/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: 'shift-998', rankId: 'CBD-MAIN-RANK', method: 'ECOCASH' })
      });

      const data = await res.json();
      if (data.success) {
        document.getElementById('ticketCard').style.display = 'block';
        document.getElementById('digitalId').innerText = data.pass.passId;
        document.getElementById('passStatus').innerText = 'BOARDED & LIVE TRACKED';
        alert('Boarding pass issued! Digital ID created.');
      }
    }

    initPickerMap();
  </script>
</body>
</html>
`;
