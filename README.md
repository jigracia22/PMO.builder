# PMO — a measured multi-agent delivery loop for Claude Code

PMO is a [Claude Code](https://code.claude.com) plugin. It turns an issue into a reviewed pull request through a small team of specialized agents (architect, developer, auditor, QA lead and testers, clerk, tracker guardian), with the main session as the only orchestrator.

- **Complexity routing.** Each change gets a tier (`trivial`, `standard`, `critical`). Critical paths are detected from file paths, not judged by the model, and run the full loop.
- **Enforcement in hooks, not prompts.** Protected files, critical-path grants with a TTL, output-contract validation and git guardrails.
- **A graded audit.** The auditor scores the change; the score and the fix loop have explicit limits.
- **Tracker-agnostic.** The core talks to your issue tracker through the `pmo-tracker` JSON protocol. Adapters are separate plugins: `local` (markdown files, no network) and GitHub ship first; Linear, Jira, ClickUp, Notion and GitLab are open to the community.
- **Measured.** Every run records cost, tokens and audit score, so changes to the loop come with numbers.

It was extracted from a harness used in production on a real product and refined over several versions (v8 → v10.2). The 1.0.0 release corresponds to that internal v10.2.

## Status: pre-release

Nothing is installable yet. This repository currently contains the skeleton, the marketplace manifest and the CI. The loop itself lands in phases:

| Phase | What | Status |
|---|---|---|
| F0 | Sanitization check in CI and the porting checklist (`docs/porting-notes.md`) | in progress |
| F1 | Plugin skeleton, marketplace manifest, CI | in progress |
| F2 | Project config (`.pmo/config.json`) and the enforcement layer (hooks, grants, contract validation) | planned |
| F3 | Stack-neutral agents and skills in English | planned |
| F4 | `pmo-tracker` protocol, `local` and `github` adapters, conformance suite, `pmo-host` | planned |
| F5 | Onboarding: `/pmo:init` and `/pmo:doctor` | planned |
| F6 | Public measurement: `pmo-metrics`, a public golden set, aggregate benchmarks | planned |
| F7 | Dogfooding on the source project | planned |
| F8 | v1.0.0 release and community docs | planned |

## Layout

```
.claude-plugin/marketplace.json   this repo is its own marketplace
plugins/pmo/                      core plugin
plugins/pmo-tracker-github/       GitHub adapter (depends on pmo)
adapters/TEMPLATE/                skeleton for a new tracker adapter
docs/  examples/  benchmarks/  tests/
scripts/check-sanitized.mjs       CI guard against private identifiers
```

## Install (once released)

```bash
claude plugin marketplace add jigracia22/PMO_building_agents_team
claude plugin install pmo@pmo-building-agents-team
```

Third-party marketplaces don't auto-update: run `claude plugin marketplace update` and then `claude plugin update pmo` to get new versions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
