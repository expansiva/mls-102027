/// <mls fileReference="_102027_/l2/libStor.test.ts" enhancement="_blank"/>

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(HERE, 'libStor.ts');

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function maskDynamicImports(src: string): string {
  return src.replace(/\bimport\s*\(\s*(['"`])[\s\S]*?\1\s*\)/g, 'DYNAMIC_IMPORT()');
}

function staticSpecifiers(src: string): string[] {
  const masked = maskDynamicImports(stripComments(src));
  const out: string[] = [];
  const re = /\b(?:import|export)\s+(type\s+)?(?:[\w*{}\s,]*\sfrom\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked))) {
    if (m[1]) continue;
    out.push(m[2]);
  }
  return out;
}

function resolveIn102027(fromFile: string, spec: string): string | null {
  const abs = spec.match(/^\/_102027_\/l2\/(.+)\.js$/);
  if (abs) {
    const ts = path.join(HERE, abs[1] + '.ts');
    return existsSync(ts) ? ts : null;
  }
  if (spec.startsWith('.')) {
    const ts = path.resolve(path.dirname(fromFile), spec.replace(/\.js$/, '.ts'));
    return ts.startsWith(HERE + path.sep) && existsSync(ts) ? ts : null;
  }
  return null;
}

function collectStaticGraph(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const spec of staticSpecifiers(src)) {
      const next = resolveIn102027(file, spec);
      if (next) queue.push(next);
    }
  }
  return [...seen];
}

function offences(file: string, src: string): string[] {
  const masked = maskDynamicImports(stripComments(src));
  const rel = path.relative(HERE, file);
  const out: string[] = [];
  masked.split('\n').forEach((line, i) => {
    if (/\bmonaco\b/.test(line)) out.push(`${rel}:${i + 1} monaco`);
    if (/libModel/.test(line)) out.push(`${rel}:${i + 1} libModel`);
  });
  return out;
}

void test('libStor static graph does not reference monaco or libModel outside import()', () => {
  const graph = collectStaticGraph(ENTRY);
  assert.ok(graph.includes(ENTRY), 'libStor.ts must be the graph entry');
  const found: string[] = [];
  for (const file of graph) found.push(...offences(file, readFileSync(file, 'utf8')));
  assert.deepEqual(found, [], `forbidden static monaco/libModel:\n${found.join('\n')}`);
});
