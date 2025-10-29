// Netlify Function: gist-read
// Reads a public Gist file content and returns it as JSON.
const GIST_ID = process.env.GIST_ID || '004c3f9e832b7a8ad79fdb6a7e1796d5';

exports.handler = async function (event, context) {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`);
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'Failed to fetch gist' }) };
    }

    const gist = await res.json();
    // assume file named data.json or data
    const fileKey = Object.keys(gist.files)[0];
    const content = gist.files[fileKey].content;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
