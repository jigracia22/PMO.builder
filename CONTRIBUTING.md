# Contributing

The project is pre-release (see the roadmap in the [README](README.md)) and the contribution guide is still a stub. Until F8, the most useful contributions are issues: bugs in what is already here, and requests for tracker adapters.

## Before you open a PR

Run the same checks as CI. They only need Node.js 22+ and the Claude Code CLI; there are no npm dependencies.

```bash
node scripts/check-sanitized.mjs
node --test "tests/**/*.test.mjs"
claude plugin validate . --strict
claude plugin validate plugins/pmo --strict
claude plugin validate plugins/pmo-tracker-github --strict
```

`check-sanitized` rejects session UUIDs, absolute home paths and identifiers of the project this harness was extracted from. If it flags something, replace it with a placeholder. Don't add the literal to an allowlist.

## Changes to the loop

A change to how the loop behaves (routing, gates, prompts, models) should come with a measurement: what it costs and what it does to the audit score, on the public golden set once F6 lands. The full process will be documented in F8.

## Tracker adapters

Each adapter is its own plugin, `pmo-tracker-<name>`, with `"dependencies": ["pmo"]`. It must pass the conformance suite in `tests/conformance/`. The protocol spec and `adapters/TEMPLATE/` land in F4.
