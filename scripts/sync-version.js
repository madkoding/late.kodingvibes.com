const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/sync-version.js <version>');
  process.exit(1);
}

const rootDir = path.join(__dirname, '..');

// Sync late-web-ui/package.json
const pkgPath = path.join(rootDir, 'late-web-ui', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Sync late-web-ui/src/lib/version.ts
const versionTsPath = path.join(rootDir, 'late-web-ui', 'src', 'lib', 'version.ts');
let versionTs = fs.readFileSync(versionTsPath, 'utf8');
versionTs = versionTs.replace(
  /export const APP_VERSION = 'v[^']+'/,
  `export const APP_VERSION = 'v${version}'`
);
fs.writeFileSync(versionTsPath, versionTs);

console.log(`Synced shell version to v${version}`);
