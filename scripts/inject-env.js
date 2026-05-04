const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'src', 'index.template.html');
const outPath = path.join(__dirname, '..', 'src', 'index.html');

function readEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

function readDotEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const out = {};
    for (let l of lines) {
      l = l.trim();
      if (!l || l.startsWith('#')) continue;
      const eq = l.indexOf('=');
      if (eq === -1) continue;
      const key = l.slice(0, eq).trim();
      let val = l.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  } catch (err) {
    return {};
  }
}

try {
  const tpl = fs.readFileSync(templatePath, 'utf8');

  let supabaseUrl = readEnv('SUPABASE_URL', '');
  let supabaseKey = readEnv('SUPABASE_ANON_KEY', '');
  // Fallback: try .env.local or .env files in project root when env vars missing
  if (!supabaseUrl || !supabaseKey) {
    const rootEnv = path.join(__dirname, '..', '.env.local');
    const fallbackEnv = path.join(__dirname, '..', '.env');
    let parsed = readDotEnvFile(rootEnv);
    if (Object.keys(parsed).length === 0) parsed = readDotEnvFile(fallbackEnv);
    if (!supabaseUrl && parsed.SUPABASE_URL) {
      supabaseUrl = parsed.SUPABASE_URL;
      console.log('[inject-env] SUPABASE_URL loaded from env file');
    }
    if (!supabaseKey && parsed.SUPABASE_ANON_KEY) {
      supabaseKey = parsed.SUPABASE_ANON_KEY;
      console.log('[inject-env] SUPABASE_ANON_KEY loaded from env file');
    }
  }
  // Diagnostic logs: only report presence (true/false), never print secret values.
  console.log('[inject-env] SUPABASE_URL set?', !!supabaseUrl);
  console.log('[inject-env] SUPABASE_ANON_KEY set?', !!supabaseKey);
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[inject-env] Warning: SUPABASE_URL or SUPABASE_ANON_KEY not set. Using empty values.');
  }

  const result = tpl
    .replace(/{{\s*SUPABASE_URL\s*}}/g, supabaseUrl)
    .replace(/{{\s*SUPABASE_ANON_KEY\s*}}/g, supabaseKey);

  fs.writeFileSync(outPath, result, 'utf8');
  console.log('[inject-env] Wrote', outPath);

  // Extra diagnostic: warn only for clearly invalid placeholder values
  const isPlaceholderKey =
    !supabaseKey ||
    supabaseKey.trim().length < 20 ||
    /YOUR|PLACEHOLDER|XXX|CHAVE|KEY/i.test(supabaseKey) ||
    supabaseKey.includes('<') ||
    supabaseKey.includes('>');

  if (isPlaceholderKey) {
    console.warn('[inject-env] Warning: SUPABASE_ANON_KEY is empty or looks like a placeholder. Verify environment variables or .env files.');
  }
} catch (err) {
  console.error('[inject-env] Error injecting env:', err);
  process.exit(1);
}
