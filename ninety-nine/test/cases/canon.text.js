// Doc 4 §11.2, adapted to run in-browser (fetch + regex instead of grep --
// no Node/CI on this machine). C4: "The company never says 'you'... The
// word 'you' appears exactly once in the entire game: on the final card of
// the ending." Rule breaks a second time, once, for the S4-C manager line
// (Doc 1 §5 S4: "the manager is the only character permitted to use second
// person, and only here, and only once").

import { runCase, assert, assertEqual } from '../harness.js';

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to load ${path} (${res.status})`);
  return res.json();
}

function findYou(obj, path, hits) {
  if (typeof obj === 'string') {
    // Case-sensitive whole-word match for "you"/"You" etc. -- not "your"/"Bayou".
    const matches = obj.match(/\byou\b/gi) || [];
    for (const m of matches) hits.push({ path, text: obj, match: m });
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => findYou(v, `${path}[${i}]`, hits));
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue; // skip _comment/_note/_ghostNote authoring metadata
      findYou(v, `${path}.${k}`, hits);
    }
  }
}

export async function run() {
  await runCase('C4: "you" appears nowhere in system.json/form.json/manifest.json (company copy)', async () => {
    const [system, form, manifest] = await Promise.all([
      loadJSON('../../text/system.json'),
      loadJSON('../../text/form.json'),
      loadJSON('../../text/manifest.json')
    ]);
    const hits = [];
    findYou(system, 'system', hits);
    findYou(form, 'form', hits);
    findYou(manifest, 'manifest', hits);
    // The one permitted crack: the S4-C manager line in system.json.
    const permitted = hits.filter((h) => h.path === 'system.manager.line');
    const violations = hits.filter((h) => h.path !== 'system.manager.line');
    assertEqual(permitted.length, 1, 'expected exactly the one permitted manager.line occurrence');
    assert(violations.length === 0, `unexpected "you" in company copy: ${violations.map((h) => `${h.path}: "${h.text}"`).join(' | ')}`);
  });

  await runCase('C4: ending cards contain exactly one "you" each, in the signoff only', async () => {
    const endings = await loadJSON('../../text/endings.json');
    for (const [key, card] of Object.entries(endings)) {
      if (key.startsWith('_')) continue;
      const hits = [];
      findYou(card, key, hits);
      assertEqual(hits.length, 1, `${key}: expected exactly 1 "you", found ${hits.length}`);
      assert(hits[0].path.endsWith('.signoff'), `${key}: "you" must be in signoff, found in ${hits[0].path}`);
    }
  });

  await runCase('C4: no "you" in any label standing in the building (thresholds, beat zones, S0 start/report, endings) or anywhere else in scenes.json / endings.json', async () => {
    const [scenes, endings] = await Promise.all([loadJSON('../../data/scenes.json'), loadJSON('../../data/endings.json')]);
    const labels = [];
    for (const [sid, scene] of Object.entries(scenes.scenes)) {
      for (const [letter, b] of Object.entries(scene.branches)) {
        for (const [key, th] of Object.entries(b.thresholds || {})) labels.push([`${sid}.${letter}.${key}`, th.label]);
        // a beat zone may be silent (no label: the S4 H corridor bands, the run's breathing)
        for (const bz of b.beatZones || []) if (bz.label !== undefined && bz.label !== null) labels.push([`${sid}.${letter}.beatZone.${bz.zone}`, bz.label]);
        if (b.start) labels.push([`${sid}.${letter}.start`, b.start.label]);
        if (b.report) labels.push([`${sid}.${letter}.report`, b.report.label]);
        for (const c of b.captions || []) if (c.text) labels.push([`${sid}.${letter}.caption`, c.text]);
      }
    }
    for (const [id, e] of Object.entries(endings)) if (!id.startsWith('_') && e.label) labels.push([`ending.${id}`, e.label]);
    assert(labels.length >= 35, `expected every threshold to carry a label, found ${labels.length}`);
    for (const [where, text] of labels) {
      assert(typeof text === 'string' && text.trim().length > 0, `${where}: empty label`);
      assert(!/\byou\b/i.test(text), `${where}: "${text}" says "you"`);
    }
    // and nothing else in either file (authoring notes, `_` keys, excepted)
    const hits = [];
    findYou(scenes, 'scenes', hits);
    findYou(endings, 'endings', hits);
    assert(hits.length === 0, `"you" in ${hits.map((h) => `${h.path}: "${h.text}"`).join(' | ')}`);
  });

  await runCase('C4: the walkable build\'s system.json keys (zone labels, screens, the box, the hundredth) exist and never say "you"', async () => {
    const system = await loadJSON('../../text/system.json');
    const keys = ['zone.apply', 'zone.report', 'zone.package', 'call.hundred', 'box.contents', 'posting.title', 'posting.employer', 'posting.body', 'harlowe.session', 'harlowe.draft', 'requisition.title', 'requisition.harlowe', 'portal.confirm', 'portal.accept', 'elevator.refuse', 'door.violation', 'scan.prompt'];
    for (const k of keys) {
      assert(typeof system[k] === 'string' && system[k].length > 0, `system.json: missing ${k}`);
      assert(!/\byou\b/i.test(system[k]), `system.json ${k}: "${system[k]}" says "you"`);
    }
  });

  await runCase('S0 application: exactly 3 fields, each a WILLING / NOT WILLING pair', async () => {
    // Replaces the old "10 fields and no name field" assertion. The no-name
    // rule was there so S2-H's "Shaun." could be a name the company was
    // never given; the form now asks for it outright and lets the candidate
    // refuse, so the reveal answers the form either way (form.json's
    // _nameNote). Deliberate reversal, not drift -- if this assertion is
    // failing, check that the reversal was intended before relaxing it.
    const form = await loadJSON('../../text/form.json');
    assertEqual(form.fields.length, 3, 'expected exactly 3 fields');
    for (const field of form.fields) {
      assert(typeof field.willing === 'string' && field.willing.length > 0, `field ${field.id}: missing willing tile`);
      assert(typeof field.notWilling === 'string' && field.notWilling.length > 0, `field ${field.id}: missing notWilling tile`);
      assert(field.willing !== field.notWilling, `field ${field.id}: both tiles read the same`);
    }
    // Field 1 is the name, and its two tiles are the whole hinge: hand over
    // SHAUN, or pre-empt the building with 99.
    assertEqual(form.fields[0].willing, 'SHAUN', 'field 1 willing tile');
    assertEqual(form.fields[0].notWilling, '99', 'field 1 notWilling tile');
  });
}
