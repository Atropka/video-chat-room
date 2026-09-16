export type ConnectionState = 'idle' | 'connecting' | 'joining' | 'connected' | 'error' | 'disconnected';

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

export interface RoomError {
  code: string;
  message: string;
}

export interface MediaErrors {
  mic: string | null;
  cam: string | null;
}

export interface DeviceLists {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
}

export interface SelectedDevices {
  mic: string;
  cam: string;
}

export interface MediaResult {
  ok: boolean;
  enabled?: boolean;
  error?: string;
}

export interface SignalResult {
  ok: boolean;
  error?: string;
}

export interface SignalHandlers {
  onSignaling?: (event: string, payload: any) => void;
  onJoined?: (result: any) => void;
  onConnectError?: (error: Error) => void;
  onDisconnect?: (reason: string) => void;
  onUserJoined?: (participant: Participant) => void;
  onUserLeft?: (id: string) => void;
  onChatMessage?: (message: ChatMessage) => void;
  onMediaStateChanged?: (payload: MediaStatePayload) => void;
}

export interface MediaStatePayload {
  id: string;
  kind: 'mic' | 'cam';
  enabled: boolean;
}

declare global {
  interface RTCPeerConnection {
    __vcrMeta?: {
      initiator: boolean;
      makingOffer: boolean;
      offerSent: boolean;
    };
  }
}
