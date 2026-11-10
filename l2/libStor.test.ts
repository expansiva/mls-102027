/// <mls fileReference="_102027_/l2/libStor.test.ts" enhancement="_blank"/>

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteFile, undoFile, undoFiles } from '/_102027_/l2/libStor.js';
import { COLLAB_DRAFT_DISCARDED, COLLAB_DRAFT_RECOUNT, draftPathIsSaved, draftPublishedCommit, forgetDraftPaths, rememberDraftMain, rememberDraftPaths, withDraftUndoBrowserOnly } from '/_102033_/l2/cbe/studioDraftFiles.js';
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

function retarget(harness: ReturnType<typeof undoHarness>, project: number): void {
  delete harness.files[fileKeyOf(harness.file)];
  harness.file.project = project;
  harness.files[fileKeyOf(harness.file)] = harness.file;
}

function armSite(mlsStub: object, project: number | undefined, draft = 'team-102047'): void {
  (mlsStub as { sites?: { getMode: () => 'studio' } }).sites = { getMode: () => 'studio' };
  rememberCollabMode(project === undefined ? { mode: 'studio', draft } : { mode: 'studio', project, draft });
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
      if (status === 'changed') {
        assert.equal(calls.some((call) => call.name === 'setContent' && call.content === null), true, status);
        assert.equal(calls.some((call) => call.name === 'removePrj'), true, status);
      }
      if (status === 'new') assert.equal(fileKeyOf(file) in files, false);
      if (status === 'renamed') {
        assert.equal(fileKeyOf({ project: 1, level: 1, folder: 'mod', shortName: 'old', extension: '.ts' }) in files, true);
        assert.equal(fileKeyOf(file) in files, false);
        assert.equal(calls.some((call) => call.name === 'dispose'), false);
      }
    }

    const noModel = undoHarness('changed', 'nomodel');
    noModel.mlsStub.editor.models = {};
    await withMls(noModel.mlsStub, () => undoFile(noModel.file));
    assert.equal(noModel.file.status, 'nochange');
    assert.equal(noModel.calls.some((call) => call.name === 'setContent' && call.content === null), true);
    assert.equal(noModel.calls.some((call) => call.name === 'removePrj'), false);
    assert.equal(noModel.calls.some((call) => call.name === 'dispose'), false);

    const github = undoHarness('changed');
    github.mlsStub.stor.others.getDefaultDriver = async () => ({ driverVersion: '4.2.0', getHistoryContent: async () => 'PUBLISHED' });
    armStudio(github.mlsStub, true);
    await withMls(github.mlsStub, () => undoFile(github.file));
    assert.equal(github.calls.some((call) => call.name === 'history'), false);
    assert.equal(github.calls.some((call) => call.name === 'dispose'), true);
    assert.equal(github.file.status, 'nochange');

    const fetches: { paths: string[] }[] = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init: { body: string }) => {
      const body = JSON.parse(init.body) as { action: string; paths: string[]; ref: string; draft: string };
      assert.equal(body.action, 'draftRestorePaths');
      assert.equal(body.ref, 'main');
      assert.equal(body.draft, 'team-1');
      fetches.push({ paths: body.paths });
      return { status: 200, json: async () => ({ statusCode: 200, status: 'restored' }) };
    }) as typeof fetch;
    try {
      const missing = undoHarness('changed');
      armStudio(missing.mlsStub, true);
      await withMls(missing.mlsStub, () => undoFile(missing.file));
      assert.deepEqual(fetches.map((row) => row.paths), [['l1/mod/x.ts']]);
      assert.equal(missing.file.status, 'nochange');
      assert.equal(missing.calls.some((call) => call.name === 'history' || call.name === 'setContents'), false);
      assert.equal(missing.calls.some((call) => call.name === 'dispose'), true);

      fetches.length = 0;
      const refused = undoHarness('changed', 'kept');
      armStudio(refused.mlsStub, true);
      globalThis.fetch = (async () => ({
        status: 400,
        json: async () => ({ statusCode: 400, code: 'NOT_OWNER', msg: 'draft.not_owner' }),
      })) as typeof fetch;
      await withMls(refused.mlsStub, () => undoFile(refused.file));
      assert.equal(refused.file.status, 'changed');
      assert.equal(refused.calls.some((call) => call.name === 'setContent' || call.name === 'dispose'), false);
      assert.equal(screen.some((msg) => msg === 'Could not restore the published version.'), true);
      assert.equal(errors.some((line) => line.includes('draft.not_owner')), true);

      globalThis.fetch = previousFetch;
      globalThis.fetch = (async (_input: unknown, init: { body: string }) => {
        const body = JSON.parse(init.body) as { paths: string[] };
        fetches.push({ paths: body.paths });
        return { status: 200, json: async () => ({ statusCode: 200, status: 'restored' }) };
      }) as typeof fetch;

      for (const status of ['changed', 'new', 'deleted', 'renamed'] as const) {
        fetches.length = 0;
        const shortName = status === 'renamed' ? 'next' : 'x';
        const { file, calls, mlsStub, files } = undoHarness(status, shortName);
        armStudio(mlsStub, true);
        await withMls(mlsStub, () => undoFile(file));
        assert.equal(calls.some((call) => call.name === 'history' || call.name === 'setContents'), false, status);
        assert.equal(fetches.length, 1, status);
        if (status === 'new') {
          assert.deepEqual(fetches[0].paths, ['l1/mod/x.ts']);
          assert.equal(fileKeyOf(file) in files, false);
        } else if (status === 'renamed') {
          assert.deepEqual(fetches[0].paths, ['l1/mod/next.ts', 'l1/mod/old.ts']);
          assert.equal(fileKeyOf(file) in files, false);
          assert.equal(calls.some((call) => call.name === 'setValue'), false);
        } else {
          assert.deepEqual(fetches[0].paths, [`l1/mod/${shortName}.ts`]);
          assert.equal(file.status, 'nochange');
          assert.equal(calls.some((call) => call.name === 'dispose'), true, status);
          assert.equal(fileKeyOf(file) in files, true);
        }
      }
    } finally {
      globalThis.fetch = previousFetch;
    }
  } finally {
    rememberCollabMode({ mode: 'production' });
    console.error = previousError;
    g.collabMessages = previousScreen;
  }
});

void test('undoFile draft undo applies only to the studio site project', async () => {
  const errors: string[] = [];
  const previousError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };
  try {
    rememberDraftMain('mainsha');

    const lib = undoHarness('changed', 'bootstrap');
    retarget(lib, 102033);
    lib.file.inLocalStorage = true;
    armSite(lib.mlsStub, 102047);
    await withMls(lib.mlsStub, () => undoFile(lib.file));
    assert.equal(lib.calls.some((call) => call.name === 'history'), false);
    assert.equal(lib.calls.some((call) => call.name === 'setContents'), false);
    assert.equal(lib.calls.some((call) => call.name === 'setValue'), false);
    assert.equal(lib.file.status, 'nochange');
    assert.equal(lib.file.inLocalStorage, false);
    assert.equal(lib.calls.some((call) => call.name === 'setContent' && call.content === null), true);
    assert.equal(lib.calls.some((call) => call.name === 'dispose'), true);

    const siteFetches: string[][] = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init: { body: string }) => {
      const body = JSON.parse(init.body) as { paths: string[] };
      siteFetches.push(body.paths);
      return { status: 200, json: async () => ({ statusCode: 200, status: 'restored' }) };
    }) as typeof fetch;
    try {
      const site = undoHarness('changed', 'page');
      retarget(site, 102047);
      armSite(site.mlsStub, 102047);
      await withMls(site.mlsStub, () => undoFile(site.file));
      assert.deepEqual(siteFetches, [['l1/mod/page.ts']]);
      assert.equal(site.calls.some((call) => call.name === 'history' || call.name === 'setContents'), false);
      assert.equal(site.file.status, 'nochange');
      assert.equal(site.calls.some((call) => call.name === 'dispose'), true);
    } finally {
      globalThis.fetch = previousFetch;
    }

    const bare = undoHarness('changed', 'bare');
    bare.file.inLocalStorage = true;
    armSite(bare.mlsStub, undefined);
    await withMls(bare.mlsStub, () => undoFile(bare.file));
    assert.equal(bare.calls.some((call) => call.name === 'history'), false);
    assert.equal(bare.file.status, 'nochange');
    assert.equal(bare.file.inLocalStorage, false);
    assert.equal(errors.some((line) => line.includes('[undoFile] studio mode has no project')), true);
  } finally {
    rememberCollabMode({ mode: 'production' });
    console.error = previousError;
  }
});

void test('st67 s2: one draft restore covers saved files, the skipped file, and a folder of files', async () => {
  const fetches: string[][] = [];
  const notices: string[] = [];
  const previousFetch = globalThis.fetch;
  const host = globalThis as { window?: EventTarget };
  const previousWindow = host.window;
  const windowEvents = new EventTarget();
  windowEvents.addEventListener(COLLAB_DRAFT_RECOUNT, () => { notices.push('recount'); });
  windowEvents.addEventListener(COLLAB_DRAFT_DISCARDED, () => { notices.push('discarded'); });
  host.window = windowEvents;
  globalThis.fetch = (async (_input: unknown, init: { body: string }) => {
    const body = JSON.parse(init.body) as { paths: string[] };
    fetches.push(body.paths);
    return { status: 200, json: async () => ({ statusCode: 200, status: 'restored' }) };
  }) as typeof fetch;
  rememberCollabMode({ mode: 'production' });
  try {
    const browserOnly = undoHarness('changed', 'local');
    browserOnly.file.inLocalStorage = true;
    armStudio(browserOnly.mlsStub, true);
    await withMls(browserOnly.mlsStub, () => undoFile(browserOnly.file));
    assert.deepEqual(fetches, []);
    assert.equal(browserOnly.file.status, 'nochange');
    assert.equal(browserOnly.file.inLocalStorage, false);
    assert.deepEqual(notices, ['recount']);

    notices.length = 0;
    const skipped = undoHarness('nochange', 'saved');
    skipped.file.inLocalStorage = false;
    armStudio(skipped.mlsStub, true);
    await withMls(skipped.mlsStub, () => undoFile(skipped.file));
    assert.deepEqual(fetches, [['l1/mod/saved.ts']]);
    assert.equal(skipped.file.status, 'nochange');
    assert.deepEqual(notices, ['recount', 'discarded']);

    fetches.length = 0;
    notices.length = 0;
    const kept = undoHarness('changed', 'kept');
    kept.file.inLocalStorage = true;
    rememberDraftPaths(1, ['l1/mod/kept.ts']);
    armStudio(kept.mlsStub, true);
    await withMls(kept.mlsStub, () => undoFile(kept.file));
    assert.deepEqual(fetches, [['l1/mod/kept.ts']]);
    assert.equal(draftPathIsSaved(1, 'l1/mod/kept.ts'), false);
    assert.equal(kept.file.status, 'nochange');
    assert.equal(kept.file.inLocalStorage, false);

    fetches.length = 0;
    notices.length = 0;
    const batch = ['a', 'b', 'c'].map((name) => {
      const harness = undoHarness('changed', name);
      harness.file.inLocalStorage = false;
      return harness;
    });
    armStudio(batch[0].mlsStub, true);
    const files = batch.map((harness) => harness.file);
    for (const file of files) batch[0].files[fileKeyOf(file)] = file;
    await withMls(batch[0].mlsStub, () => undoFiles(files));
    assert.equal(fetches.length, 1);
    assert.deepEqual(fetches[0], ['l1/mod/a.ts', 'l1/mod/b.ts', 'l1/mod/c.ts']);
    assert.deepEqual(notices, ['recount', 'discarded']);
    assert.equal(files.every((file) => file.status === 'nochange'), true);

    fetches.length = 0;
    notices.length = 0;
    const locals = ['d', 'e', 'f'].map((name) => {
      const harness = undoHarness('changed', name);
      harness.file.inLocalStorage = true;
      return harness;
    });
    armStudio(locals[0].mlsStub, true);
    await withDraftUndoBrowserOnly(() => withMls(locals[0].mlsStub, async () => {
      for (const harness of locals) await undoFile(harness.file);
    }));
    assert.deepEqual(fetches, []);
    assert.deepEqual(notices, []);
    assert.equal(locals.every((harness) => harness.file.status === 'nochange' && harness.file.inLocalStorage === false), true);
  } finally {
    forgetDraftPaths(1, ['l1/mod/kept.ts']);
    host.window = previousWindow;
    globalThis.fetch = previousFetch;
    rememberCollabMode({ mode: 'production' });
  }
});

void test('st67 s2: folder and sync loops send one undoFiles call', () => {
  const tree = readFileSync(path.resolve(HERE, '../../mls-100555/l2/pluginExplore/mlsFileTree.ts'), 'utf8');
  const tree2 = readFileSync(path.resolve(HERE, '../../mls-100555/l2/pluginExplore/mlsFileTree2.ts'), 'utf8');
  const save = readFileSync(path.resolve(HERE, '../../mls-100554/l2/serviceSave.ts'), 'utf8');
  const stor = readFileSync(ENTRY, 'utf8');
  const folder = (src: string) => {
    const start = src.indexOf('async undoAllByFolders');
    const end = src.indexOf('private ', start + 10);
    return src.slice(start, end);
  };
  assert.match(folder(tree), /await undoFiles\(batch\)/);
  assert.doesNotMatch(folder(tree), /await undoFile\(/);
  assert.match(folder(tree2), /await undoFiles\(batch\)/);
  assert.doesNotMatch(folder(tree2), /await undoFile\(/);
  const syncAt = save.indexOf('private async forceSync');
  const sync = save.slice(syncAt, save.indexOf('private STORAGE_KEY', syncAt));
  assert.match(sync, /await undoFiles\(obj\)/);
  assert.doesNotMatch(sync, /await undoFile\(/);
  const allAt = stor.indexOf('export async function undoAllFiles');
  const all = stor.slice(allAt, stor.indexOf('function isNewNameValid', allAt));
  assert.match(all, /await undoFiles\(files\)/);
  assert.doesNotMatch(all, /await undoFile\(/);
});
