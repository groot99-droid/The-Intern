// Shared by the dev-only Node runners (tools/run_tests.cjs,
// tools/walkthrough.cjs): start tools/dev_server.py on a free port, find
// Playwright, and the Chromium flags that give a headless browser WebGL
// (SwiftShader) and audio without a gesture. Not part of the game.

'use strict';

const { spawn, spawnSync } = require('child_process');
const net = require('net');
const http = require('http');
const path = require('path');

const CHROMIUM_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--autoplay-policy=no-user-gesture-required'
];

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function pythonExe() {
  if (process.env.PYTHON) return process.env.PYTHON;
  for (const exe of ['python3', 'python']) {
    const r = spawnSync(exe, ['--version'], { stdio: 'ignore' });
    if (r.status === 0) return exe;
  }
  throw new Error('no python3/python on PATH (set PYTHON)');
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

// root: the ninety-nine/ folder, which dev_server.py serves.
async function startServer(root) {
  const port = await freePort();
  const proc = spawn(pythonExe(), [path.join(root, 'tools', 'dev_server.py'), String(port)], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) throw new Error(`dev_server.py exited (${proc.exitCode}): ${stderr}`);
    if (await ping(`${url}/index.html`)) {
      return { url, port, stop() { try { proc.kill(); } catch (e) { /* gone */ } } };
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error(`dev_server.py did not answer on ${port}: ${stderr}`);
}

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
  for (const t of tries) {
    try { return require(t); } catch (e) { /* next */ }
  }
  throw new Error('Playwright not found: `npm i -D playwright` somewhere on the require path, or set PLAYWRIGHT=/path/to/playwright');
}

module.exports = { CHROMIUM_ARGS, freePort, startServer, loadPlaywright };
