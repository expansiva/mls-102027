/// <mls fileReference="_102027_/l2/lessTokensCompletion.test.ts" enhancement="_blank" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { tokenAt } from '/_102027_/l2/lessTokensCompletion.js';

// Columns are Monaco's: 1-based, and `column` is the caret position (between characters).
const LINE = '    color: @text-default;';
//            123456789...
//            '@' sits at column 12, the reference spans [12, 25)

test('tokenAt finds the reference under the caret', () => {
    assert.deepEqual(tokenAt(LINE, 12), { name: 'text-default', start: 12, end: 25 });
    assert.deepEqual(tokenAt(LINE, 18), { name: 'text-default', start: 12, end: 25 });
    // last character of the reference is still inside
    assert.deepEqual(tokenAt(LINE, 24), { name: 'text-default', start: 12, end: 25 });
});

test('tokenAt returns null outside the reference', () => {
    assert.equal(tokenAt(LINE, 5), null);   // on `color`
    assert.equal(tokenAt(LINE, 25), null);  // on the `;` right after
    assert.equal(tokenAt('    display: flex;', 8), null);
});

test('tokenAt picks the right reference when the line has several', () => {
    const line = 'margin: @space-8 @space-16;';
    //            1234567890...  '@space-8' at 9..17, '@space-16' at 18..27
    assert.equal(tokenAt(line, 10)?.name, 'space-8');
    assert.equal(tokenAt(line, 20)?.name, 'space-16');
});

test('tokenAt keeps dashes and digits, stops at the delimiter', () => {
    assert.equal(tokenAt('a: @chart-series-6;', 5)?.name, 'chart-series-6');
    assert.equal(tokenAt('a: calc(@space-base-unit * 2);', 10)?.name, 'space-base-unit');
});
