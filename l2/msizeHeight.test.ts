/// <mls fileReference="_102027_/l2/msizeHeight.test.ts" enhancement="_blank"/>

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { applyMsizeHeight, heightFromMsize } from '/_102027_/l2/msizeHeight.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_BASE_FILES = [
    path.join(HERE, 'serviceBase.ts'),
    path.join(HERE, '..', '..', 'mls-100554', 'l2', 'serviceBase.ts'),
];

function fakeEl(height = '', overflow = '') {
    return { style: { height, overflow } };
}

function msizeBranch(src: string): string {
    const match = src.match(/if \(name === 'msize'\) \{[\s\S]*?\n        \}/);
    assert.ok(match, 'ramo name === \'msize\' não encontrado');
    return match[0];
}

test('T1: a segunda applyMsizeHeight vence — o host fica com a altura atual, não a anterior', () => {
    const el = fakeEl();
    applyMsizeHeight(el, '1400.00,813.00,0.00,0.00');
    applyMsizeHeight(el, '1400.00,433.00,0.00,0.00');
    assert.equal(el.style.height, '433px');
});

test('T2: heightFromMsize recusa ausente, NaN e <= 0; applyMsizeHeight não escreve', () => {
    const el = fakeEl('100px', 'scroll');
    const rejected = ['', null, '1400', '1400,abc,0,0', '1400,0.00,0,0', '1400,-5,0,0'] as const;
    for (const msize of rejected) {
        assert.equal(heightFromMsize(msize), null, String(msize));
        assert.equal(applyMsizeHeight(el, msize), false, String(msize));
    }
    assert.equal(el.style.height, '100px');
    assert.equal(el.style.overflow, 'scroll');
});

test('T3: heightFromMsize aceita o decimal que o collab-page emite (toFixed(2))', () => {
    assert.equal(heightFromMsize('1400.00,813.00,0.00,0.00'), 813);
});

test('T4: applyMsizeHeight com altura válida escreve height e overflow:auto e devolve true', () => {
    const el = fakeEl();
    assert.equal(applyMsizeHeight(el, '1400.00,813.00,0.00,0.00'), true);
    assert.equal(el.style.height, '813px');
    assert.equal(el.style.overflow, 'auto');
});

test('T5: o ramo msize dos dois serviceBase não lê this.msize', () => {
    for (const file of SERVICE_BASE_FILES) {
        const branch = msizeBranch(readFileSync(file, 'utf8'));
        assert.doesNotMatch(branch, /this\.msize/, file);
        assert.match(branch, /applyMsizeHeight\(this, newVal\)/, file);
    }
});
