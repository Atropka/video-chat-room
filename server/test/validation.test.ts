import test from 'node:test';
import assert from 'node:assert/strict';
import { validateName, validateMessage, validateRoomId } from '../src/validation.js';

test('validateName accepts supported names and trims whitespace', () => {
  assert.deepEqual(validateName('  Dima  '), { ok: true, value: 'Dima' });
  assert.equal(validateName('').ok, false);
});

test('validateName rejects invalid characters and length', () => {
  assert.equal(validateName('Dima_1').ok, false);
  assert.equal(validateName('a'.repeat(31)).ok, false);
});

test('validateMessage trims, validates and limits text', () => {
  assert.deepEqual(validateMessage('  Привет  '), { ok: true, value: 'Привет' });
  assert.equal(validateMessage('   ').ok, false);
  assert.equal(validateMessage('a'.repeat(1001)).ok, false);
});

test('validateRoomId enforces the room id contract', () => {
  assert.equal(validateRoomId('abc123').ok, true);
  assert.equal(validateRoomId('abc').ok, false);
  assert.equal(validateRoomId('abc 123').ok, false);
});
