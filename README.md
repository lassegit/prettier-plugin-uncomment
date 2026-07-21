# prettier-plugin-uncomment

A Prettier plugin that **strips comments** from JavaScript, TypeScript, JSX and
Flow files — every `//`, `/* … */` and `/** … */` — **except** comments that
mean something to tooling or that a developer has explicitly flagged to keep.

## Install

```sh
npm install --save-dev prettier prettier-plugin-uncomment
```

## Usage

Add it to your Prettier config:

```json
{
  "plugins": ["prettier-plugin-uncomment"]
}
```

Then run Prettier as usual (`npx prettier --write .`). Comments are removed on
format. As with any Prettier run, list the folders you never want touched in
`.prettierignore`; see also [`uncommentIgnorePaths`](#options) below.

## What is kept

Everything else is removed. Comments matching any of the following survive:

**Tooling / linter / type-checker directives**

- `eslint-disable*`, `eslint-enable`, `eslint-env`
- `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `@ts-check`
- `/// <reference … />` (triple-slash directives)
- `prettier-ignore`, `biome-ignore`, `deno-lint-ignore`, `stylelint-ignore`,
  `oxlint-ignore`, `rome-ignore`
- coverage pragmas: `v8 ignore`, `c8 ignore`, `istanbul ignore`, `node:coverage ignore`

**Build-tool "magic" comments** (removing these changes runtime behaviour)

- webpack magic comments (`webpackChunkName`, `webpackPrefetch`, `webpackIgnore`, …)
- `@vite-ignore`
- `//# sourceMappingURL=` / `//# sourceURL=`
- `/*#__PURE__*/`, `/*#__NO_SIDE_EFFECTS__*/`

**Compiler / runtime pragmas & legal banners**

- `@jsx`, `@jsxRuntime`, `@jsxImportSource`, `@jsxFrag`
- `@flow`, `@noflow`
- `@license`, `@preserve`, `@copyright`, and `/*! … */` banner comments

**Developer-flagged comments** (case-insensitive)

- `@hc`, `@hn`, `@Hacker Note`, `@Hacker Comment`
- `TODO`, `FIXME`

## Options

| Option                 | Type       | Default                                                                                   | Description                                                                                     |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `uncommentIgnorePaths` | `string[]` | `node_modules`, `dist`, `build`, `out`, `.next`, `.nuxt`, `.svelte-kit`, `coverage`, `vendor` | Path **segments** whose files are left untouched. Setting this **replaces** the default list.   |
| `uncommentKeep`        | `string[]` | `[]`                                                                                      | Extra case-insensitive substrings; any comment containing one is kept (extends the keep-list).  |

```json
{
  "plugins": ["prettier-plugin-uncomment"],
  "uncommentIgnorePaths": ["node_modules", "dist", "generated"],
  "uncommentKeep": ["@keep", "IMPORTANT"]
}
```

## How it works

Prettier reads the top-level `ast.comments` array to attach and print comments.
The plugin wraps the built-in `babel`, `babel-ts`, `babel-flow`, `typescript`
and `flow` parsers and filters that array after parsing — dropping every comment
except the ones on the keep-list, so the rest are simply never printed. Node
locations are left untouched, so the AST stays valid.

## Scope & caveats

- Covers the JS/TS parser family (`.js`, `.jsx`, `.ts`, `.tsx`, Flow). CSS,
  HTML, Markdown, YAML, GraphQL and other languages are not touched.
- Removing a comment that sat alone on its own line can leave the blank line it
  occupied — the same blank-line behaviour Prettier applies to any gap.

## License

ISC
