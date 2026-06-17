fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
})
  .then(r => r.json().then(d => ({ status: r.status, data: d })))
  .then(({ status, data }) => {
    console.log('Status:', status);
    console.log('Response:', JSON.stringify(data, null, 2));
  })
  .catch(e => console.error('Error:', e.message));
