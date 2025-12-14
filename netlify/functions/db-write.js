const fetch = require('node-fetch');

// Netlify Function: grava (upsert) o conteúdo JSON na tabela app_data do Supabase
// Expects env: SUPABASE_URL, SUPABASE_KEY (service_role)

exports.handler = async function (event, context) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.content) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing content' }) };
    }

    // Upsert row with id = 'singleton'
    const url = `${SUPABASE_URL}/rest/v1/app_data?id=eq.singleton`;

    // Supabase REST upsert via POST with Prefer: resolution=merge-duplicates and passing the row
    const row = { id: 'singleton', content: JSON.parse(body.content) };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(row)
    });

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: text };
    }

    return { statusCode: 200, body: JSON.stringify({ status: 'ok' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
