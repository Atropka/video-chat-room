import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSocketHandlers } from '../src/socketHandlers.js';
import { rooms } from '../src/roomStore.js';

function createFakeIo() {
  let connectionHandler;
  const roomEvents = [];
  return {
    on(event, handler) {
      if (event === 'connection') connectionHandler = handler;
    },
    to(roomId) {
      return { emit: (event, payload) => roomEvents.push({ roomId, event, payload }) };
    },
    connect(socket) {
      connectionHandler(socket);
    },
    roomEvents,
  };
}

function createFakeSocket(id) {
  const handlers = new Map();
  const socket = {
    id,
    data: {},
    connected: true,
    rooms: new Set(),
    on(event, handler) { handlers.set(event, handler); },
    emit() {},
    join(roomId) { socket.rooms.add(roomId); },
    leave(roomId) { socket.rooms.delete(roomId); },
    to(roomId) {
      return { emit: (event, payload) => socket.events.push({ roomId, event, payload }) };
    },
    events: [],
    trigger(event, ...args) { return handlers.get(event)?.(...args); },
  };
  return socket;
}

test.afterEach(() => rooms.clear());

test('socket handler rejects the fifth participant', () => {
  const io = createFakeIo();
  registerSocketHandlers(io);
  const sockets = Array.from({ length: 5 }, (_, index) => createFakeSocket(`socket-${index + 1}`));
  const results = [];

  for (const [index, socket] of sockets.entries()) {
    io.connect(socket);
    socket.trigger('join-room', { roomId: 'abc123', name: `User ${index + 1}` }, (result) => results.push(result));
  }

  assert.equal(results.length, 5);
  assert.equal(results.slice(0, 4).every((result) => result.ok), true);
  assert.deepEqual(results[4], { ok: false, code: 'ROOM_FULL', error: 'Комната заполнена.' });
  assert.equal(rooms.get('abc123').participants.size, 4);
});

test('socket handler broadcasts chat and removes an empty room', () => {
  const io = createFakeIo();
  registerSocketHandlers(io);
  const socket = createFakeSocket('socket-1');
  io.connect(socket);

  let joinResult;
  socket.trigger('join-room', { roomId: 'abc123', name: 'Dima' }, (result) => { joinResult = result; });
  assert.equal(joinResult.ok, true);

  let messageResult;
  socket.trigger('send-message', { text: 'Привет' }, (result) => { messageResult = result; });
  assert.equal(messageResult.ok, true);
  assert.equal(io.roomEvents.some((event) => event.event === 'chat-message' && event.payload.text === 'Привет'), true);

  socket.trigger('leave-room');
  assert.equal(rooms.has('abc123'), false);
});
