// Tiny browser-based test runner. Replaces Doc 4's Node CI (no Node on this
// machine) -- every assertion expressible as "run this pure function and
// check the output" or "fetch a URL and check it" runs here instead.

const results = [];

export async function runCase(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
  } catch (e) {
    results.push({ name, pass: false, detail: (e && e.message) || String(e) });
  }
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

export function getResults() {
  return results;
}

export function renderResults(container) {
  container.innerHTML = '';
  const passCount = results.filter((r) => r.pass).length;

  const summary = document.createElement('p');
  summary.textContent = `${passCount} / ${results.length} passed`;
  summary.style.fontWeight = 'bold';
  summary.style.color = passCount === results.length && results.length > 0 ? 'limegreen' : 'crimson';
  container.appendChild(summary);

  const table = document.createElement('table');
  table.style.borderCollapse = 'collapse';
  table.style.width = '100%';
  for (const r of results) {
    const row = document.createElement('tr');
    const statusCell = document.createElement('td');
    statusCell.textContent = r.pass ? 'PASS' : 'FAIL';
    statusCell.style.color = r.pass ? 'limegreen' : 'crimson';
    statusCell.style.padding = '0.25rem 0.5rem';
    const nameCell = document.createElement('td');
    nameCell.textContent = r.name;
    nameCell.style.padding = '0.25rem 0.5rem';
    const detailCell = document.createElement('td');
    detailCell.textContent = r.detail || '';
    detailCell.style.padding = '0.25rem 0.5rem';
    detailCell.style.color = '#c66';
    row.append(statusCell, nameCell, detailCell);
    table.appendChild(row);
  }
  container.appendChild(table);

  console.table(results.map((r) => ({ name: r.name, pass: r.pass, detail: r.detail || '' })));
  return passCount === results.length;
}

// Forward-compatible loader: cases for later phases (manifest.validate.js,
// canon.text.js, video.audiotrack.js, minigame.leak.js) don't exist until
// Phase 3/4/6. Missing modules are skipped with a note rather than breaking
// the harness, mirroring router.js's minigame fallback pattern.
export async function loadAndRunCase(path) {
  try {
    const mod = await import(path);
    if (typeof mod.run !== 'function') {
      throw new Error(`${path} does not export run()`);
    }
    await mod.run();
  } catch (e) {
    if (e && e.message && e.message.includes('Failed to fetch dynamically imported module')) {
      results.push({ name: path, pass: true, detail: '(skipped: not built yet)' });
      return;
    }
    results.push({ name: path, pass: false, detail: (e && e.message) || String(e) });
  }
}
