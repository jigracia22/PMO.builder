import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { scanText, scanRepo } from '../scripts/check-sanitized.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'check-sanitized.mjs');

// Forbidden strings are assembled at runtime so this file stays clean under its own scan.
const NAME = 'Mi' + 'Sala';
const rules = (text, rel = 'docs/x.md') => scanText(text, rel).map((f) => f.rule);

test('flags a session UUID but not the zero UUID', () => {
  const uuid = ['3f2b9c1e', '8a4d', '4b7e', '9c2f', '1d5e6a7b8c9d'].join('-');
  assert.deepEqual(rules(`run ${uuid} done`), ['session-uuid']);
  assert.deepEqual(rules('placeholder 00000000-0000-0000-0000-000000000000'), []);
});

test('flags home paths on macOS and Windows', () => {
  assert.deepEqual(rules('see /' + 'Users/someone/repo'), ['home-path']);
  assert.deepEqual(rules('see C:\\' + 'Users\\someone\\repo'), ['home-path']);
  assert.deepEqual(rules('see ${CLAUDE_PROJECT_DIR}/repo and ~/repo'), []);
});

test('flags the source owner/repo and env prefix', () => {
  assert.ok(rules('gh repo view jigracia22/' + NAME.toLowerCase()).includes('source-repo'));
  assert.ok(rules('export ' + NAME.toUpperCase() + '_GATE=off').includes('source-env-prefix'));
  assert.deepEqual(rules('export PMO_GATE=off'), []);
});

test('flags the source name outside the case study only', () => {
  assert.deepEqual(rules(`built for ${NAME}`), ['source-name']);
  assert.deepEqual(rules(`built for ${NAME}`, 'examples/case-study/README.md'), []);
  assert.deepEqual(rules('reservé mi sala de ensayo'), []);
});

test('flags concrete GitHub Project numbers but not placeholders', () => {
  assert.deepEqual(rules('the board is Project #' + '2'), ['project-number']);
  assert.deepEqual(rules('https://github.com/users/x/projects/' + '7'), ['project-number']);
  assert.deepEqual(rules('gh project item-list --project ' + '2'), ['project-number']);
  assert.deepEqual(rules('the board is Project #<n>'), []);
});

test('reports line and column', () => {
  const [f] = scanText(`ok\n  ${NAME} here`, 'a.md');
  assert.equal(f.line, 2);
  assert.equal(f.col, 3);
});

test('scanRepo checks file names, skips .git and binary files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanitized-'));
  try {
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, '.git', 'config'), NAME);
    fs.writeFileSync(path.join(dir, 'blob.bin'), Buffer.from([0, 1, 2, ...Buffer.from(NAME)]));
    fs.writeFileSync(path.join(dir, `${NAME.toLowerCase()}-notes.md`), 'clean body');
    const found = scanRepo(dir);
    assert.equal(found.length, 1);
    assert.equal(found[0].rule, 'source-name (path)');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI exits 1 on findings and 0 on a clean tree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanitized-'));
  try {
    fs.writeFileSync(path.join(dir, 'ok.md'), 'nothing to see');
    assert.equal(spawnSync(process.execPath, [SCRIPT, dir]).status, 0);
    fs.writeFileSync(path.join(dir, 'bad.md'), `made for ${NAME}`);
    const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /bad\.md:1:10 {2}\[source-name\]/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('this repository is clean', () => {
  assert.deepEqual(scanRepo(path.join(path.dirname(SCRIPT), '..')), []);
});
