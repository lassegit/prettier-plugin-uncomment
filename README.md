# prettier-plugin-uncomment

A Prettier plugin that **strips comments** from JavaScript, TypeScript, JSX and
Flow files — every `//` and `/* … */` — **except** comments that mean something
to tooling, **JSDoc** that documents your code, or comments a developer has
explicitly flagged to keep.

## Install

```sh
npm install --save-dev prettier prettier-plugin-uncomment
```

## Usage

### On-demand, without installing (recommended)

Stripping comments is destructive, so you usually want to run it deliberately —
not on every format. Use Prettier's `--plugin` flag, which applies the plugin
**only for that one command** and never persists to your config. `npx` fetches
Prettier and the plugin transiently (nothing is added to `package.json`):

```sh
npx --package prettier --package prettier-plugin-uncomment -- \
  prettier --plugin prettier-plugin-uncomment \
  --write "src/**/*.{js,jsx,ts,tsx}"
```

If Prettier and the plugin are already installed in the project, the same run is
just:

```sh
prettier --plugin=prettier-plugin-uncomment --write "src/**/*.{js,jsx,ts,tsx}"
```

Your existing Prettier config (print width, semicolons, …) is still read and
applied — `--plugin` only adds this plugin on top for that run.

If you run it often, wrap it in a `package.json` script. This lives in
`scripts` (not in your Prettier config), so it never triggers on a normal
format — only when you invoke it:

```json
{
  "scripts": {
    "uncomment": "prettier --plugin=prettier-plugin-uncomment --write"
  }
}
```

Pass the files to strip when you run it: `npm run uncomment -- "src/**/*.ts"`.

### Always-on, via config

If you really do want comments stripped on every format, add it to your Prettier
config instead:

```json
{
  "plugins": ["prettier-plugin-uncomment"]
}
```

Then run Prettier as usual (`npx prettier --write .`). As with any Prettier run,
list the folders you never want touched in `.prettierignore`; see also
[`uncommentIgnorePaths`](#options) below.

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

**JSDoc that documents your code** (the docs that feed TS/editor hover info)

- `/** … */` blocks containing a recognized JSDoc tag — `@param`, `@returns`,
  `@type`, `@typedef`, `@template`, `@satisfies`, `@callback`, `@enum`,
  `@deprecated`, `@see`, `@example`, and the like.
- Detection uses the same `/**`-prefix rule TypeScript and editors use to
  identify a doc comment — no substring guessing. Prose-only `/** … */` blocks
  (doc-comment delimiters with no tag) are still stripped by default; tune this
  with [`uncommentJsdoc`](#options).

**Developer-flagged comments** (case-insensitive)

- `@hc`, `@hn`, `@Hacker Note`, `@Hacker Comment`
- `TODO`, `FIXME`

## Options

| Option                 | Type       | Default                                                                                   | Description                                                                                     |
| ---------------------- | ---------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `uncommentIgnorePaths` | `string[]` | `node_modules`, `dist`, `build`, `out`, `.next`, `.nuxt`, `.svelte-kit`, `coverage`, `vendor` | Path **segments** whose files are left untouched. Setting this **replaces** the default list.   |
| `uncommentKeep`        | `string[]` | `[]`                                                                                      | Extra case-insensitive substrings; any comment containing one is kept (extends the keep-list).  |
| `uncommentJsdoc`       | `"tagged" \| "all" \| "off"` | `"tagged"`                                                              | How to treat `/** … */` blocks. `tagged`: keep only blocks with a recognized JSDoc tag. `all`: keep every doc block. `off`: strip them unless another rule keeps them. |

```json
{
  "plugins": ["prettier-plugin-uncomment"],
  "uncommentIgnorePaths": ["node_modules", "dist", "generated"],
  "uncommentKeep": ["@keep", "IMPORTANT"],
  "uncommentJsdoc": "tagged"
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
