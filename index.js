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

/**
 * JSDoc tags that carry meaning for TypeScript / editor tooling — types,
 * signatures, the hover popover, deprecation strikethrough, and so on. A
 * `/** ... *␀/` block containing at least one of these is a "real" doc comment
 * in the `tagged` JSDoc mode; a `/**`-styled block with no tag is just prose
 * wearing doc-comment delimiters and is stripped.
 */
const JSDOC_TAGS =
  /@(?:param|arg|argument|returns?|type|typedef|template|satisfies|callback|enum|prop|property|augments|extends|implements|this|import|overload|throws|exception|yields?|deprecated|see|example|link|default|readonly|public|private|protected|abstract|override|virtual|namespace|module|interface|constructor|class|function|method|member|global|typeParam|remarks|since)\b/i;

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

/** Is this comment a block comment (`/* ... *␀/`) rather than a line comment? */
function isBlockComment(comment) {
  return comment.type === "CommentBlock" || comment.type === "Block";
}

/** Reconstruct the source text of a comment node (delimiters included). */
function commentText(comment) {
  return isBlockComment(comment) ? `/*${comment.value}*/` : `//${comment.value}`;
}

/**
 * Is this a JSDoc comment (`/** ... *␀/`)?
 *
 * This is the exact rule TypeScript's scanner and editors use to decide a
 * comment is a documentation comment: the block starts with `/**`. Every parser
 * we wrap strips the delimiters, so a `/**` block's `value` starts with `*`,
 * while `/* ... *␀/` starts with a space, `/**␀/` (empty) is `""`, and the
 * `/*! ... *␀/` banner is `"! ..."` — so those are excluded for free.
 */
function isJsdoc(comment) {
  return isBlockComment(comment) && comment.value.startsWith("*");
}

/** Start offset of a comment node, across the different parser shapes. */
function commentStart(comment) {
  if (typeof comment.start === "number") return comment.start;
  if (Array.isArray(comment.range)) return comment.range[0];
  return undefined;
}

/**
 * A shebang / hashbang (`#!/usr/bin/env node`) is not a comment: dropping it
 * breaks executable scripts. Prettier hands it to us inside `ast.comments`, so
 * we have to recognise and preserve it.
 *
 * - babel / babel-ts / flow expose it as an `InterpreterDirective` node.
 * - typescript reports it as an ordinary `Line` comment; the only reliable
 *   signal is that the raw source at its offset (always 0) starts with `#!`.
 */
function isShebang(comment, source) {
  if (comment.type === "InterpreterDirective") return true;
  return (
    commentStart(comment) === 0 &&
    typeof source === "string" &&
    source.startsWith("#!")
  );
}

/** Decide whether a single comment should be kept. */
function shouldKeep(comment, extra, source, jsdoc = "tagged") {
  if (isShebang(comment, source)) return true;
  const text = commentText(comment);
  if (KEEP.some((re) => re.test(text))) return true;
  if (KEEP_I.some((re) => re.test(text))) return true;
  if (jsdoc !== "off" && isJsdoc(comment)) {
    // "all" keeps every doc block; "tagged" keeps only those with a real tag.
    if (jsdoc === "all" || JSDOC_TAGS.test(comment.value)) return true;
  }
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

/** Read the JSDoc handling mode from options ("tagged" | "all" | "off"). */
function jsdocMode(options) {
  const v = options && options.uncommentJsdoc;
  return v === "all" || v === "off" ? v : "tagged";
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
        const jsdoc = jsdocMode(options);
        ast.comments = ast.comments.filter((c) =>
          shouldKeep(c, extra, text, jsdoc),
        );
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
  uncommentJsdoc: {
    type: "choice",
    category: "Uncomment",
    default: "tagged",
    description: "How to treat JSDoc (/** ... */) comments.",
    choices: [
      {
        value: "tagged",
        description:
          "Keep JSDoc blocks that contain a recognized JSDoc tag " +
          "(@param, @returns, @type, @typedef, @template, ...); strip " +
          "prose-only blocks. Keeps the docs that feed TS hover info.",
      },
      {
        value: "all",
        description: "Keep every JSDoc block, tagged or not.",
      },
      {
        value: "off",
        description:
          "Treat JSDoc blocks like any other comment (strip unless another " +
          "rule keeps them).",
      },
    ],
  },
};

// Exposed for testing.
export const _internal = {
  shouldKeep,
  isShebang,
  isIgnoredFile,
  isJsdoc,
  jsdocMode,
  commentText,
  KEEP,
  KEEP_I,
  JSDOC_TAGS,
};

export default { parsers, options };
