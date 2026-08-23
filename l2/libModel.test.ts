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

