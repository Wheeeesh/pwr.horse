import fs from 'fs';
import path from 'path';

const distIndex = path.resolve('dist/index.html');
const indexPath = path.resolve('index.html');

if (!fs.existsSync(distIndex)) {
  console.error('dist/index.html not found. Run build first.');
  process.exit(1);
}

fs.copyFileSync(distIndex, indexPath);
