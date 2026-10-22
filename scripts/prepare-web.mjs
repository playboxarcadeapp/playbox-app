// Builds the www/ folder that goes inside the phone app:
//  - copies the games from game/
//  - turns index.html into a full page with a phone viewport
//  - uses the fonts bundled in game/fonts so the app never calls the internet (important for kids' apps)
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'game'), out = path.join(root, 'www');

await fs.rm(out, { recursive: true, force: true });
await fs.cp(src, out, { recursive: true });
try { await fs.access(path.join(out, 'fonts', 'fonts.css')); } catch { throw new Error('game/fonts/fonts.css is missing'); }

// page wrapper
let html = await fs.readFile(path.join(src, 'index.html'), 'utf8');
html = html.replace(/<link[^>]+fonts\.googleapis\.com[^>]*>\s*/g, '');
html = html.replace(/<meta name="claude:[^>]*>\s*/g, '');
if (/fonts\.googleapis|https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''))) throw new Error('index.html still points at the internet');
const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<link rel="stylesheet" href="fonts/fonts.css">
<style>
  html, body { margin: 0; background: #070b1f; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  input { -webkit-user-select: text; user-select: text; }
</style>
`;
html = head + html.replace(/<meta charset="utf-8">\s*/i, '') + '\n</html>\n';
await fs.writeFile(path.join(out, 'index.html'), html);
console.log('www/ is ready:', (await fs.readdir(out)).length, 'items');
