/// <mls fileReference="_102027_/l2/libModel.test.ts" enhancement="_blank"/>

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, 'libModel.ts'), 'utf8');

function functionBody(name: string): string {
  const start = SRC.indexOf(`async function ${name}`);
  assert.ok(start >= 0, `${name} not found`);
  const next = SRC.indexOf('\nasync function ', start + 1);
  const end = next >= 0 ? next : SRC.length;
  return SRC.slice(start, end);
}

void test('the three onModelChange stack frames skip a disposed Monaco model before getValue', () => {
  // run04: [onModelChange] Error: Model is disposed! at _checkSameContent at _changeStatusFile at _updateModelStatusTS
  for (const name of ['_updateModelStatusTS', '_changeStatusFile', '_checkSameContent']) {
    const body = functionBody(name);
    assert.match(body, /model\.isDisposed\(\)/, `${name} must guard isDisposed`);
    assert.match(body, /if \(modelBase\.model\.isDisposed\(\)\) return;/);
  }
  const check = functionBody('_checkSameContent');
  const guardAt = check.indexOf('modelBase.model.isDisposed()');
  const getValueAt = check.indexOf('getValue()');
  assert.ok(guardAt >= 0 && getValueAt > guardAt, '_checkSameContent must return before getValue on a disposed model');
});

interface ContentChange {
  changes: Array<{ range: { startLineNumber: number; endLineNumber: number; endColumn: number } }>;
}

function listeningModel(text: string): {
  model: mls.editor.IModelBase;
  listeners: Array<(event: ContentChange) => void>;
  setText: (next: string) => void;
} {
  const listeners: Array<(event: ContentChange) => void> = [];
  let value = text;
  const model = {
    model: {
      id: 'model-1',
      isDisposed: () => false,
      getValue: () => value,
      getLineCount: () => 1,
      getLineContent: () => value,
      onDidChangeContent: (listener: (event: ContentChange) => void) => {
        listeners.push(listener);
        return { dispose() { } };
      },
    },
    storFile: {
      project: 102047,
      level: 2,
      folder: '',
      shortName: 'inicio',
      extension: '.ts',
      inLocalStorage: false,
      hasError: false,
      status: 'nochange',
    },
    codeLens: {},
    originalCRC: 'kept',
  } as unknown as mls.editor.IModelBase;
  return {
    model,
    listeners,
    setText: (next: string) => { value = next; },
  };
}

async function loadLibModel(): Promise<typeof import('/_102027_/l2/libModel.js')> {
  const host = globalThis as typeof globalThis & {
    mls: {
      events: { addEventListener: (...args: unknown[]) => void };
      stor: { files: Record<string, unknown>; localStor: { setContent: () => Promise<void> } };
    };
    window?: typeof globalThis;
  };
  host.mls.events = host.mls.events ?? { addEventListener: () => { } };
  if (!host.mls.events.addEventListener) host.mls.events.addEventListener = () => { };
  host.mls.stor = host.mls.stor ?? { files: {}, localStor: { setContent: async () => { } } };
  host.window = host.window ?? globalThis;
  return import('/_102027_/l2/libModel.js');
}

void test('setModelEventAny binds one content listener', async () => {
  const lib = await loadLibModel();
  const { model, listeners } = listeningModel('const a = 1;\n');
  await lib.setModelEventAny(model, model.storFile);
  await lib.setModelEventAny(model, model.storFile);
  assert.equal(listeners.length, 1);
});

void test('a rejecting getValueInfo still binds the listener and logs the file', async () => {
  const lib = await loadLibModel();
  const { model, listeners } = listeningModel('const a = 1;\n');
  model.originalCRC = undefined;
  model.storFile.getValueInfo = async () => {
    throw new Error('published crc unavailable');
  };
  const errors: string[] = [];
  const previous = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map((item) => (item instanceof Error ? item.message : String(item))).join(' '));
  };
  try {
    await lib.setModelEventAny(model, model.storFile);
    assert.equal(listeners.length, 1);
    assert.equal(errors.some((line) => line.includes('102047/l2/inicio.ts') && line.includes('published crc unavailable')), true);
  } finally {
    console.error = previous;
  }
});

