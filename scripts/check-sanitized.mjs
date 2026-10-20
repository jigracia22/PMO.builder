#!/usr/bin/env node
// check-sanitized.mjs — fails if the repo contains anything that identifies the private
// project this harness was extracted from, or the machine and sessions it ran on.
//
// Usage: node scripts/check-sanitized.mjs [root]
// Exit codes: 0 clean · 1 findings · 2 internal error.
//
// The patterns are written so that this file does not match itself (for example `mi[s]ala`
// instead of the literal word), so no file needs to be exempted from the scan.
// Never add a private literal (a project ref, a session id, an email) to this list: the
// list is public. Write a pattern that catches the whole class instead.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directories never scanned. */
const SKIP_DIRS = new Set(['.git', 'node_modules']);

/** Where the source project may be named: the sanitized case study. */
const CASE_STUDY = 'examples/case-study/';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Each rule: id, regex (global), what it catches, and optionally `allowIn(relPath)`
 * and `allowMatch(match)` for the documented exceptions.
 */
export const RULES = [
  {
    id: 'session-uuid',
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    why: 'UUID (session, transcript or run id). Use a placeholder such as <session-id>.',
    allowMatch: (m) => m === ZERO_UUID,
  },
  {
    id: 'home-path',
    re: /(?:\/Users\/|[A-Za-z]:\\Users\\)[^\s/\\'"`]+/g,
    why: 'Absolute path under a user home directory. Use ${CLAUDE_PROJECT_DIR}, ~ or a relative path.',
  },
  {
    id: 'source-repo',
    re: /jigracia22\/mi[s]ala/gi,
    why: 'Owner/repo of the source project.',
  },
  {
    id: 'source-env-prefix',
    re: /\bMI[S]ALA_[A-Z0-9_]*/g,
    why: 'Environment variable with the source project prefix. Kill-switches use PMO_*.',
  },
  {
    id: 'source-name',
    // No whitespace variant: "mi sala" is ordinary Spanish and would flag README.es.md.
    re: /mi-?[s]ala/gi,
    why: 'Name of the source project. Allowed only under examples/case-study/.',
    allowIn: (rel) => rel.startsWith(CASE_STUDY),
  },
  {
    id: 'project-number',
    re: /\bProjects?\s*(?:v2\s*)?#\s*\d+|\/projects\/\d+\b|--project(?:-number)?[\s=]+\d+\b/gi,
    why: 'Concrete GitHub Project number. Read it from .pmo/config.json or use a placeholder (#<n>).',
  },
];

/** True when the buffer looks binary (has a NUL byte in its first 8 KB). */
function isBinary(buf) {
  return buf.subarray(0, 8192).includes(0);
}

/**
 * Scan one file's text. `rel` is the POSIX path relative to the repo root.
 * Returns [{ file, line, col, rule, match, why }].
 */
export function scanText(text, rel) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (const rule of RULES) {
    if (rule.allowIn && rule.allowIn(rel)) continue;
    lines.forEach((lineText, i) => {
      for (const m of lineText.matchAll(rule.re)) {
        if (rule.allowMatch && rule.allowMatch(m[0])) continue;
        findings.push({ file: rel, line: i + 1, col: m.index + 1, rule: rule.id, match: m[0], why: rule.why });
      }
    });
  }
  return findings;
}

/** Walk `root` (skipping SKIP_DIRS and binary files) and scan every file, file names included. */
export function scanRepo(root) {
  const findings = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      // A file or folder name can leak as much as its contents.
      for (const f of scanText(rel, rel)) findings.push({ ...f, line: 0, col: 0, rule: `${f.rule} (path)` });
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) {
        const buf = fs.readFileSync(abs);
        if (!isBinary(buf)) findings.push(...scanText(buf.toString('utf8'), rel));
      }
    }
  };
  walk(root);
  return findings;
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(process.argv[2] || path.join(here, '..'));
  const findings = scanRepo(root);
  if (findings.length === 0) {
    console.log(`check-sanitized: OK (${RULES.length} rules, root ${path.basename(root)})`);
    return 0;
  }
  for (const f of findings) {
    const where = f.line ? `${f.file}:${f.line}:${f.col}` : f.file;
    console.error(`${where}  [${f.rule}]  ${JSON.stringify(f.match)}  ${f.why}`);
  }
  console.error(`\ncheck-sanitized: ${findings.length} finding(s). Remove them before pushing.`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.error(`check-sanitized: internal error: ${err && err.stack ? err.stack : err}`);
    process.exitCode = 2;
  }
}
