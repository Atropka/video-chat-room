import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';
import type { SignalHandlers } from '../types';
import { useSocket } from '../hooks/useSocket';
import { useMediaStream } from '../hooks/useMediaStream';
import { useWebRTC } from '../hooks/useWebRTC';

const RoomContext = createContext<any>(null);

const initialState = {
  connectionState: 'idle',
  selfId: null,
  participants: [],
  messages: [],
  error: null,
};

function reducer(state: any, action: any) {
  switch (action.type) {
    case 'SOCKET_SYNC':
      return {
        ...state,
        connectionState: action.payload.connectionState,
        selfId: action.payload.selfId,
        participants: action.payload.participants,
        messages: action.payload.messages,
        error: action.payload.error,
      };
    default:
      return state;
  }
}

export function RoomProvider({ roomId, name, children }: { roomId: string; name: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const media = useMediaStream();
  const webrtcHandlersRef = useRef<SignalHandlers>({});
  const onSignaling = useCallback((event, payload) => {
    webrtcHandlersRef.current.onSignaling?.(event, payload);
  }, []);
  const socketReady = media.status === 'ready' || media.status === 'error';
  const socketState = useSocket(roomId, name, { onSignaling }, socketReady);

  const webRTC = useWebRTC({
    selfId: socketState.selfId,
    participants: socketState.participants,
    stream: media.stream,
    isMicOn: media.isMicOn,
    isCamOn: media.isCamOn,
    sendSignal: socketState.sendSignal,
    registerHandlers: webrtcHandlersRef,
  });

  useEffect(() => {
    dispatch({
      type: 'SOCKET_SYNC',
      payload: {
        connectionState: socketState.connectionState,
        selfId: socketState.selfId,
        participants: socketState.participants,
        messages: socketState.messages,
        error: socketState.error,
      },
    });
  }, [socketState.connectionState, socketState.selfId, socketState.participants, socketState.messages, socketState.error]);

  useEffect(() => {
    if (socketState.connectionState !== 'connected') return;
    if (media.status !== 'ready' && media.status !== 'error') return;

    socketState.toggleMedia('mic', media.isMicOn);
    socketState.toggleMedia('cam', media.isCamOn);
  }, [socketState.connectionState, media.status, media.isMicOn, media.isCamOn, socketState.toggleMedia]);

  const toggleMic = async () => {
    const previous = media.isMicOn;
    const result = media.toggleMic();
    if (!result.ok) return result;

    const serverResult = await socketState.toggleMedia('mic', result.enabled);
    if (!serverResult?.ok) {
      media.toggleMic();
      return { ok: false, enabled: previous, error: serverResult?.error || 'Не удалось изменить состояние микрофона.' };
    }
    return result;
  };

  const switchDevice = async (kind, deviceId) => {
    return media.switchDevice(kind, deviceId);
  };

  const toggleCam = async () => {
    const previous = media.isCamOn;
    const result = await media.toggleCam();
    if (!result.ok) return result;

    const serverResult = await socketState.toggleMedia('cam', result.enabled);
    if (!serverResult?.ok) {
      if (result.enabled) {
        await media.toggleCam();
      } else {
        await media.toggleCam();
      }
      return { ok: false, enabled: previous, error: serverResult?.error || 'Не удалось изменить состояние камеры.' };
    }
    return result;
  };

  const value = useMemo(() => ({
    ...state,
    stream: media.stream,
    isMicOn: media.isMicOn,
    isCamOn: media.isCamOn,
    mediaErrors: media.errors,
    mediaStatus: media.status,
    devices: media.devices,
    selectedDevices: media.selectedDevices,
    toggleMic,
    toggleCam,
    switchDevice,
    sendMessage: socketState.sendMessage,
    sendSignal: socketState.sendSignal,
    remoteStreams: webRTC.remoteStreams,
    peerStates: webRTC.peerStates,
  }), [
    state,
    media.stream,
    media.isMicOn,
    media.isCamOn,
    media.errors,
    media.status,
    media.devices,
    media.selectedDevices,
    socketState.sendMessage,
    socketState.sendSignal,
    webRTC.remoteStreams,
    webRTC.peerStates,
  ]);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom должен использоваться внутри RoomProvider');
  return context;
}
