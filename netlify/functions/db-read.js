const fetch = require('node-fetch');

// Netlify Function: lê o conteúdo do registro único 'singleton' na tabela app_data do Supabase
// Expects env: SUPABASE_URL, SUPABASE_KEY (service_role)

exports.handler = async function (event, context) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/app_data?id=eq.singleton&select=content`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: res.status, body: text };
    }

    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      return { statusCode: 200, body: JSON.stringify({ content: JSON.stringify(json[0].content) }) };
    }

    // not found -> return empty template
    const empty = { emprestimos: [], clientes: [], lastUpdated: new Date().toISOString(), version: 1 };
    return { statusCode: 200, body: JSON.stringify({ content: JSON.stringify(empty) }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
