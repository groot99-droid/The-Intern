#!/usr/bin/env node
// Dev-only convenience: runs the in-browser test suite (test/index.html)
// headlessly and prints the results. The suite itself needs nothing but a
// browser and tools/dev_server.py -- this script only automates opening the
// page, for machines that happen to have Node and Playwright. It is not part
// of the game and nothing depends on it (see test/Tests.md).
//
//   node tools/run_tests.cjs                          every case
//   node tools/run_tests.cjs friction world.anchors   only those cases (test/index.html?only=...)
//   node tools/run_tests.cjs --base=http://localhost:8000   use a dev server already running
//   node tools/run_tests.cjs --headed                 watch it run
//
// Without --base it starts tools/dev_server.py on a free port. Env: PYTHON
// (default python3, then python), PLAYWRIGHT (path to the playwright
// package if `require('playwright')` cannot find it), TEST_TIMEOUT_S
// (default 1500), TEST_VERBOSE=1 (echo the page's console).
//
// Exit code: 0 when every result passed, 1 on any failure, 2 when the page
// never reported (boot error, timeout).

'use strict';

const path = require('path');
const { startServer, loadPlaywright, CHROMIUM_ARGS } = require('./lib/devserver.cjs');

// HEADs the suite makes on purpose to prove a file is gone
const EXPECTED_404 = ['/src/minigames/_contract.js'];

async function main() {
  const args = process.argv.slice(2);
  const headed = args.includes('--headed');
  const baseArg = args.find((a) => a.startsWith('--base='));
  const only = args.filter((a) => !a.startsWith('--'));
  const timeoutS = parseInt(process.env.TEST_TIMEOUT_S || '1500', 10);

  const { chromium } = loadPlaywright();
  const server = baseArg ? { url: baseArg.slice('--base='.length).replace(/\/$/, ''), stop() {} } : await startServer(path.resolve(__dirname, '..'));
  let browser = null;
  let code = 2;
  try {
    browser = await chromium.launch({ headless: !headed, args: CHROMIUM_ARGS });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('response', (r) => {
      const url = r.url().replace(server.url, '');
      if (r.status() >= 400 && !EXPECTED_404.includes(url)) errors.push(`HTTP ${r.status()}: ${url}`);
    });
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console.error: ${m.text()}`);
      if (process.env.TEST_VERBOSE) console.log(`[page:${m.type()}] ${m.text()}`);
    });
    const q = only.length ? `?only=${encodeURIComponent(only.join(','))}` : '';
    const url = `${server.url}/test/index.html${q}`;
    console.log(`run_tests: ${url}`);
    const t0 = Date.now();
    await page.goto(url);
    // print each result as it lands
    let printed = 0;
    const deadline = t0 + timeoutS * 1000;
    let report = null;
    while (Date.now() < deadline) {
      const snap = await page.evaluate(() => ({ done: window.__TEST_RESULTS__ || null, live: (window.__TEST_LIVE__ || []).slice() })).catch(() => ({ done: null, live: [] }));
      const list = snap.done ? snap.done.results : snap.live;
      for (; printed < list.length; printed++) printResult(list[printed]);
      if (snap.done) { report = snap.done; break; }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!report) {
      console.error(`run_tests: no results after ${timeoutS}s`);
    } else {
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`\n${report.passed} / ${report.passed + report.failed} passed in ${secs}s`);
      code = report.failed === 0 ? 0 : 1;
    }
    if (errors.length) {
      console.log(`\npage errors outside the results (${errors.length}; informational):`);
      for (const e of errors.slice(0, 40)) console.log(`  ${e}`);
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.stop();
  }
  process.exit(code);
}

function printResult(r) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `\n        ${r.detail}` : ''}`);
}

main().catch((e) => { console.error(e); process.exit(2); });
