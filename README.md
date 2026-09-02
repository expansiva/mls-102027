# 102027 · collab-comum (Shared Frontend Library)

Part of **collab.codes**.

`102027` is **collab-comum**, the shared frontend library of the Studio
environment. It is a `lib` project and a workspace dependency: it holds the
routines that `100554`, `100555` and the other Studio projects import instead of
re-implementing.

## What lives here

Flat under `l2/`, by filename prefix:

| prefix | what it is |
|---|---|
| `lib*` (~47 files) | the bulk of the library: `libModel`, `libCompile`, `libStor`, `libProjectConfig`, `libNewProject`, `libHistoriesRecents`, `libProviders`, `libUnsplash`, … |
| `collab*` (~30) | shared collab components and import helpers |
| `ai*` (~20) | AI agent base and orchestration |
| `enhancement*` (~16) | Lit enhancements (`enhancementLit`, `enhancementAgent`, …) |
| `plugin*` (~15) | plugin base classes the Studio plugins extend |
| `designSystemBase*` | base design system |
| `validate*`, `utils*`, `defsAST` | validation, helpers and `.defs.ts` AST handling |

Unit tests live beside the sources (`*.test.ts`).

## Notes

- Consumed as `_102027_/...` by other projects; not runnable standalone.
