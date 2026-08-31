// Inside server.ts -> API 3: Verify Rank Clearance
if (req.url === '/api/clearance/verify' && req.method === 'POST') {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const data = JSON.parse(body || '{}');
      const shiftId = data.shiftId || 'shift-998';
      const marshalId = data.marshalId || 'marshal-CBD-01';
      const timestamp = data.timestamp || new Date().toISOString();

      // Accept signature from payload (Marshal App), or generate fallback for dev testing
      const signature = data.signature || TrustEngine.generateSignature({ shiftId, marshalId, timestamp });

      const result = TrustEngine.processClearance({
        shiftId,
        marshalId,
        timestamp,
        signature
      });

      res.writeHead(result.success ? 200 : 401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, reason: 'MALFORMED_PAYLOAD' }));
    }
  });
  return;
}
