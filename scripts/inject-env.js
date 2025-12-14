const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'src', 'index.template.html');
const outPath = path.join(__dirname, '..', 'src', 'index.html');

function readEnv(name, fallback = '') {
  return process.env[name] || fallback;
}

try {
  const tpl = fs.readFileSync(templatePath, 'utf8');

  const supabaseUrl = readEnv('SUPABASE_URL', '');
  const supabaseKey = readEnv('SUPABASE_ANON_KEY', '');

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[inject-env] Warning: SUPABASE_URL or SUPABASE_ANON_KEY not set. Using empty values.');
  }

  const result = tpl
    .replace(/{{\s*SUPABASE_URL\s*}}/g, supabaseUrl)
    .replace(/{{\s*SUPABASE_ANON_KEY\s*}}/g, supabaseKey);

  fs.writeFileSync(outPath, result, 'utf8');
  console.log('[inject-env] Wrote', outPath);
} catch (err) {
  console.error('[inject-env] Error injecting env:', err);
  process.exit(1);
}
