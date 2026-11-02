'use strict';
// Butun interfeysni BITTA HTML faylga (dist/dashboard.html) yig'adi.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const root = path.join(__dirname, '..');
const js = esbuild.buildSync({ entryPoints: [path.join(root, 'public/js/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' }).outputFiles[0].text;
const css = fs.readFileSync(path.join(root, 'public/css/style.css'), 'utf8');
let html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script type="module"[^>]*><\/script>/, () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/dashboard.html'), html);
console.log('dist/dashboard.html tayyor:', Math.round(html.length / 1024), 'KB');
