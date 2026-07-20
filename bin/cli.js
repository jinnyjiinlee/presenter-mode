#!/usr/bin/env node
/* presenter-mode CLI
   npx presenter-mode          → serve the demo locally and open it in your browser
   npx presenter-mode init     → copy the template (index.html) into the current folder
   npx presenter-mode --help   → this help */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const TEMPLATE = path.join(__dirname, '..', 'index.html');
const args = process.argv.slice(2);

function openBrowser(url) {
  if (process.env.PM_NO_OPEN) return; // for CI / tests
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start ""'
    : 'xdg-open';
  exec(cmd + ' "' + url + '"', () => {});
}

function help() {
  console.log(`
presenter-mode — presenter view for HTML slide decks (one file, offline)

Usage:
  npx presenter-mode              Serve the 7-slide demo and open it (press P!)
  npx presenter-mode init [name]  Copy the template into the current folder
                                  (default: presenter-mode.html)
  npx presenter-mode --help       Show this help

Docs & template guide: https://github.com/jinnyjiinlee/presenter-mode
`);
}

function init() {
  const name = args[1] && !args[1].startsWith('-') ? args[1] : 'presenter-mode.html';
  const dest = path.resolve(process.cwd(), name);
  if (fs.existsSync(dest)) {
    console.error('✋ ' + name + ' already exists — pick another name: npx presenter-mode init my-deck.html');
    process.exit(1);
  }
  fs.copyFileSync(TEMPLATE, dest);
  console.log('✅ Template copied to ' + name);
  console.log('   1. Open it in Chrome and press P to try the presenter view');
  console.log('   2. Replace the slides between the ▼▼▼ REPLACE markers with your own');
  console.log('   3. Fill in the NOTES array and set a unique DECK_ID');
}

function serve() {
  const html = fs.readFileSync(TEMPLATE);
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  server.listen(0, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    console.log('▶ Presenter Mode demo: ' + url);
    console.log('  Press P in the page to open the presenter window. Ctrl+C to stop.');
    openBrowser(url);
  });
}

if (args.includes('--help') || args.includes('-h')) help();
else if (args[0] === 'init') init();
else serve();
