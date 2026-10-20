# Porting notes

The PMO harness is being extracted from a private production project (the *source harness*). This file is the checklist to apply **while porting each file** in F2 and F3. Nothing is ported in F0 and F1: these notes only record what has to change.

Paths of the form `source:<path>:<line>` refer to the source harness and were checked on 2026-10-19. When you port a file, tick its items here in the same PR.

## Sanitization rules (every file, every phase)

`node scripts/check-sanitized.mjs` enforces the mechanical part in CI. It fails on:

- session, transcript or run UUIDs;
- absolute paths under a user home directory (macOS and Windows user folders);
- the source owner/repo, the source project name (allowed only under `examples/case-study/`) and its env-var prefix;
- concrete GitHub Project numbers (`Project #<digit>`, `/projects/<digit>`, `--project <digit>`).

The script can't catch the rest. Check it by hand in review:

- [ ] No issue or PR numbers from the source tracker (`#1234`, `ABC-0123`-style keys). Use placeholders.
- [ ] No security or product details: no canary descriptions from the source metrics docs, no PII-leak incident details, no CSP spec. Describe the *class* of check, not the finding.
- [ ] Of the source metrics folder (`source:tasks/metrics/`), port only the README. Benchmarks are re-derived in F6 as aggregates with their n and method.
- [ ] No domain vocabulary in core prompts: no rooms, bookings, roles or owners, and no stack names (Drizzle, BetterAuth, Next.js, yarn, vitest). Stack facts go in `.pmo/project.md`; domain examples go in `examples/`.
- [ ] Never add a private literal to the denylist itself (it is public): write a pattern for the whole class.

## Fixes to apply while porting

### Agents and contracts (F3)

- [ ] **Audit contract is missing `score`.** The Output Contract in `source:.claude/agents/audit-expert.md:45-67` has no `score` field, but the digest rule at `:149` and the grader role both depend on a per-axis score. Add `score` to `schemas/output-contract.schema.json` and to the auditor prompt, and make the contract validator require it.
- [ ] **Release-plan applier is inconsistent.** `source:docs/arnes/agentes-y-comandos.md:19,28` says the guardian applies the approved release plan. The guardian prompt (`source:.claude/agents/project-guardian.md:3,13`) and `/pm` (`source:.claude/commands/pm.md:12,55`) say the main session applies it. Canonical rule: **the architect proposes, the maintainer approves, the main session applies**. The guardian never writes a plan.
- [ ] **Guardian docs predate v10.2.** Rewrite the guardian docs from the v10.2 prompt, not from the old docs. The guardian and `/pm` must call the canonical `pmo-tracker` ops (F4), never `gh` directly.
- [ ] **Stale model names in descriptions.** `source:.claude/commands/architect.md:2,8` and `design.md:2,8` say "Opus 4.7", `qa.md:2,8` says "Opus 4.6", `audit.md:2,8` says "Fable 5" and `debugging.md:2` says "Sonnet 5". The frontmatter models are different. Rule: no model names in descriptions or prose. The model lives only in agent frontmatter and in the `models` config.
- [ ] **`/qa` describes the pre-v10 flow.** `source:.claude/commands/qa.md:8` has the QA lead spawning testers. Since v10 only the main session spawns (flat orchestration): the QA lead returns the groups, and the main session spawns one tester per group.
- [ ] **Agent names get a namespace.** Plugin agents are `pmo:<agent>`. Update every `subagent_type`, every `SubagentStop` matcher and the agent-name sets in `source:.claude/hooks/validate-output-contract.js:91-109` and `source:tasks/scripts/pmo-metrics.mjs:267` through `lib/agents.mjs`. A test walks prompts and hooks looking for unprefixed names.
- [ ] Check whether any agent relies on frontmatter `hooks`, `permissionMode` or `mcpServers`: plugin agents ignore them, so that enforcement has to move to plugin hooks.

### Hooks and scripts (F2)

- [ ] **`protect-files.js` false positive on the grant scripts.** In `source:.claude/hooks/protect-files.js:761-771`, the subagent check tests `GRANT_SCRIPT_ARG_RE` (`:187`) against *every word* of the command, not only the program being executed. So a subagent running `cat pmo-grant.mjs` or `grep … pmo-runtime.sh` is blocked as if it ran the script. Match only the executed program (the head, or the script argument of `node`/`bash`/`sh`). Add a regression test for reads and greps.
- [ ] **`pmo-grant.mjs` imports the draft.** `source:tasks/scripts/pmo-grant.mjs:37` loads `../hooks-draft/runtime-grants.js`, not the installed hook. In the plugin, `bin/pmo-grant` and the hooks import the same module from `lib/`.
- [ ] **One copy per file.** The source keeps a draft and an installed copy of each protected hook (draft + user-run installer). The plugin has a single source under `plugins/pmo/hooks/`; drop the draft/installer flow from the docs.
- [ ] **Critical paths are duplicated in five places.** `source:.claude/commands/pmo.md:72`, `source:.claude/pmo/critical.md:3`, `source:.claude/workflows/pmo-mech.js:23` (`CRITICAL_PATH_RE`), `source:.claude/hooks/protect-files.js` (the Tier-3 table) and `source:.claude/hooks/runtime-grants.js:51` (`PLAIN_FLAGS`). Replace all of them with `criticalPaths {FLAG: [globs]}` from `.pmo/config.json`; flags are whatever keys the config declares.
- [ ] **Kill-switches use the source prefix.** Rename them to `PMO_*`, and add an `enabled` flag per hook in the config (plugin hooks can't be disabled one by one).
- [ ] **Runtime state moves.** `.claude/.runtime/` → `.pmo/runtime/` (gitignored).
- [ ] **Policy hooks must stay inside their project.** The source `branch-from-issue.js` fired on a `git switch -c` aimed at a *different* repository (`git -C <other repo>`), because it never checks which repository the command targets. Hooks that enforce branch, PR or tracker policy act only when the target repository has a `.pmo/config.json`, and read the policy from that config.
- [ ] Hardcoded stack commands in the gates (type-check, lint, test, build) come from `gate {…}` in the config. Hardcoded branch names come from `branches {integration, release}`.

### Not ported

- [ ] `source:.claude/lib/task-state.js` and its test: v8 legacy, unused since v10.
- [ ] Stack-specific hooks (`block-db-push`, `schema-change-reminder`, `confirm-middleware`, `no-console-log`) stay in each project's own `.claude/hooks/`. The case study documents them as examples of project extensions.

### Measurement (F6)

- [ ] `source:tasks/scripts/pmo-metrics.mjs:76` assumes the macOS desktop-app sessions folder. Make the desktop-session mapping optional, and keep prices in a separate file.
