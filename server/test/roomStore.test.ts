import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rooms,
  createRoom,
  addParticipant,
  removeParticipant,
  addMessage,
  getRoom,
  getOrCreateRoom,
} from '../src/roomStore.js';

test.afterEach(() => rooms.clear());

test('room store creates rooms and removes the empty room', () => {
  const room = createRoom('abc123');
  addParticipant(room, { id: '1', name: 'Dima', isMicOn: true, isCamOn: true, joinedAt: new Date().toISOString() });
  assert.equal(getRoom('abc123').participants.size, 1);
  removeParticipant(room, '1');
  assert.equal(getRoom('abc123'), undefined);
});

test('room store preserves chat history during room lifetime', () => {
  const room = getOrCreateRoom('abc123');
  addMessage(room, { id: 'm1', type: 'system', senderName: '', text: 'Dima присоединился к комнате', createdAt: new Date().toISOString() });
  assert.equal(getRoom('abc123').chatHistory.length, 1);
});
