import { test } from "node:test";
import assert from "node:assert/strict";
import prettier from "prettier";
import * as plugin from "./index.js";

const { shouldKeep, isShebang, isIgnoredFile } = plugin._internal;

const line = (value) => ({ type: "CommentLine", value });
const block = (value) => ({ type: "CommentBlock", value });

// --- keep-list ------------------------------------------------------------

const KEPT = [
  line(" eslint-disable-next-line no-console"),
  line(" eslint-enable"),
  block(" eslint-env browser "),
  line(" @ts-ignore"),
  line(" @ts-expect-error"),
  line(" @ts-nocheck"),
  line(" @ts-check"),
  line("/ <reference types=\"node\" />"), // value of `/// <reference ...`
  line(" prettier-ignore"),
  line(" biome-ignore lint"),
  line(" deno-lint-ignore no-explicit-any"),
  block(" v8 ignore next "),
  block(" c8 ignore start "),
  block(" istanbul ignore next "),
  block(' webpackChunkName: "x" '),
  line(" @vite-ignore"),
  line("# sourceMappingURL=x.js.map"),
  block(" @jsx h "),
  block(" @license MIT "),
  block("! banner "),
  block("#__PURE__"),
  line(" TODO: do it"),
  line(" todo lower"),
  line(" FIXME"),
  line(" @hc note"),
  line(" @hn"),
  line(" @Hacker Note here"),
  line(" @hacker comment here"),
];

const REMOVED = [
  line(" a plain comment"),
  block(" a plain block "),
  block("*\n * jsdoc\n "),
  line(" this mentions todos but not the keyword-ish"), // 'todos' -> no \bTODO\b
  line(" note: lowercase note is not kept"),
  line(" description of eslint rules"), // no eslint-disable/enable
];

test("keeps blacklisted / meaningful comments", () => {
  for (const c of KEPT) {
    assert.equal(shouldKeep(c, []), true, `expected KEEP: ${c.value}`);
  }
});

test("removes ordinary comments", () => {
  for (const c of REMOVED) {
    assert.equal(shouldKeep(c, []), false, `expected REMOVE: ${c.value}`);
  }
});

test("uncommentKeep adds case-insensitive substrings", () => {
  assert.equal(shouldKeep(line(" KeepMe please"), []), false);
  assert.equal(shouldKeep(line(" KeepMe please"), ["keepme"]), true);
});

// --- shebang / hashbang ---------------------------------------------------

test("keeps babel/flow InterpreterDirective (shebang) nodes", () => {
  const shebang = { type: "InterpreterDirective", value: "/usr/bin/env node", start: 0 };
  assert.equal(isShebang(shebang), true);
  assert.equal(shouldKeep(shebang, []), true);
});

test("keeps a typescript-style shebang (Line comment at offset 0)", () => {
  // TypeScript reports the shebang as an ordinary line comment; the raw source
  // starting with `#!` is the only signal.
  const shebang = { type: "Line", value: "/usr/bin/env node", range: [0, 19] };
  const source = "#!/usr/bin/env node\nconst a = 1;\n";
  assert.equal(isShebang(shebang, source), true);
  assert.equal(shouldKeep(shebang, [], source), true);
});

test("does not treat a leading line comment as a shebang", () => {
  const cmt = { type: "Line", value: " a comment", range: [0, 12] };
  const source = "// a comment\nconst a = 1;\n";
  assert.equal(isShebang(cmt, source), false);
  assert.equal(shouldKeep(cmt, [], source), false);
});

test("does not treat a `#!` mid-file comment as a shebang", () => {
  const cmt = { type: "Line", value: " #! not a shebang", range: [20, 39] };
  const source = "const a = 1;\n\n// #! not a shebang\n";
  assert.equal(isShebang(cmt, source), false);
});

// --- file ignore ----------------------------------------------------------

test("ignores files in default folders", () => {
  assert.equal(isIgnoredFile({ filepath: "a/node_modules/b.js" }), true);
  assert.equal(isIgnoredFile({ filepath: "project/dist/b.js" }), true);
  assert.equal(isIgnoredFile({ filepath: "src/app.js" }), false);
  assert.equal(isIgnoredFile({}), false);
});

test("substring must be a full path segment", () => {
  // 'distribution' should not match the 'dist' entry
  assert.equal(isIgnoredFile({ filepath: "src/distribution/a.js" }), false);
});

test("uncommentIgnorePaths overrides the defaults", () => {
  assert.equal(
    isIgnoredFile({ filepath: "src/generated/a.js", uncommentIgnorePaths: ["generated"] }),
    true,
  );
  // node_modules no longer ignored once overridden
  assert.equal(
    isIgnoredFile({ filepath: "node_modules/a.js", uncommentIgnorePaths: ["generated"] }),
    false,
  );
});

// --- integration ----------------------------------------------------------

async function fmt(source, options = {}) {
  return prettier.format(source, { parser: "babel", plugins: [plugin], ...options });
}

test("strips plain comments, keeps directives (babel)", async () => {
  const out = await fmt(
    ["// gone", "// @ts-ignore", "const a = 1; // gone too", "// TODO keep"].join("\n") + "\n",
  );
  assert.ok(!out.includes("gone"));
  assert.ok(out.includes("@ts-ignore"));
  assert.ok(out.includes("TODO keep"));
});

test("leaves files in ignored folders untouched", async () => {
  const out = await fmt("// keep me\nconst a = 1;\n", { filepath: "node_modules/x/a.js" });
  assert.ok(out.includes("keep me"));
});

test("preserves the shebang while stripping comments (all parsers)", async () => {
  for (const parser of ["babel", "babel-ts", "typescript", "flow"]) {
    const out = await fmt("#!/usr/bin/env node\nconst a = 1; // gone\n", { parser });
    assert.ok(out.startsWith("#!/usr/bin/env node"), `${parser}: shebang kept`);
    assert.ok(!out.includes("gone"), `${parser}: comment stripped`);
  }
});
