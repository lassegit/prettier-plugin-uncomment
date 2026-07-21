/**
 * prettier-plugin-uncomment
 *
 * Strips comments from JavaScript / TypeScript / JSX / Flow files, while
 * preserving comments that carry meaning for tooling or that a developer has
 * explicitly flagged to keep.
 *
 * How it works: Prettier reads the top-level `ast.comments` array to attach and
 * print comments. We wrap the built-in parsers and drop every comment from that
 * array except the ones on the keep-list, so the rest are simply never printed.
 * Node locations are left untouched, so the AST stays valid.
 */

import { parsers as babelParsers } from "prettier/plugins/babel";
import { parsers as typescriptParsers } from "prettier/plugins/typescript";
import { parsers as flowParsers } from "prettier/plugins/flow";

/**
 * Comments matching any of these are kept (case-sensitive).
 * Tested against the reconstructed comment text, e.g. `// foo` or `/* foo *␀/`.
 */
const KEEP = [
  // Linter / type-checker / tooling directives
  /eslint-(disable|enable)/,
  /eslint-env/,
  /@ts-(ignore|expect-error|nocheck|check)/,
  /\/\/\/\s*<reference/, // triple-slash directives: /// <reference ... />
  /(prettier|biome|deno-lint|stylelint|oxlint|rome)-ignore/,
  /\b(v8|c8|istanbul|node:coverage)\s+ignore\b/,

  // Build-tool "magic" comments — removing them changes runtime behaviour
  /webpack[A-Z]/, // webpackChunkName, webpackPrefetch, webpackIgnore, ...
  /@vite-ignore/,
  /#\s*source(Mapping)?URL=/, // //# sourceMappingURL=  /  //# sourceURL=

  // Compiler / runtime pragmas
  /@jsx(Runtime|ImportSource|Frag|s)?\b/, // @jsx, @jsxRuntime, @jsxImportSource, @jsxFrag
  /@(no)?flow\b/,
  /@__(PURE|NO_SIDE_EFFECTS)__@?/, // /*#__PURE__*/ style annotations
  /#__(PURE|NO_SIDE_EFFECTS)__/,

  // Legal / banner comments that minifiers and tooling are expected to keep
  /@(license|preserve|copyright|cc_on)\b/,
  /^\/\*!/, // /*! ... */ banner comment
];

/** Comments matching any of these are kept (case-insensitive). */
const KEEP_I = [
  /@hc\b/i,
  /@hn\b/i,
  /@hacker\s*(note|comment)/i,
  /\bTODO\b/i,
  /\bFIXME\b/i,
];

/** Folders whose files are left untouched by default. */
const DEFAULT_IGNORE_PATHS = [
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "coverage",
  "vendor",
];

/** Reconstruct the source text of a comment node (delimiters included). */
function commentText(comment) {
  const isBlock = comment.type === "CommentBlock" || comment.type === "Block";
  return isBlock ? `/*${comment.value}*/` : `//${comment.value}`;
}

/** Decide whether a single comment should be kept. */
function shouldKeep(comment, extra) {
  const text = commentText(comment);
  if (KEEP.some((re) => re.test(text))) return true;
  if (KEEP_I.some((re) => re.test(text))) return true;
  if (extra.length) {
    const lower = text.toLowerCase();
    if (extra.some((needle) => lower.includes(needle))) return true;
  }
  return false;
}

/** Read the (case-insensitive) extra keep-substrings from options. */
function extraKeep(options) {
  const v = options && options.uncommentKeep;
  return Array.isArray(v) ? v.map((s) => String(s).toLowerCase()) : [];
}

/** Skip stripping for files inside ignored folders. */
function isIgnoredFile(options) {
  const filepath = options && options.filepath;
  if (!filepath) return false;
  const configured = options.uncommentIgnorePaths;
  const ignore = Array.isArray(configured) ? configured : DEFAULT_IGNORE_PATHS;
  if (!ignore.length) return false;
  const segments = String(filepath).replace(/\\/g, "/").split("/");
  return ignore.some((entry) => segments.includes(entry));
}

/** Wrap a built-in parser so it filters comments after parsing. */
function withUncomment(parser) {
  return {
    ...parser,
    async parse(text, options) {
      const ast = await parser.parse(text, options);
      if (Array.isArray(ast.comments) && !isIgnoredFile(options)) {
        const extra = extraKeep(options);
        ast.comments = ast.comments.filter((c) => shouldKeep(c, extra));
      }
      return ast;
    },
  };
}

export const parsers = {
  babel: withUncomment(babelParsers.babel),
  "babel-ts": withUncomment(babelParsers["babel-ts"]),
  "babel-flow": withUncomment(babelParsers["babel-flow"]),
  typescript: withUncomment(typescriptParsers.typescript),
  flow: withUncomment(flowParsers.flow),
};

export const options = {
  uncommentIgnorePaths: {
    type: "path",
    array: true,
    category: "Uncomment",
    default: [{ value: DEFAULT_IGNORE_PATHS }],
    description:
      "Path segments whose files are left untouched (comments are kept). " +
      "Setting this replaces the default list.",
  },
  uncommentKeep: {
    type: "string",
    array: true,
    category: "Uncomment",
    default: [{ value: [] }],
    description:
      "Extra case-insensitive substrings; any comment containing one is kept.",
  },
};

// Exposed for testing.
export const _internal = { shouldKeep, isIgnoredFile, commentText, KEEP, KEEP_I };

export default { parsers, options };
