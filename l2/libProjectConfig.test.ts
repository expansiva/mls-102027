/// <mls fileReference="_102027_/l2/libProjectConfig.test.ts" enhancement="_blank"/>

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { projectConfig, updateConfigProject } from '/_102027_/l2/libProjectConfig.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'libProjectConfig.ts');
const PROJECT = 102099;
const KEY = `${PROJECT}_5_project.json`;

function sampleConfig(): mls.l5_common.ProjectConfig {
  return {
    orgName: '[org]',
    designSystems: [],
    languages: [{ language: 'en', name: 'English', path: '/' }],
    plugins: {},
    reasons: {},
    services: [],
    links: [],
    servicesConfigEnabled: false,
  };
}

type Call = { name: string; args: unknown[] };

async function withMls<T>(stor: unknown, fn: () => Promise<T> | T): Promise<T> {
  const g = globalThis as { mls?: unknown };
  const prev = g.mls;
  g.mls = { stor };
  try {
    return await fn();
  } finally {
    g.mls = prev;
    delete projectConfig[PROJECT];
  }
}

function storStub(opts: { withFile?: boolean } = {}): { stor: unknown; calls: Call[] } {
  const calls: Call[] = [];
  const file = {
    project: PROJECT,
    level: 5,
    shortName: 'project',
    folder: '',
    extension: '.json',
    inLocalStorage: true,
  };
  const files: Record<string, typeof file> = {};
  if (opts.withFile !== false) files[KEY] = file;
  const stor = {
    files,
    getKeyToFiles: (project: number, _level: number, shortName: string) =>
      `${project}_5_${shortName}.json`,
    getKeyToFile: (info: { project: number; shortName: string }) =>
      `${info.project}_5_${info.shortName}.json`,
    localStor: {
      setContent: async (...args: unknown[]) => {
        calls.push({ name: 'localStor.setContent', args });
      },
    },
    setContents: async (...args: unknown[]) => {
      calls.push({ name: 'setContents', args });
      return true;
    },
    cache: {
      setContent: async (...args: unknown[]) => {
        calls.push({ name: 'cache.setContent', args });
      },
    },
  };
  return { stor, calls };
}

test('T6: updateConfigProject without save keeps today\'s behaviour and has no static 102033 import', async () => {
  const src = readFileSync(SRC, 'utf8');
  assert.doesNotMatch(src, /\bfrom\s+['"]\/_102033_/);
  const { stor, calls } = storStub();
  const config = sampleConfig();
  projectConfig[PROJECT] = { config: sampleConfig(), versionRef: '0' };
  await withMls(stor, () => updateConfigProject(PROJECT, config));
  assert.equal(calls.filter((c) => c.name === 'localStor.setContent').length, 1);
  assert.equal(calls.filter((c) => c.name === 'setContents').length, 0);
  const written = (calls[0]?.args[1] as { content: string }).content;
  assert.equal(written, JSON.stringify(config, null, 2));
});

test('T7: updateConfigProject with save: true calls saveL5File with the serialized content', async () => {
  const { stor, calls } = storStub();
  const config = sampleConfig();
  projectConfig[PROJECT] = { config: sampleConfig(), versionRef: '0' };
  await withMls(stor, () => updateConfigProject(PROJECT, config, true));
  const setContents = calls.filter((c) => c.name === 'setContents');
  assert.equal(setContents.length, 1, 'saveL5File must reach setContents');
  const localWrites = calls.filter((c) => c.name === 'localStor.setContent');
  assert.ok(localWrites.length >= 2, 'working copy then saveL5File');
  const serialized = JSON.stringify(config, null, 2);
  assert.ok(
    localWrites.some((c) => (c.args[1] as { content: string }).content === serialized),
    'serialized config must reach saveL5File',
  );
});

test('T8: project with no loaded config throws No config file!, not TypeError', async () => {
  const { stor } = storStub();
  await withMls(stor, async () => {
    await assert.rejects(
      () => updateConfigProject(PROJECT, sampleConfig()),
      (err: unknown) => err instanceof Error && err.message === 'No config file!',
    );
  });
});
