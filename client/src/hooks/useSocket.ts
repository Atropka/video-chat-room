import { useCallback, useEffect, useRef, useState } from 'react';
import { createSocket } from '../services/socket';
import type { ChatMessage, ConnectionState, MediaStatePayload, Participant, RoomError, SignalHandlers } from '../types';

export function useSocket(roomId: string, name: string, handlers: SignalHandlers = {}, ready = true) {
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [selfId, setSelfId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<RoomError | null>(null);

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!roomId || !name || !ready) return undefined;

    const socket = createSocket();
    socketRef.current = socket;
    setConnectionState('connecting');
    setError(null);

    const onConnect = () => {
      setConnectionState('joining');
      socket.emit('join-room', { roomId, name }, (result) => {
        if (!result?.ok) {
          setConnectionState('error');
          setError({ code: result?.code || 'JOIN_FAILED', message: result?.error || 'Не удалось войти в комнату.' });
          socket.disconnect();
          return;
        }
        setSelfId(result.selfId);
        setParticipants(result.participants || []);
        setMessages(result.messages || []);
        setConnectionState('connected');
        handlersRef.current.onJoined?.(result);
      });
    };

    const onConnectError = (err: Error) => {
      setConnectionState('error');
      setError({ code: 'SOCKET_CONNECTION_ERROR', message: 'Не удалось подключиться к серверу.' });
      handlersRef.current.onConnectError?.(err);
    };

    const onDisconnect = (reason: string) => {
      setConnectionState('disconnected');
      handlersRef.current.onDisconnect?.(reason);
    };

    const onUserJoined = ({ participant }: { participant: Participant }) => {
      setParticipants((current) => current.some((item) => item.id === participant.id) ? current : [...current, participant]);
      handlersRef.current.onUserJoined?.(participant);
    };

    const onUserLeft = ({ id }: { id: string }) => {
      setParticipants((current) => current.filter((item) => item.id !== id));
      handlersRef.current.onUserLeft?.(id);
    };

    const onChatMessage = (message: ChatMessage) => {
      setMessages((current) => [...current, message]);
      handlersRef.current.onChatMessage?.(message);
    };

    const onMediaStateChanged = (payload: MediaStatePayload) => {
      setParticipants((current) => current.map((participant) => {
        if (participant.id !== payload.id) return participant;
        return payload.kind === 'mic'
          ? { ...participant, isMicOn: payload.enabled }
          : { ...participant, isCamOn: payload.enabled };
      }));
      handlersRef.current.onMediaStateChanged?.(payload);
    };

    const signalingEvents = ['webrtc-offer', 'webrtc-answer', 'webrtc-ice-candidate'];
    const signalingHandlers = new Map(signalingEvents.map((event) => [
      event,
      (payload) => handlersRef.current.onSignaling?.(event, payload),
    ]));
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('chat-message', onChatMessage);
    socket.on('media-state-changed', onMediaStateChanged);
    signalingHandlers.forEach((handler, event) => socket.on(event, handler));

    // Let sibling hooks (notably useWebRTC) register their signaling handlers
    // before the first connect/join response can arrive.
    const connectTimer = setTimeout(() => socket.connect(), 0);

    return () => {
      clearTimeout(connectTimer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('chat-message', onChatMessage);
      socket.off('media-state-changed', onMediaStateChanged);
      signalingHandlers.forEach((handler, event) => socket.off(event, handler));
      if (socket.connected) socket.emit('leave-room');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, name, ready]);

  const sendMessage = useCallback((text: string): Promise<any> => new Promise((resolve) => {
    const socket = socketRef.current;
    if (!socket?.connected) return resolve({ ok: false, error: 'Нет подключения к серверу.' });
    socket.emit('send-message', { text }, resolve);
  }), []);

  const toggleMedia = useCallback((kind: 'mic' | 'cam', enabled: boolean): Promise<any> => new Promise((resolve) => {
    const socket = socketRef.current;
    if (!socket?.connected) return resolve({ ok: false, error: 'Нет подключения к серверу.' });
    socket.emit('toggle-media', { kind, enabled }, resolve);
  }), []);

  const sendSignal = useCallback((event: string, payload: any): Promise<any> => {
    const socket = socketRef.current;
    if (!socket?.connected) return Promise.resolve({ ok: false, error: 'Нет подключения к серверу.' });
    return new Promise((resolve) => socket.emit(event, payload, resolve));
  }, []);

  return {
    socket: socketRef.current,
    connectionState,
    selfId,
    participants,
    messages,
    sendMessage,
    toggleMedia,
    sendSignal,
    error,
  };
}
