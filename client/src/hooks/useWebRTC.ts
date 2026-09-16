import { useCallback, useEffect, useRef, useState } from 'react';
import type { Participant } from '../types';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function useWebRTC({
  selfId,
  participants,
  stream,
  isMicOn,
  isCamOn,
  sendSignal,
  registerHandlers,
}) {
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const streamRef = useRef<MediaStream | null>(stream);
  const mediaStateRef = useRef({ isMicOn: Boolean(isMicOn), isCamOn: Boolean(isCamOn) });
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [peerStates, setPeerStates] = useState<Record<string, string>>({});
  const [peerDiagnostics, setPeerDiagnostics] = useState<Record<string, any>>({});

  streamRef.current = stream;
  mediaStateRef.current = { isMicOn, isCamOn };

  const updatePeerState = useCallback((peerId, state) => {
    setPeerStates((current) => ({ ...current, [peerId]: state }));
    setPeerDiagnostics((current) => ({
      ...current,
      [peerId]: { ...(current[peerId] || {}), connectionState: state },
    }));
  }, []);

  const refreshPeerDiagnostics = useCallback((peerId, pc) => {
    if (!pc) return;
    const senders = pc.getSenders();
    const receivers = pc.getReceivers();
    const audioSender = senders.find((sender) => sender.track?.kind === 'audio');
    const videoSender = senders.find((sender) => sender.track?.kind === 'video');
    const audioReceiver = receivers.find((receiver) => receiver.track?.kind === 'audio');
    const videoReceiver = receivers.find((receiver) => receiver.track?.kind === 'video');
    setPeerDiagnostics((current) => ({
      ...current,
      [peerId]: {
        ...(current[peerId] || {}),
        role: pc.__vcrMeta?.initiator ? 'initiator' : 'receiver',
        signalingState: pc.signalingState,
        iceConnectionState: pc.iceConnectionState,
        connectionState: pc.connectionState,
        iceGatheringState: pc.iceGatheringState,
        localDescription: Boolean(pc.localDescription),
        remoteDescription: Boolean(pc.remoteDescription),
        audioSender: Boolean(audioSender?.track),
        videoSender: Boolean(videoSender?.track),
        audioSenderEnabled: audioSender?.track?.enabled ?? false,
        videoSenderEnabled: videoSender?.track?.enabled ?? false,
        audioReceiver: Boolean(audioReceiver?.track),
        videoReceiver: Boolean(videoReceiver?.track),
        audioTransceiverDirection: pc.getTransceivers().find((t) => t.receiver.track?.kind === 'audio')?.direction || 'none',
        audioCurrentDirection: pc.getTransceivers().find((t) => t.receiver.track?.kind === 'audio')?.currentDirection || 'none',
        videoTransceiverDirection: pc.getTransceivers().find((t) => t.receiver.track?.kind === 'video')?.direction || 'none',
        videoCurrentDirection: pc.getTransceivers().find((t) => t.receiver.track?.kind === 'video')?.currentDirection || 'none',
        audioReceiverState: audioReceiver?.track?.readyState || 'none',
        videoReceiverState: videoReceiver?.track?.readyState || 'none',
        senders: senders.map((sender) => ({
          kind: sender.track?.kind || 'none',
          id: sender.track?.id || null,
          enabled: sender.track?.enabled ?? null,
        })),
        receivers: receivers.map((receiver) => ({
          kind: receiver.track?.kind || 'none',
          id: receiver.track?.id || null,
          readyState: receiver.track?.readyState || 'none',
          muted: receiver.track?.muted ?? null,
        })),
        remoteStreamTracks: remoteStreamsRef.current.get(peerId)?.getTracks().map((track) => ({ kind: track.kind, readyState: track.readyState, enabled: track.enabled })) || [],
        updatedAt: Date.now(),
      },
    }));
  }, []);

  const removeRemoteStream = useCallback((peerId) => {
    remoteStreamsRef.current.delete(peerId);
    pendingCandidatesRef.current.delete(peerId);
    setRemoteStreams((current) => {
      if (!(peerId in current)) return current;
      const next = { ...current };
      delete next[peerId];
      return next;
    });
    setPeerDiagnostics((current) => {
      if (!(peerId in current)) return current;
      const next = { ...current };
      delete next[peerId];
      return next;
    });
    setPeerStates((current) => {
      if (!(peerId in current)) return current;
      const next = { ...current };
      delete next[peerId];
      return next;
    });
  }, []);

  const syncLocalSenders = useCallback(async (pc) => {
    const localStream = streamRef.current;
    const { isMicOn: micEnabled, isCamOn: camEnabled } = mediaStateRef.current;
    const audioTrack = localStream?.getAudioTracks()[0] || null;
    const videoTrack = localStream?.getVideoTracks()[0] || null;

    const audioTransceiver = pc.getTransceivers().find((t) => t.receiver.track?.kind === 'audio');
    const videoTransceiver = pc.getTransceivers().find((t) => t.receiver.track?.kind === 'video');

    if (audioTransceiver) await audioTransceiver.sender.replaceTrack(micEnabled ? audioTrack : null);
    if (videoTransceiver) await videoTransceiver.sender.replaceTrack(camEnabled ? videoTrack : null);
  }, []);

  const flushCandidates = useCallback(async (peerId, pc) => {
    const queued = pendingCandidatesRef.current.get(peerId) || [];
    pendingCandidatesRef.current.delete(peerId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Candidate can belong to an obsolete ICE generation.
      }
    }
  }, []);

  const createPeer = useCallback((peerId) => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.__vcrMeta = {
      initiator: Boolean(selfId && peerId && selfId < peerId),
      makingOffer: false,
      offerSent: false,
    };

    // Negotiate actual local tracks from the beginning. This avoids the
    // asymmetric send/receive behavior we observed with transceiver-only
    // setup. If a device is unavailable, keep a sendrecv transceiver so the
    // other media direction remains available.
    const localStream = streamRef.current;
    const audioTrack = localStream?.getAudioTracks()[0] || null;
    const videoTrack = localStream?.getVideoTracks()[0] || null;

    if (audioTrack) pc.addTrack(audioTrack, localStream);
    else pc.addTransceiver('audio', { direction: 'sendrecv' });

    if (videoTrack) pc.addTrack(videoTrack, localStream);
    else pc.addTransceiver('video', { direction: 'sendrecv' });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal('webrtc-ice-candidate', {
        targetId: peerId,
        candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
      });
    };

    pc.ontrack = (event) => {
      // Prefer the stream supplied by the browser. It is the authoritative
      // association between the incoming RTP tracks and the MediaStream used
      // by the video/audio element. Fall back to assembling a stream only when
      // the browser did not provide one.
      let incomingStream = event.streams?.[0] || remoteStreamsRef.current.get(peerId);
      if (!incomingStream) {
        incomingStream = new MediaStream();
      }
      remoteStreamsRef.current.set(peerId, incomingStream);

      if (!incomingStream.getTracks().some((track) => track.id === event.track.id)) {
        try { incomingStream.addTrack(event.track); } catch {}
      }

      event.track.onended = () => {
        const current = remoteStreamsRef.current.get(peerId);
        if (current) setRemoteStreams((state) => ({ ...state, [peerId]: current }));
        refreshPeerDiagnostics(peerId, pc);
      };
      event.track.onmute = () => refreshPeerDiagnostics(peerId, pc);
      event.track.onunmute = () => refreshPeerDiagnostics(peerId, pc);

      setRemoteStreams((current) => ({ ...current, [peerId]: incomingStream }));
      refreshPeerDiagnostics(peerId, pc);
    };

    pc.onconnectionstatechange = () => {
      updatePeerState(peerId, pc.connectionState);
      refreshPeerDiagnostics(peerId, pc);

      // Some Chromium builds can expose receiver tracks a tick before the
      // ontrack callback reaches the application. Only use this as a delayed
      // fallback after the connection is established; never during SDP setup.
      if (pc.connectionState === 'connected') {
        setTimeout(() => {
          if (peersRef.current.get(peerId) !== pc) return;
          const hasStream = remoteStreamsRef.current.get(peerId)?.getTracks().length;
          if (hasStream) return;
          const receiverTracks = pc.getReceivers().map((receiver) => receiver.track).filter(Boolean);
          if (!receiverTracks.length) return;
          const incomingStream = new MediaStream(receiverTracks);
          remoteStreamsRef.current.set(peerId, incomingStream);
          setRemoteStreams((current) => ({ ...current, [peerId]: incomingStream }));
          refreshPeerDiagnostics(peerId, pc);
        }, 300);
      }

      if (pc.connectionState === 'closed') {
        peersRef.current.delete(peerId);
        removeRemoteStream(peerId);
      }
    };

    pc.onsignalingstatechange = () => refreshPeerDiagnostics(peerId, pc);
    pc.onicegatheringstatechange = () => refreshPeerDiagnostics(peerId, pc);
    pc.oniceconnectionstatechange = () => {
      refreshPeerDiagnostics(peerId, pc);
      if (pc.iceConnectionState === 'failed') updatePeerState(peerId, 'failed');
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        updatePeerState(peerId, 'connected');
      }
    };

    peersRef.current.set(peerId, pc);
    updatePeerState(peerId, pc.connectionState);
    refreshPeerDiagnostics(peerId, pc);
    return pc;
  }, [refreshPeerDiagnostics, removeRemoteStream, selfId, sendSignal, updatePeerState]);

  const initiatePeer = useCallback(async (peerId, pc) => {
    const meta = pc.__vcrMeta;
    if (!meta.initiator || meta.offerSent || meta.makingOffer) return;
    if (pc.signalingState !== 'stable') return;

    meta.makingOffer = true;
    try {
      await syncLocalSenders(pc);
      refreshPeerDiagnostics(peerId, pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      meta.offerSent = true;
      refreshPeerDiagnostics(peerId, pc);
      const offerPayload = { targetId: peerId, sdp: pc.localDescription };
      const result = await sendSignal('webrtc-offer', offerPayload);
      refreshPeerDiagnostics(peerId, pc);

      if (!result?.ok) {
        updatePeerState(peerId, 'signaling-error');
      }
    } catch (error) {
      meta.offerSent = false;
      updatePeerState(peerId, `error:${error.name || 'offer'}`);
    } finally {
      meta.makingOffer = false;
    }
  }, [refreshPeerDiagnostics, sendSignal, syncLocalSenders, updatePeerState]);

  const handleOffer = useCallback(async ({ fromId, sdp }) => {
    if (!fromId || !sdp || !selfId) return;
    const pc = createPeer(fromId);

    try {
      await pc.setRemoteDescription(sdp);
      refreshPeerDiagnostics(fromId, pc);
      await flushCandidates(fromId, pc);
      await syncLocalSenders(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      refreshPeerDiagnostics(fromId, pc);
      await sendSignal('webrtc-answer', {
        targetId: fromId,
        sdp: pc.localDescription,
      });
    } catch (error) {
      updatePeerState(fromId, `error:${error.name || 'answer'}`);
    }
  }, [createPeer, flushCandidates, refreshPeerDiagnostics, selfId, sendSignal, syncLocalSenders, updatePeerState]);

  const handleAnswer = useCallback(async ({ fromId, sdp }) => {
    if (!fromId || !sdp) return;
    const pc = peersRef.current.get(fromId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(sdp);
      refreshPeerDiagnostics(fromId, pc);
      await flushCandidates(fromId, pc);
      // Tracks may have changed while the initial offer was in flight. We use
      // replaceTrack only; no renegotiation is needed for mute/device changes.
      await syncLocalSenders(pc);
      refreshPeerDiagnostics(fromId, pc);
    } catch (error) {
      updatePeerState(fromId, `error:${error.name || 'answer'}`);
    }
  }, [flushCandidates, refreshPeerDiagnostics, syncLocalSenders, updatePeerState]);

  const handleCandidate = useCallback(async ({ fromId, candidate }) => {
    if (!fromId || !candidate) return;
    const pc = peersRef.current.get(fromId);
    if (!pc || !pc.remoteDescription) {
      const queued = pendingCandidatesRef.current.get(fromId) || [];
      queued.push(candidate);
      pendingCandidatesRef.current.set(fromId, queued);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // Ignore stale candidates after the remote description changed.
    }
  }, []);

  useEffect(() => {
    registerHandlers.current = {
      onSignaling: (event, payload) => {
        if (event === 'webrtc-offer') void handleOffer(payload);
        if (event === 'webrtc-answer') void handleAnswer(payload);
        if (event === 'webrtc-ice-candidate') void handleCandidate(payload);
      },
    };
  }, [handleAnswer, handleCandidate, handleOffer, registerHandlers]);

  // Exactly one side of every pair initiates the initial offer. This avoids
  // offer glare entirely while keeping a full mesh for 3-4 participants.
  useEffect(() => {
    if (!selfId) return undefined;
    let cancelled = false;

    async function ensurePeers() {
      for (const participant of participants as Participant[]) {
        if (cancelled || participant.id === selfId) continue;
        const pc = createPeer(participant.id);
        await syncLocalSenders(pc);
        if (!cancelled) await initiatePeer(participant.id, pc);
      }
    }

    void ensurePeers();
    return () => { cancelled = true; };
  }, [createPeer, initiatePeer, participants, selfId, syncLocalSenders]);

  // Camera/microphone changes never recreate the peer connection. The current
  // sender is simply pointed at the current track (or null when muted/off).
  useEffect(() => {
    if (!selfId) return;
    for (const [peerId, pc] of peersRef.current.entries()) {
      void syncLocalSenders(pc).then(() => refreshPeerDiagnostics(peerId, pc));
    }
  }, [isCamOn, isMicOn, selfId, stream, syncLocalSenders]);

  useEffect(() => {
    const currentIds = new Set(participants.map((participant) => participant.id));
    for (const [peerId, pc] of peersRef.current.entries()) {
      if (!currentIds.has(peerId)) {
        try { pc.close(); } catch {}
        peersRef.current.delete(peerId);
        removeRemoteStream(peerId);
      }
    }
  }, [participants, removeRemoteStream]);

  useEffect(() => () => {
    for (const pc of peersRef.current.values()) {
      try { pc.close(); } catch {}
    }
    peersRef.current.clear();
    pendingCandidatesRef.current.clear();
    remoteStreamsRef.current.clear();
  }, []);

  return {
    remoteStreams,
    peerStates,
    peerDiagnostics,
    closePeer: (peerId) => {
      const pc = peersRef.current.get(peerId);
      try { pc?.close(); } catch {}
      peersRef.current.delete(peerId);
      removeRemoteStream(peerId);
    },
  };
}
