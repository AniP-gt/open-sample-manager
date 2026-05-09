# DOCS WORKFLOW

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f

## OVERVIEW
Design notes, implementation task files, and review artifacts. Review outputs follow repeatable issue/date-based directories rather than ad-hoc prose dumps.

## STRUCTURE
```text
docs/
|- design_docs_updated.md       # broad product/design notes
|- feature_comparison.md        # feature matrix notes
|- tasks/<issue>/task.md        # implementation task handoffs
|- issues/<issue>/reviews/iterN # per-iteration reviewer outputs
`- reviews/<issue>/             # cycle-level integrated review reports
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Implementation task | `tasks/<issue>/task.md` | Work package passed to implementation agents |
| Iteration review | `issues/<issue>/reviews/iterN/` | `claude_alignment`, quality, robustness, security, optional `copilot_all`, `synthesis` |
| Integrated review | `reviews/<issue>/cycle*_review_*.md` | Outer-loop review summaries |
| Design context | `design_docs_updated.md` | Broad Japanese/English design and safety notes |
| Mock UI | `moc/open-sample-manager.jsx` | Design/mock artifact, not app source |

## CONVENTIONS
- Issue directory names include date plus feature scope, for example `20260430-hard-features`.
- Iteration review folders use `iter1`, `iter2`, etc.; keep reviewer files named by perspective.
- `synthesis.md` summarizes iteration decisions; do not bury blocking findings only in individual reviewer files.
- Task files live under `docs/tasks`, while review evidence lives under `docs/issues` and integrated reports under `docs/reviews`.

## ANTI-PATTERNS
- Do not place generated review reports in source directories.
- Do not create per-iteration AGENTS.md files; this parent covers the pattern.
- Do not mix implementation tasks and review results in the same folder.

## NOTES
- No CI publishes these docs; they are local repository artifacts for planning and review traceability.
