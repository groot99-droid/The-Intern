#!/usr/bin/env node
// Dev-only convenience: plays whole games headlessly with the autopilot
// (src/dev/autopilot.js, index.html?autopilot=PLAN) and checks each one
// reaches the ending its choices should reach. Not part of the game; needs
// Node and Playwright (see test/Tests.md). In a software renderer a path
// takes several minutes.
//
//   node tools/walkthrough.cjs                    the default paths below
//   node tools/walkthrough.cjs SSSSSSSR           one plan (seed C)
//   node tools/walkthrough.cjs RRRRRRRR --seed=H --bail=S4
//   options: --seed=C|H  --bail=S4  --speed=3  --headed  --width=640 --height=360
//            --base=http://localhost:8000 (a dev server already running; default: start one)
//            --stall=90 (seconds without progress before a path fails)
//            --timeout=2400 (seconds per path)
//
// For each path: screenshots at every scene change (and the ending card)
// under tools/out/walkthrough/<path>/, the autopilot's log there too, and
// the ending card's title checked against text/endings.json for the ending
// state.js resolves for that plan. A path fails on any page error or
// console error, on no progress for --stall seconds, or on the wrong card.

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { startServer, loadPlaywright, CHROMIUM_ARGS } = require('./lib/devserver.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out', 'walkthrough');

const DEFAULT_PATHS = [
  { plan: 'SSSSSSSS', seed: 'C', expect: 'ASSIMILATION' },
  { plan: 'RRRRRRRR', seed: 'H', expect: 'EXPULSION' },
  { plan: 'SSSSSSSR', seed: 'C', expect: 'RETAINED' },
  { plan: 'SRSRSRSR', seed: 'C', expect: 'PENDING' },
  { plan: 'RRRRRRRR', seed: 'H', bail: 'S4', expect: 'PENDING' }
];
const CARD_KEY = { ASSIMILATION: 'ending.assimilation', EXPULSION: 'ending.expulsion', PENDING: 'ending.pending', RETAINED: 'ending.retained' };

function parseArgs(argv) {
  const opts = { speed: 3, headed: false, width: 640, height: 360, stall: 90, timeout: 2400, plans: [] };
  for (const a of argv) {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(a);
    if (!m) { opts.plans.push(a.toUpperCase()); continue; }
    const [, k, v] = m;
    if (k === 'headed') opts.headed = true;
    else if (['speed', 'width', 'height', 'stall', 'timeout'].includes(k)) opts[k] = parseFloat(v);
    else if (k === 'seed') opts.seed = (v || 'C').toUpperCase();
    else if (k === 'bail') opts.bail = (v || '').toUpperCase();
    else if (k === 'base') opts.base = (v || '').replace(/\/$/, '');
    else throw new Error(`unknown option --${k}`);
  }
  return opts;
}

// The ending state.js resolves for a plan, played the way the director plays
// it: the S0 seed, renderFor at the top of each scene, the threshold's
// setFlag from data/scenes.json, EARLY_EXIT on reaching the bail scene.
async function expectedEnding({ plan, seed, bail }) {
  const st = await import(pathToFileURL(path.join(ROOT, 'src', 'state.js')).href);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scenes.json'), 'utf8'));
  const state = st.createState();
  st.seedRenderFromIntake(state, seed === 'H' ? 3 : 0);
  for (let i = 0; i < 8; i++) {
    const sid = manifest.spineOrder[i + 1];
    if (bail && sid === bail) { state.flags.add('EARLY_EXIT'); break; }
    const letter = st.renderFor(state);
    const key = (plan[i] || 'S') === 'R' ? 'resist' : 'succumb';
    const th = manifest.scenes[sid].branches[letter].thresholds[key];
    st.commitChoice(state, key === 'succumb' ? 1 : -1);
    if (th.setFlag) state.flags.add(th.setFlag);
  }
  return st.resolveEnding(state);
}

const pathId = (p) => `${p.plan}-${p.seed}${p.bail ? `-bail${p.bail}` : ''}`;

async function playPath(browser, server, p, opts, cards) {
  const id = pathId(p);
  const dir = path.join(OUT, id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const logFile = path.join(dir, 'autopilot.log'); // written as it goes, so a long run can be watched
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: opts.width, height: opts.height } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const text = m.text();
    if (text.startsWith('[autopilot]')) fs.appendFileSync(logFile, `${new Date().toISOString().slice(11, 19)} ${text}\n`);
    if (m.type() === 'error') errors.push(`console.error: ${text}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().replace(server.url, '')}`); });

  const q = `autopilot=${p.plan}&seed=${p.seed}&speed=${opts.speed}${p.bail ? `&bail=${p.bail}` : ''}`;
  const t0 = Date.now();
  const result = { id, expect: p.expect, got: null, title: null, scenes: [], seconds: 0, ok: false, why: '', notes: [] };
  // A software renderer can take many seconds to produce the frame a
  // screenshot waits for; a missed screenshot is noted, never a failure.
  const snap = async (name) => {
    try { await page.screenshot({ path: path.join(dir, name), timeout: 90000 }); } catch (e) { result.notes.push(`screenshot ${name} skipped (${e.message.split('\n')[0]})`); }
  };
  // The page's state, or null when its main thread is too busy to answer in time.
  const probe = () => Promise.race([
    page.evaluate(() => {
      const G = window.__NINETY_NINE__;
      const card = document.querySelector('#ending-card');
      const title = card && !card.hidden ? (card.querySelector('.ending-title') || {}).textContent : null;
      const boot = document.getElementById('boot-error');
      if (!G) return { boot: boot && !boot.hidden ? boot.textContent : null, title };
      const d = G.director._debug();
      return {
        scene: d.scene, render: d.render, ended: d.ended, ending: d.ending, title,
        sig: [d.scene, d.render, d.armed, d.committing, d.playerEnabled, d.reached.length, d.links.map((l) => `${l.conn}${+l.seal1}${+l.seal2}`).join('|'), d.ending, d.ended, G.stage.world.current() && G.stage.world.current().key].join(','),
        pos: d.position, state: d.state
      };
    }),
    new Promise((r) => setTimeout(() => r(null), 60000))
  ]);
  console.log(`\n== ${id}: ${server.url}/index.html?${q} (expect ${p.expect})`);
  try {
    await page.goto(`${server.url}/index.html?${q}`);
    let last = null;
    let progressAt = Date.now();
    let progressSig = '';
    let progressPos = null;
    let shot = 0;
    while (true) {
      await page.waitForTimeout(1000);
      const s = await probe();
      if (errors.length) throw new Error(errors.slice(0, 5).join(' | '));
      if (Date.now() - t0 > opts.timeout * 1000) throw new Error(`timed out after ${opts.timeout} s in ${last}`);
      if (!s) {
        if (Date.now() - progressAt > opts.stall * 1000) throw new Error(`the page stopped answering for ${opts.stall} s in ${last || 'boot'}`);
        continue;
      }
      if (s.boot) throw new Error(`boot failed: ${s.boot}`);
      if (s.scene && `${s.scene}${s.render}` !== last) {
        last = `${s.scene}${s.render}`;
        result.scenes.push(last);
        shot++;
        console.log(`  ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  ${last}  conformance=${s.state.conformance} dissonance=${s.state.dissonance} friction=${s.state.friction}`);
        await snap(`${String(shot).padStart(2, '0')}-${s.scene}${s.render === 'X' ? '' : s.render}.png`);
      }
      if (s.title) {
        await page.waitForTimeout(1500);
        await snap(`${String(shot + 1).padStart(2, '0')}-card.png`);
        result.title = s.title;
        result.endingId = s.ending; // director._debug() keeps the ending id once the card shows
        break;
      }
      // progress: anything the director reports changing, or a few metres walked
      const moved = s.pos && progressPos ? Math.hypot(s.pos[0] - progressPos[0], s.pos[1] - progressPos[1], s.pos[2] - progressPos[2]) : Infinity;
      if (s.sig !== progressSig || moved > 3) { progressSig = s.sig; progressPos = s.pos; progressAt = Date.now(); }
      if (Date.now() - progressAt > opts.stall * 1000) {
        await snap('stalled.png');
        throw new Error(`no progress for ${opts.stall} s in ${last || 'boot'} (${s.sig})`);
      }
    }
    result.got = Object.keys(CARD_KEY).find((k) => cards[CARD_KEY[k]].title === result.title) || '?';
    const want = cards[CARD_KEY[p.expect]].title;
    if (result.title !== want) throw new Error(`ending card "${result.title}", expected ${p.expect} ("${want}")`);
    if (result.endingId && result.endingId !== p.expect) throw new Error(`the director ended on ${result.endingId}, expected ${p.expect}`);
    if (errors.length) throw new Error(errors.slice(0, 5).join(' | '));
    result.ok = true;
  } catch (e) {
    result.why = e.message.split('\n')[0];
    await snap('failed.png');
  } finally {
    result.seconds = Math.round((Date.now() - t0) / 1000);
    for (const n of result.notes) fs.appendFileSync(logFile, `# ${n}\n`);
    await ctx.close().catch(() => {});
  }
  console.log(`  ${result.ok ? 'PASS' : 'FAIL'}  ${id}: ${result.got || '-'} in ${result.seconds}s${result.why ? ` -- ${result.why}` : ''}${result.notes.length ? ` (${result.notes.length} note(s) in autopilot.log)` : ''}`);
  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let paths;
  if (opts.plans.length) {
    paths = opts.plans.map((plan) => {
      if (!/^[SR]{1,8}$/.test(plan)) throw new Error(`a plan is up to 8 letters S/R, got ${plan}`);
      const seed = opts.seed || 'C';
      const known = DEFAULT_PATHS.find((d) => d.plan === plan && d.seed === seed && (d.bail || '') === (opts.bail || ''));
      return { plan, seed, bail: opts.bail || null, expect: known ? known.expect : null };
    });
  } else {
    paths = DEFAULT_PATHS.map((d) => ({ ...d }));
  }
  for (const p of paths) {
    const resolved = await expectedEnding(p);
    if (p.expect && p.expect !== resolved) throw new Error(`${pathId(p)}: the table says ${p.expect} but state.js resolves ${resolved}`);
    p.expect = resolved;
  }
  const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'text', 'endings.json'), 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });

  const { chromium } = loadPlaywright();
  const server = opts.base ? { url: opts.base, stop() {} } : await startServer(ROOT);
  const browser = await chromium.launch({ headless: !opts.headed, args: CHROMIUM_ARGS });
  const results = [];
  try {
    for (const p of paths) results.push(await playPath(browser, server, p, opts, cards));
  } finally {
    await browser.close().catch(() => {});
    server.stop();
  }
  console.log('\nwalkthrough summary');
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(22)} expect ${r.expect.padEnd(12)} got ${(r.got || '-').padEnd(12)} ${String(r.seconds).padStart(5)}s  ${r.scenes.join(' ')}${r.why ? `\n        ${r.why}` : ''}`);
  console.log(`  screenshots and logs: ${path.relative(process.cwd(), OUT) || OUT}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
