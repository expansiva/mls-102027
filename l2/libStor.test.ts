/// <mls fileReference="_102027_/l2/libStor.test.ts" enhancement="_blank"/>

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteFile, undoFile } from '/_102027_/l2/libStor.js';
import { draftPublishedCommit, rememberDraftMain } from '/_102033_/l2/cbe/studioDraftFiles.js';
import { rememberCollabMode } from '/_102033_/l2/cbe/studioDraft.js';

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

void test('deleteFile uses localStor.deleteFile when the host exposes the capability', async () => {
  const file = stubFile('changed');
  let unlinked = 0;
  let trash = 0;
  await withMls({
    editor: editorStub(),
    common: { crc: { crc32: () => 0 } },
    stor: {
      files: {},
      getKeyToFiles: () => 'k',
      localStor: {
        deleteFile: async () => { unlinked += 1; },
        setContent: async () => { trash += 1; },
      },
    },
  }, () => deleteFile(file));
  assert.equal(unlinked, 1);
  assert.equal(trash, 0);
  assert.equal(file.status, 'changed');
});

void test('deleteFile without the capability keeps the Studio trash path', async () => {
  const file = stubFile('changed');
  let trash = 0;
  await withMls({
    editor: editorStub(),
    common: { crc: { crc32: () => 0 } },
    stor: {
      files: {},
      getKeyToFiles: () => 'k',
      localStor: {
        setContent: async () => { trash += 1; },
      },
    },
  }, () => deleteFile(file));
  assert.equal(trash, 1);
  assert.equal(file.status, 'deleted');
});

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

interface UndoCall {
  name: string;
  status?: string;
  content?: unknown;
  ref?: string;
  shortName?: string;
}

function fileKeyOf(file: { project: number; level: number; folder: string; shortName: string; extension: string }): string {
  return [file.project, file.level, file.folder, file.shortName, file.extension].join('|');
}

function undoHarness(status: string, shortName = 'x', history: (ref: string) => Promise<string | null> = async () => 'PUBLISHED') {
  const file = stubFile(status, { shortName });
  const calls: UndoCall[] = [];
  const model = {
    setValue: (value: string) => { calls.push({ name: 'setValue', content: value }); },
    dispose: () => { calls.push({ name: 'dispose' }); },
  };
  const files: Record<string, mls.stor.IFileInfo> = {};
  files[fileKeyOf(file)] = file;
  const mlsStub = {
    editor: {
      models: { [shortName]: { ts: { model, originalCRC: 'old' } } } as Record<string, { ts?: { model: { setValue: (value: string) => void; dispose: () => void }; originalCRC?: string } }>,
      getKeyModel: (_project: number, name: string) => name,
    },
    common: { crc: { crc32: (src: string) => src.length } },
    stor: {
      files,
      getKeyToFiles: (project: number, level: number, name: string, folder: string, extension: string) =>
        [project, level, folder, name, extension].join('|'),
      localStor: {
        setContent: async (target: { status?: string }, value: { content?: unknown }) => {
          calls.push({ name: 'setContent', status: target.status, content: value.content });
        },
      },
      localDB: {
        getContentInfoOrNull: async () => ({
          content: 'local',
          contentType: 'string' as const,
          originalProject: 1,
          originalShortName: 'old',
          originalFolder: 'mod',
        }),
        removePrjInfo: async () => { calls.push({ name: 'removePrj' }); },
      },
      setContents: async (list: { status?: string; shortName?: string }[]) => {
        for (const item of list) calls.push({ name: 'setContents', status: item.status, shortName: item.shortName });
        return list.map(() => ({ project: 1, result: true }));
      },
      addOrUpdateFile: async (params: { project: number; level: number; shortName: string; folder: string; extension: string }) => {
        const created = stubFile('nochange', params);
        files[fileKeyOf(created)] = created;
        calls.push({ name: 'add', shortName: params.shortName });
        return created;
      },
      others: {
        getDefaultDriver: async () => ({
          driverVersion: '1.0.0-vm',
          getHistoryContent: async (info: { shortName: string }, ref: string) => {
            calls.push({ name: 'history', shortName: info.shortName, ref });
            return history(ref);
          },
        }),
      },
    },
  };
  return { file, calls, mlsStub, files };
}

function armStudio(mlsStub: object, on: boolean, draft = 'team-1'): void {
  (mlsStub as { sites?: { getMode: () => 'studio' | 'production' } }).sites = {
    getMode: () => (on ? 'studio' : 'production'),
  };
  rememberCollabMode(on ? { mode: 'studio', project: 1, draft } : { mode: 'production' });
}

void test('undoFile restores the published version for the four draft statuses and keeps the old path outside studio', async () => {
  const screen: string[] = [];
  const errors: string[] = [];
  const g = globalThis as { collabMessages?: { add: (msg: string, type: string) => void } };
  const previousScreen = g.collabMessages;
  const previousError = console.error;
  g.collabMessages = { add: (msg) => { screen.push(msg); } };
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };
  rememberCollabMode({ mode: 'production' });
  try {
    assert.equal(draftPublishedCommit(), undefined);
    assert.doesNotMatch(readFileSync(ENTRY, 'utf8'), /collab-draft/);
    assert.match(readFileSync(ENTRY, 'utf8'), /activeDraft\(/);
    assert.match(readFileSync(ENTRY, 'utf8'), /getMode/);

    for (const status of ['changed', 'new', 'deleted', 'renamed'] as const) {
      const shortName = status === 'renamed' ? 'next' : 'x';
      const { file, calls, mlsStub, files } = undoHarness(status, shortName);
      await withMls(mlsStub, () => undoFile(file));
      assert.equal(calls.some((call) => call.name === 'history' || call.name === 'setContents'), false, status);
      if (status === 'changed' || status === 'deleted') {
        assert.equal(file.status, 'nochange');
        assert.equal(calls.some((call) => call.name === 'dispose'), true, status);
        assert.equal(calls.some((call) => call.name === 'setValue'), false, status);
      }
      if (status === 'new') assert.equal(fileKeyOf(file) in files, false);
      if (status === 'renamed') {
        assert.equal(fileKeyOf({ project: 1, level: 1, folder: 'mod', shortName: 'old', extension: '.ts' }) in files, true);
        assert.equal(fileKeyOf(file) in files, false);
        assert.equal(calls.some((call) => call.name === 'dispose'), false);
      }
    }

    const github = undoHarness('changed');
    github.mlsStub.stor.others.getDefaultDriver = async () => ({ driverVersion: '4.2.0', getHistoryContent: async () => 'PUBLISHED' });
    armStudio(github.mlsStub, true);
    await withMls(github.mlsStub, () => undoFile(github.file));
    assert.equal(github.calls.some((call) => call.name === 'history'), false);
    assert.equal(github.calls.some((call) => call.name === 'dispose'), true);
    assert.equal(github.file.status, 'nochange');

    const missing = undoHarness('changed');
    armStudio(missing.mlsStub, true);
    await withMls(missing.mlsStub, () => undoFile(missing.file));
    assert.equal(missing.file.status, 'changed');
    assert.equal(missing.calls.some((call) => call.name === 'history'), false);
    assert.equal(screen.some((msg) => msg === 'The published commit is unknown, so the file stays as it is.'), true);

    const unread = undoHarness('changed', 'x', async () => null);
    armStudio(unread.mlsStub, true);
    rememberDraftMain('mainsha');
    await withMls(unread.mlsStub, () => undoFile(unread.file));
    assert.equal(unread.file.status, 'changed');
    assert.equal(unread.calls.some((call) => call.name === 'setContents'), false);
    assert.equal(unread.calls.some((call) => call.name === 'dispose'), false);
    assert.equal(screen.some((msg) => msg === 'Could not read the published version.'), true);
    assert.equal(errors.some((line) => line.includes('getHistoryContent returned nothing')), true);

    for (const status of ['changed', 'new', 'deleted', 'renamed'] as const) {
      const shortName = status === 'renamed' ? 'next' : 'x';
      const { file, calls, mlsStub, files } = undoHarness(status, shortName);
      armStudio(mlsStub, true);
      await withMls(mlsStub, () => undoFile(file));
      const history = calls.filter((call) => call.name === 'history');
      const saved = calls.filter((call) => call.name === 'setContents');
      if (status === 'new') {
        assert.deepEqual(history, []);
        assert.deepEqual(saved.map((call) => call.status), ['deleted']);
        assert.equal(fileKeyOf(file) in files, false);
      } else if (status === 'renamed') {
        assert.deepEqual(history.map((call) => `${call.shortName}@${call.ref}`), ['old@mainsha']);
        assert.deepEqual(saved.map((call) => `${call.shortName}:${call.status}`), ['old:changed', 'next:deleted']);
        const original = files[fileKeyOf({ project: 1, level: 1, folder: 'mod', shortName: 'old', extension: '.ts' })];
        assert.equal(original.status, 'nochange');
        assert.equal(fileKeyOf(file) in files, false);
        assert.equal(calls.some((call) => call.name === 'setValue' && call.content === 'PUBLISHED'), true);
        assert.equal(calls.some((call) => call.name === 'dispose'), false);
      } else {
        assert.deepEqual(history.map((call) => `${call.shortName}@${call.ref}`), [`${shortName}@mainsha`]);
        assert.deepEqual(saved.map((call) => call.status), ['changed']);
        assert.equal(file.status, 'nochange');
        assert.equal(calls.some((call) => call.name === 'setValue' && call.content === 'PUBLISHED'), true);
        assert.equal(calls.some((call) => call.name === 'dispose'), false);
        assert.equal(fileKeyOf(file) in files, true);
      }
    }
  } finally {
    rememberCollabMode({ mode: 'production' });
    console.error = previousError;
    g.collabMessages = previousScreen;
  }
});
