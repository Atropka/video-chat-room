import type { ChatMessage, Participant, Room } from './types.js';
export const rooms = new Map<string, Room>();

export function createRoom(id) {
  const room: Room = {
    id,
    participants: new Map(),
    chatHistory: [],
  };
  rooms.set(id, room);
  return room;
}

export function getOrCreateRoom(id) {
  return rooms.get(id) ?? createRoom(id);
}

export function getRoom(id) {
  return rooms.get(id);
}

export function deleteRoom(id) {
  rooms.delete(id);
}

export function addParticipant(room: Room, participant: Participant) {
  room.participants.set(participant.id, participant);
}

export function removeParticipant(room: Room, participantId: string) {
  const participant = room.participants.get(participantId);
  room.participants.delete(participantId);
  if (room.participants.size === 0) rooms.delete(room.id);
  return participant;
}

export function listParticipants(room: Room): Participant[] {
  return [...room.participants.values()];
}

export function findParticipant(room: Room, participantId: string) {
  return room.participants.get(participantId);
}

export function addMessage(room: Room, message: ChatMessage) {
  room.chatHistory.push(message);
}
