---
name: qtn-development
description: Implement and debug QTN language-server or TextMate grammar changes in this repository, choosing the right source files and regression tests. Use for QTN parsing, completion, hover, definitions, symbols, document lifecycle, and syntax highlighting.
---

# QTN development

Read the repository [AGENTS.md](../../../AGENTS.md) for the source map and invariants. Use [AI_DEVELOPMENT.md](../../../docs/AI_DEVELOPMENT.md) for environment setup and test commands; the harness runs from the repository root.

## Choose the reproduction layer

- For parser or LSP handler behavior, start with the smallest QTN snippet that shows the defect in `packages/language-server/src/__tests__/`. `setupDocument` in `helpers.ts` supplies both the symbol model and the open text document. Completion, hover and definition handlers need both.
- For disk/open-buffer precedence, use controlled promises in `project-file-loader.test.ts`. For watcher notifications, URI decoding or actual LSP messages, extend the stdio integration tests. Their global setup compiles the server, so they do not depend on stale `out/` files.
- For colors/scopes, edit `packages/shared/syntaxes/qtn.tmLanguage.json`, add a `tests/unit/*.test` case in the VSCode package, then run root `npm run sync-grammar`. Use [the scope guide](../../../docs/QTN_GRAMMAR_GUIDE.md). Grammar and parser tests cover different contracts.

When reproducing a bug, run the targeted test before the fix when practical. Confirm that it fails for the expected behavior, then rerun it after the change. Avoid asserting private implementation structure or updating unrelated snapshots.

## QTN-specific edge cases

Select cases relevant to the change rather than expanding every patch into an audit:

- Incomplete declarations are ordinary typing input. Recovery must preserve the following declaration; document `selectionRange` must stay inside `range`.
- QTN types and input/global blocks may span files. Verify all fields and declaration locations survive reversed file indexing order, edit and deletion when touching symbol storage.
- Comments and strings must not accidentally become semantic lookup/completion contexts. Escaped `@` identifiers need the existing navigation helpers.
- A late disk read must not overwrite an open buffer or resurrect deleted content. Scan and watcher exclusions must agree, while explicitly opened cache files remain usable until close.
- Use URI helpers for encoded paths and Windows drive letters. Use temp directories for file tests, not the developer's Unity project.

## Finish the change

Use a targeted test while iterating; use `npm run verify` for the complete local regression suite. `--profile quick` omits protocol and grammar behavior tests. For changed build inputs or client packaging, follow [qtn-package-verification](../qtn-package-verification/SKILL.md).

Report the behavior changed and what actually ran. Read the produced `report.json` before claiming a successful profile. Keep missing native IDE verification explicit. Do not add large Unity performance measurements unless the user requests them.
