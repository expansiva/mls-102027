/// <mls fileReference="_102027_/l2/libStor.test.ts" enhancement="_blank"/>

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteFile } from '/_102027_/l2/libStor.js';

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
    if (/libCommom/.test(line)) out.push(`${rel}:${i + 1} libCommom`);
  });
  return out;
}

void test('libStor static graph does not reference monaco, libModel or libCommom outside import()', () => {
  const graph = collectStaticGraph(ENTRY);
  assert.ok(graph.includes(ENTRY), 'libStor.ts must be the graph entry');
  const found: string[] = [];
  for (const file of graph) found.push(...offences(file, readFileSync(file, 'utf8')));
  assert.deepEqual(found, [], `forbidden static monaco/libModel/libCommom:\n${found.join('\n')}`);
});

void test('libStor static specifiers do not include libCommom or libModel', () => {
  const specs = staticSpecifiers(readFileSync(ENTRY, 'utf8'));
  assert.equal(specs.some(spec => spec.includes('libCommom')), false, specs.join('\n'));
  assert.equal(specs.some(spec => spec.includes('libModel')), false, specs.join('\n'));
});

async function withMls<T>(mls: unknown, fn: () => Promise<T> | T): Promise<T> {
  const g = globalThis as { mls?: unknown };
  const prev = g.mls;
  g.mls = mls;
  try { return await fn(); } finally { g.mls = prev; }
}

function stubFile(status: string, extra: Record<string, unknown> = {}) {
  return {
    project: 1, level: 1, folder: 'mod', shortName: 'x', extension: '.ts',
    status,
    getValueInfo: async () => ({ content: 'src', contentType: 'string' as const }),
    getContent: async () => 'src',
    ...extra,
  } as mls.stor.IFileInfo;
}

function editorStub() {
  return { models: {}, getKeyModel: () => 'k' };
}

void test('deleteFile marks deleted after setContent even when the host write promotes to changed', async () => {
  const file = stubFile('changed');
  await withMls({
    editor: editorStub(),
    common: { crc: { crc32: () => 0 } },
    stor: {
      files: {},
      getKeyToFiles: () => 'k',
      localStor: {
        setContent: async (f: { status?: string; updatedAt?: string }) => {
          if (f.status !== 'renamed') f.status = 'changed';
          f.updatedAt = new Date().toISOString();
        },
      },
    },
  }, () => deleteFile(file));
  assert.equal(file.status, 'deleted');
});

void test('deleteFile marks deleted when setContent does not touch status (browser)', async () => {
  const file = stubFile('changed');
  await withMls({
    editor: editorStub(),
    common: { crc: { crc32: () => 0 } },
    stor: {
      files: {},
      getKeyToFiles: () => 'k',
      localStor: { setContent: async () => undefined },
    },
  }, () => deleteFile(file));
  assert.equal(file.status, 'deleted');
});

void test('deleteFile with status new hard-deletes via setContent null and does not stay in the index', async () => {
  const file = stubFile('new');
  delete (file as { getValueInfo?: unknown }).getValueInfo;
  const files: Record<string, unknown> = { k: file };
  let hard = false;
  await withMls({
    editor: editorStub(),
    stor: {
      files,
      getKeyToFiles: () => 'k',
      localStor: {
        setContent: async (_f: unknown, value: { content?: unknown }) => {
          if (value.content === null) hard = true;
        },
      },
    },
  }, () => deleteFile(file));
  assert.equal(hard, true);
  assert.equal('k' in files, false);
});

void test('deleteFile assigns deleted after the trash setContent, not before', () => {
  const src = readFileSync(ENTRY, 'utf8');
  const start = src.indexOf('export async function deleteFile');
  const end = src.indexOf('export async function deleteAllFiles');
  const body = src.slice(start, end);
  const setContentAt = body.lastIndexOf('setContent');
  const deletedAt = body.lastIndexOf("status = 'deleted'");
  assert.ok(setContentAt > 0, 'deleteFile must call setContent for the trash write');
  assert.ok(deletedAt > setContentAt, 'status=deleted must be assigned after setContent so a host write cannot promote it back to changed');
});
