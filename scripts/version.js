const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let hash = 'dev';
try {
  hash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {}

const pkg = require('../package.json');
const version = pkg.version;

const envPath = path.join(__dirname, '..', '.env.local');
const content = `REACT_APP_VERSION=${version}\nREACT_APP_GIT_HASH=${hash}\n`;

fs.writeFileSync(envPath, content);
console.log(`✅ Version: v${version} (${hash})`);
