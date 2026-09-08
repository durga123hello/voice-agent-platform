const http = require('http');

http.get('http://localhost:3000/api/analytics/overview', (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('=== LATENCIES IN API RESPONSE ===');
      console.log(JSON.stringify(data.overview.latencies, null, 2));
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw body:', body);
    }
  });
}).on('error', console.error);
