export interface Participant {
  id: string;
  name: string;
  isMicOn: boolean;
  isCamOn: boolean;
  joinedAt: string;
}

export interface ChatMessage {
  id: string;
  type: 'system' | 'user';
  senderName: string;
  text: string;
  createdAt: string;
}

export interface Room {
  id: string;
  participants: Map<string, Participant>;
  chatHistory: ChatMessage[];
}

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };
