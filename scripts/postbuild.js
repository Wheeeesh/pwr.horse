import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.warn('Postbuild: dist/index.html not found.');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');
const assetsDir = path.join(distDir, 'assets');

const assetRefs = Array.from(new Set(html.match(/assets\/[A-Za-z0-9_.-]+/g) || []));
if (assetRefs.length) {
  assetRefs.forEach((ref) => {
    const assetPath = path.join(distDir, ref);
    if (!fs.existsSync(assetPath)) return;
    const content = fs.readFileSync(assetPath);
    const ext = path.extname(ref).toLowerCase();
    const mime =
      ext === '.js'
        ? 'text/javascript'
        : ext === '.wasm'
          ? 'application/wasm'
          : ext === '.css'
            ? 'text/css'
            : 'application/octet-stream';
    const dataUrl = `data:${mime};base64,${content.toString('base64')}`;
    html = html.split(ref).join(dataUrl);
  });
}
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
  const bootScript = `
    <script>
      (function () {
        var boot = document.getElementById('boot');
        function setBoot(title, subtitle) {
          if (!boot) return;
          var titleEl = boot.querySelector('.boot-title');
          var subtitleEl = boot.querySelector('.boot-subtitle');
          if (titleEl) titleEl.textContent = title;
          if (subtitleEl) subtitleEl.textContent = subtitle;
        }
        window.addEventListener('error', function (event) {
          setBoot('Something went wrong', event && event.message ? event.message : 'App failed to load.');
        });
        window.addEventListener('unhandledrejection', function (event) {
          var reason = event && event.reason ? event.reason : 'App failed to load.';
          var message = reason instanceof Error ? reason.message : String(reason);
          setBoot('Something went wrong', message);
        });
        window.setTimeout(function () {
          if (!document.body.classList.contains('app-ready')) {
            setBoot('Still loading…', 'Large conversions load on demand. If this persists, refresh the page.');
          }
        }, 8000);
      })();
    </script>
  `;
  html = html.replace('</body>', `${loader}\n${bootScript}\n${script}\n</body>`);
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
if (!html.includes('body.app-ready #boot')) {
  html = html.replace('</head>', `${styleBlock}\n</head>`);
}

fs.writeFileSync(indexPath, html);

if (fs.existsSync(assetsDir)) {
  fs.rmSync(assetsDir, { recursive: true, force: true });
}

const entries = fs.readdirSync(distDir);
if (entries.length !== 1 || entries[0] !== 'index.html') {
  console.warn('Postbuild: dist contains extra files:', entries);
}
