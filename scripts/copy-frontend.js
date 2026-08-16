const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend');
const dest = path.join(__dirname, '..', 'dist', 'frontend');

fs.cpSync(src, dest, { recursive: true });
console.log(`✅ Copied frontend/ -> dist/frontend/`);
