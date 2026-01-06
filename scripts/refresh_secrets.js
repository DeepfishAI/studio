const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SECRETS_PATH = path.join(ROOT, 'config.secrets.json');

console.log('🔄 Fetching variables from Railway...');

try {
    // Run command, ignoring stdin/err, piping stdout
    const stdout = execSync('railway variables --json', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        cwd: ROOT
    });

    // Clean BOM and whitespace
    const clean = stdout.trim().replace(/^\uFEFF/, '');

    // Validate JSON
    try {
        JSON.parse(clean);
    } catch (parseError) {
        throw new Error(`Received invalid JSON from Railway: ${parseError.message}\nOutput start: ${clean.substring(0, 50)}...`);
    }

    // Write file
    fs.writeFileSync(SECRETS_PATH, clean, 'utf8');
    console.log('✅ Successfully refreshed config.secrets.json');
    console.log(`📁 Saved to: ${SECRETS_PATH}`);

} catch (e) {
    console.error('❌ Failed to refresh secrets:', e.message);
    process.exit(1);
}
