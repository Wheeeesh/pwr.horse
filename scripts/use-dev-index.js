import fs from 'fs';
import path from 'path';

const devIndex = path.resolve('index.dev.html');
const indexPath = path.resolve('index.html');

if (!fs.existsSync(devIndex)) {
  console.error('index.dev.html not found.');
  process.exit(1);
}

fs.copyFileSync(devIndex, indexPath);
