import crypto from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type { ChatMessage, Participant, Room } from './types.js';
import {
  getOrCreateRoom,
  getRoom,
  addParticipant,
  removeParticipant,
  listParticipants,
  findParticipant,
  addMessage,
} from './roomStore.js';
import { validateMessage, validateName, validateRoomId, isPlainObject } from './validation.js';

const MAX_PARTICIPANTS = 4;

function publicParticipant(participant: Participant) {
  return {
    id: participant.id,
    name: participant.name,
    isMicOn: participant.isMicOn,
    isCamOn: participant.isCamOn,
    joinedAt: participant.joinedAt,
  };
}

function systemMessage(text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    type: 'system',
    senderName: '',
    text,
    createdAt: new Date().toISOString(),
  };
}

function userMessage(name: string, text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    type: 'user',
    senderName: name,
    text,
    createdAt: new Date().toISOString(),
  };
}

function getSocketRoom(socket: Socket): Room | undefined {
  const roomId = socket.data.roomId;
  return roomId ? getRoom(roomId) : undefined;
}

function isMember(socket: Socket, room: Room | undefined, participantId = socket.id): boolean {
  return Boolean(room && room.participants.has(participantId) && participantId === socket.id);
}

function leaveRoom(io: Server, socket: Socket, { announce = true }: { announce?: boolean } = {}) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = getRoom(roomId);
  socket.leave(roomId);
  socket.data.roomId = undefined;

  if (!room) return;
  const participant = removeParticipant(room, socket.id);
  if (!participant) return;

  if (room.participants.size > 0) {
    io.to(roomId).emit('user-left', { id: socket.id });
    if (announce) {
      const message = systemMessage(`${participant.name} покинул комнату`);
      addMessage(room, message);
      io.to(roomId).emit('chat-message', message);
    }
  }
}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    socket.on('join-room', (payload: any, ack: (result: any) => void = () => {}) => {
      if (socket.data.roomId) {
        ack({ ok: false, error: 'Вы уже находитесь в комнате.' });
        return;
      }

      const roomResult = validateRoomId(payload?.roomId);
      const nameResult = validateName(payload?.name);
      if (roomResult.ok === false) return ack({ ok: false, error: roomResult.error });
      if (nameResult.ok === false) return ack({ ok: false, error: nameResult.error });

      const room = getOrCreateRoom(roomResult.value);
      if (room.participants.size >= MAX_PARTICIPANTS) {
        ack({ ok: false, code: 'ROOM_FULL', error: 'Комната заполнена.' });
        return;
      }

      const existingParticipants = listParticipants(room).map(publicParticipant);
      const participant = {
        id: socket.id,
        name: nameResult.value,
        isMicOn: true,
        isCamOn: true,
        joinedAt: new Date().toISOString(),
      };
      addParticipant(room, participant);
      socket.data.roomId = room.id;
      socket.join(room.id);

      const message = systemMessage(`${participant.name} присоединился к комнате`);
      addMessage(room, message);

      ack({
        ok: true,
        selfId: participant.id,
        participants: existingParticipants,
        messages: room.chatHistory,
      });

      socket.to(room.id).emit('user-joined', { participant: publicParticipant(participant) });
      socket.to(room.id).emit('chat-message', message);
    });

    socket.on('leave-room', () => leaveRoom(io, socket));

    socket.on('send-message', (payload: any, ack: (result: any) => void = () => {}) => {
      const room = getSocketRoom(socket);
      const participant = room && findParticipant(room, socket.id);
      if (!isMember(socket, room) || !participant) {
        ack({ ok: false, error: 'Вы не находитесь в комнате.' });
        return;
      }

      const result = validateMessage(payload?.text);
      if (result.ok === false) {
        ack({ ok: false, error: result.error });
        return;
      }

      const message = userMessage(participant.name, result.value);
      addMessage(room, message);
      io.to(room.id).emit('chat-message', message);
      ack({ ok: true, message });
    });

    socket.on('toggle-media', (payload: any, ack: (result: any) => void = () => {}) => {
      const room = getSocketRoom(socket);
      const participant = room && findParticipant(room, socket.id);
      if (!isMember(socket, room) || !participant) {
        ack({ ok: false, error: 'Вы не находитесь в комнате.' });
        return;
      }
      if (!isPlainObject(payload) || !['mic', 'cam'].includes(payload.kind) || typeof payload.enabled !== 'boolean') {
        ack({ ok: false, error: 'Некорректное состояние устройства.' });
        return;
      }

      if (payload.kind === 'mic') participant.isMicOn = payload.enabled;
      else participant.isCamOn = payload.enabled;

      io.to(room.id).emit('media-state-changed', {
        id: socket.id,
        kind: payload.kind,
        enabled: payload.enabled,
      });
      ack({ ok: true });
    });

    for (const event of ['webrtc-offer', 'webrtc-answer', 'webrtc-ice-candidate']) {
      socket.on(event, (payload: any, ack: (result: any) => void = () => {}) => {
        const room = getSocketRoom(socket);
        if (!isMember(socket, room)) {
          ack({ ok: false, error: 'Вы не находитесь в комнате.' });
          return;
        }
        if (!isPlainObject(payload) || typeof payload.targetId !== 'string' || payload.targetId === socket.id) {
          ack({ ok: false, error: 'Некорректный signaling payload.' });
          return;
        }
        const target = findParticipant(room, payload.targetId);
        if (!target) {
          ack({ ok: false, error: 'Участник не найден.' });
          return;
        }
        const { targetId, ...data } = payload;
        io.to(targetId).emit(event, { fromId: socket.id, ...data });
        ack({ ok: true });
      });
    }

    socket.on('disconnect', () => leaveRoom(io, socket));
  });
}
