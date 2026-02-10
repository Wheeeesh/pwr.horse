import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(assetsDir)) {
  fs.rmSync(assetsDir, { recursive: true, force: true });
}

if (!fs.existsSync(indexPath)) {
  console.warn('Postbuild: dist/index.html not found.');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');
const scriptMatch = html.match(/<script type="module"[^>]*>[\s\S]*?<\/script>/);
if (scriptMatch) {
  const script = scriptMatch[0];
  html = html.replace(script, '');
  const loader = `
    <div id="boot">
      <div class="boot-card">
        <div class="boot-title">pwr.horse</div>
        <div class="boot-subtitle">Loading the universal converter…</div>
      </div>
    </div>
  `;
  html = html.replace('</body>', `${loader}\n${script}\n</body>`);
}

const styleBlock = `
  <style>
    #boot {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f6f6f4;
      color: #111;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #boot .boot-card {
      border: 1px solid #e5e5e5;
      border-radius: 18px;
      padding: 24px 32px;
      background: #fff;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
      text-align: center;
    }
    #boot .boot-title { font-weight: 600; font-size: 18px; margin-bottom: 6px; }
    #boot .boot-subtitle { font-size: 13px; color: #666; }
    body.app-ready #boot { display: none; }
  </style>
`;
if (!html.includes('#boot')) {
  html = html.replace('</head>', `${styleBlock}\n</head>`);
}

fs.writeFileSync(indexPath, html);

const entries = fs.readdirSync(distDir);
if (entries.length !== 1 || entries[0] !== 'index.html') {
  console.warn('Postbuild: dist contains extra files:', entries);
}
