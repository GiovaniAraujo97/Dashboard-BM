// Netlify Function: gist-write
// Updates the Gist content. Expects a POST body: { content: "...json string..." }
// Requires NETLIFY_GIST_TOKEN env var with a Personal Access Token (gist scope).
const GIST_ID = process.env.GIST_ID || '004c3f9e832b7a8ad79fdb6a7e1796d5';
const TOKEN = process.env.NETLIFY_GIST_TOKEN;

exports.handler = async function (event, context) {
  if (!TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured (missing NETLIFY_GIST_TOKEN)' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const content = body.content;
    if (!content) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing content' }) };
    }

    // Determine first file name by fetching gist metadata
    const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`);
    if (!gistRes.ok) return { statusCode: gistRes.status, body: JSON.stringify({ error: 'Failed to fetch gist' }) };
    const gist = await gistRes.json();
    const fileKey = Object.keys(gist.files)[0];

    const updateRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files: { [fileKey]: { content } } })
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      return { statusCode: updateRes.status, body: JSON.stringify({ error: text }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
