'use strict';
// Serversiz, bitta HTML fayl (dist/kuratorlar-oflayn.html): baza ham brauzerning ichida (SQLite/WASM).
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const root = path.join(__dirname, '..');
const sh = (f) => path.join(root, 'src/offline', f);
const plugin = {
  name: 'offline-auth',
  setup(b) { b.onResolve({ filter: /^\.\.\/auth$/ }, () => ({ path: sh('auth.js') })); },
};
esbuild.build({
  entryPoints: [sh('entry.js')], bundle: true, format: 'iife', minify: true, write: false, platform: 'browser', target: 'es2020',
  external: ['node:fs', 'node:path', 'node:crypto', 'fs', 'path'], loader: { '.wasm': 'binary' }, plugins: [plugin], logLevel: 'error',
  alias: { express: sh('express-shim.js'), crypto: sh('crypto-shim.js') },
  define: { 'process.env.NODE_ENV': '"production"' },
}).then((r) => {
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = fs.readFileSync(path.join(root, 'public/css/style.css'), 'utf8');
  let html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
    .replace(/<script type="module"[^>]*><\/script>/, () => `<script>${js}</script>`);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist/kuratorlar-oflayn.html'), html);
  console.log('dist/kuratorlar-oflayn.html tayyor:', (html.length / 1048576).toFixed(1), 'MB');
}).catch((e) => { console.error(e.message); process.exit(1); });
