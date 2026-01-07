const fetch = require('node-fetch');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('SUPABASE_URL or SUPABASE_ANON_KEY not set');
  process.exit(1);
}

(async () => {
  try {
    const res = await fetch(url + '/auth/v1/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': 'Bearer ' + key,
      },
      body: JSON.stringify({ email: 'test+deploycheck@example.com', password: 'Test1234!' })
    });
    console.log('status', res.status);
    const text = await res.text();
    console.log('body', text);
  } catch (err) {
    console.error('error', err.message || err);
  }
})();