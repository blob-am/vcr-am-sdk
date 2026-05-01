#!/usr/bin/env node
//
// Bans `as`-style type assertions across the codebase, with two exceptions:
//   1. `as const` — compile-time literal narrowing, no type lie.
//   2. `as unknown as X` … no, that's still banned.
//
// Why a custom script? Biome 2.4 doesn't ship a built-in rule for this, and
// the GritQL plugin syntax for "match `as $T` but not `as const`" is
// finicky. A 30-line script we control is more honest than a flaky plugin.
//
// Run via `pnpm lint:no-as` (also wired into `pnpm lint`).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ROOTS = ["src", "tests"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

// `<word>` followed by `as`, then a token that isn't `const`. `\b` boundaries
// keep us from matching things like `cast`, `cascade`, or `fastest`.
const AS_CAST = /\bas\s+(?!const\b)[A-Za-z_$][\w$]*/g;

type Finding = {
  file: string;
  line: number;
  column: number;
  snippet: string;
};

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (EXTENSIONS.has(extname(entry))) {
      yield full;
    }
  }
}

function scan(file: string): Finding[] {
  const findings: Finding[] = [];
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, lineIdx) => {
    // Strip line comments and string literals to avoid false positives on
    // doc strings that mention `as Foo`.
    const code = line
      .replace(/\/\/.*$/, "")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``");

    AS_CAST.lastIndex = 0;
    let match: RegExpExecArray | null = AS_CAST.exec(code);
    while (match !== null) {
      findings.push({
        file,
        line: lineIdx + 1,
        column: match.index + 1,
        snippet: line.trim(),
      });
      match = AS_CAST.exec(code);
    }
  });
  return findings;
}

const findings: Finding[] = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    findings.push(...scan(file));
  }
}

if (findings.length > 0) {
  console.error(
    `\n× Found ${findings.length} forbidden \`as\` type assertion(s). Only \`as const\` is allowed.\n`,
  );
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}:${f.column}`);
    console.error(`    ${f.snippet}\n`);
  }
  console.error(
    "Fix: replace `value as T` with a runtime check, type guard, or `satisfies T`.",
  );
  process.exit(1);
}
