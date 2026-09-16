import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeviceLists, MediaErrors, MediaResult, SelectedDevices } from '../types';

function getErrorMessage(kind: 'mic' | 'cam', error: any): string {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return kind === 'mic' ? 'Доступ к микрофону запрещён.' : 'Доступ к камере запрещён.';
  }
  if (error?.name === 'NotReadableError') {
    return kind === 'mic'
      ? 'Микрофон занят другим приложением или недоступен.'
      : 'Камера занята другим приложением или недоступна.';
  }
  if (error?.name === 'NotFoundError') {
    return kind === 'mic' ? 'Микрофон не найден.' : 'Камера не найдена.';
  }
  return kind === 'mic' ? 'Не удалось получить доступ к микрофону.' : 'Не удалось получить доступ к камере.';
}

export function useMediaStream() {
  const streamRef = useRef<MediaStream | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [errors, setErrors] = useState<MediaErrors>({ mic: null, cam: null });
  const [status, setStatus] = useState('idle');
  const [devices, setDevices] = useState<DeviceLists>({ audioInputs: [], videoInputs: [] });
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>({ mic: '', cam: '' });

  const refreshDevices = useCallback(async (): Promise<void> => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audioInputs: all.filter((device) => device.kind === 'audioinput'),
        videoInputs: all.filter((device) => device.kind === 'videoinput'),
      });
    } catch {
      // Device enumeration is optional; existing tracks can continue working.
    }
  }, []);

  const updateStream = useCallback((kind: 'mic' | 'cam', nextTrack: MediaStreamTrack | null) => {
    const oldTrack = kind === 'mic' ? audioTrackRef.current : videoTrackRef.current;
    const currentTracks = (streamRef.current?.getTracks() || []).filter((track) => track !== oldTrack);
    if (oldTrack && oldTrack !== nextTrack) oldTrack.stop();

    if (kind === 'mic') audioTrackRef.current = nextTrack || null;
    else videoTrackRef.current = nextTrack || null;
    if (nextTrack) currentTracks.push(nextTrack);

    // Always publish a new MediaStream object so React/WebRTC consumers can
    // react to a physical device switch even when the enabled state is unchanged.
    const nextStream = new MediaStream(currentTracks);
    streamRef.current = nextStream;
    setStream(nextStream);
    setIsMicOn(Boolean(audioTrackRef.current?.enabled));
    setIsCamOn(Boolean(videoTrackRef.current?.enabled));
  }, []);

  const acquireTrack = useCallback(async (kind: 'mic' | 'cam', deviceId = ''): Promise<MediaStreamTrack> => {
    const constraints = kind === 'mic'
      ? { audio: deviceId ? { deviceId: { exact: deviceId } } : true }
      : { video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        } };

    const media = await navigator.mediaDevices.getUserMedia(constraints);
    const track = kind === 'mic' ? media.getAudioTracks()[0] : media.getVideoTracks()[0];
    if (!track) throw new Error('NO_TRACK');
    return track;
  }, []);

  const switchDevice = useCallback(async (kind: 'mic' | 'cam', deviceId: string): Promise<MediaResult> => {
    const currentTrack = kind === 'mic' ? audioTrackRef.current : videoTrackRef.current;
    const previousEnabled = currentTrack?.enabled ?? true;
    try {
      const nextTrack = await acquireTrack(kind, deviceId);
      nextTrack.enabled = previousEnabled;
      updateStream(kind, nextTrack);
      setSelectedDevices((current) => ({ ...current, [kind]: deviceId }));
      setErrors((current) => ({ ...current, [kind]: null }));
      await refreshDevices();
      return { ok: true };
    } catch (error) {
      setErrors((current) => ({ ...current, [kind]: getErrorMessage(kind, error) }));
      return { ok: false, error: getErrorMessage(kind, error) };
    }
  }, [acquireTrack, refreshDevices, updateStream]);

  useEffect(() => {
    let cancelled = false;
    let localAudio;
    let localVideo;

    async function init() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrors({ mic: 'Браузер не поддерживает доступ к микрофону.', cam: 'Браузер не поддерживает доступ к камере.' });
        setStatus('error');
        return;
      }

      setStatus('requesting');
      const nextErrors = { mic: null, cam: null };

      // Keep permissions independent: failure of one device must not block the other.
      try {
        localAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
        const track = localAudio.getAudioTracks()[0];
        if (track) {
          audioTrackRef.current = track;
          track.onended = () => {
            if (audioTrackRef.current !== track) return;
            audioTrackRef.current = null;
            setIsMicOn(false);
            setErrors((current) => ({ ...current, mic: 'Микрофон стал недоступен.' }));
            setStream((current) => {
              const next = new MediaStream((current?.getTracks() || []).filter((item) => item !== track));
              streamRef.current = next;
              return next;
            });
          };
        }
      } catch (error) {
        nextErrors.mic = getErrorMessage('mic', error);
      }

      try {
        localVideo = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
        const track = localVideo.getVideoTracks()[0];
        if (track) {
          videoTrackRef.current = track;
          track.onended = () => {
            if (videoTrackRef.current !== track) return;
            videoTrackRef.current = null;
            setIsCamOn(false);
            setErrors((current) => ({ ...current, cam: 'Камера стала недоступна.' }));
            setStream((current) => {
              const next = new MediaStream((current?.getTracks() || []).filter((item) => item !== track));
              streamRef.current = next;
              return next;
            });
          };
        }
      } catch (error) {
        nextErrors.cam = getErrorMessage('cam', error);
      }

      if (cancelled) {
        localAudio?.getTracks().forEach((track) => track.stop());
        localVideo?.getTracks().forEach((track) => track.stop());
        return;
      }

      const nextStream = new MediaStream(
        [audioTrackRef.current, videoTrackRef.current].filter(Boolean),
      );
      streamRef.current = nextStream;
      setStream(nextStream);
      setIsMicOn(Boolean(audioTrackRef.current));
      setIsCamOn(Boolean(videoTrackRef.current));
      setErrors(nextErrors);
      setStatus(nextStream.getTracks().length ? 'ready' : 'error');
      await refreshDevices();

      const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (!cancelled) {
        const audioDevice = all.find((device) => device.kind === 'audioinput' && device.deviceId === audioTrackRef.current?.getSettings?.().deviceId);
        const videoDevice = all.find((device) => device.kind === 'videoinput' && device.deviceId === videoTrackRef.current?.getSettings?.().deviceId);
        setSelectedDevices({ mic: audioDevice?.deviceId || '', cam: videoDevice?.deviceId || '' });
      }
    }

    void init();

    const onDeviceChange = () => { void refreshDevices(); };
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);

    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      localAudio?.getTracks().forEach((track) => track.stop());
      localVideo?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      audioTrackRef.current = null;
      videoTrackRef.current = null;
    };
  }, [refreshDevices]);

  const toggleMic = useCallback((): MediaResult => {
    const track = audioTrackRef.current;
    if (!track) return { ok: false, enabled: false, error: errors.mic || 'Микрофон недоступен.' };
    track.enabled = !track.enabled;
    setIsMicOn(track.enabled);
    return { ok: true, enabled: track.enabled };
  }, [errors.mic]);

  const toggleCam = useCallback(async (): Promise<MediaResult> => {
    const track = videoTrackRef.current;
    if (!track) {
      try {
        const nextTrack = await acquireTrack('cam', selectedDevices.cam);
        nextTrack.enabled = true;
        updateStream('cam', nextTrack);
        setErrors((current) => ({ ...current, cam: null }));
        await refreshDevices();
        return { ok: true, enabled: true };
      } catch (error) {
        const message = getErrorMessage('cam', error);
        setErrors((current) => ({ ...current, cam: message }));
        return { ok: false, enabled: false, error: message };
      }
    }

    // Fully release the physical camera when it is turned off. WebRTC keeps
    // the peer connection alive and useWebRTC replaces the sender track with
    // null, so turning the camera back on does not recreate the peer.
    track.stop();
    const remaining = (streamRef.current?.getTracks() || []).filter((item) => item !== track);
    videoTrackRef.current = null;
    const nextStream = new MediaStream(remaining);
    streamRef.current = nextStream;
    setStream(nextStream);
    setIsCamOn(false);
    return { ok: true, enabled: false };
  }, [acquireTrack, errors.cam, refreshDevices, selectedDevices.cam, updateStream]);

  return {
    stream,
    isMicOn,
    isCamOn,
    errors,
    status,
    devices,
    selectedDevices,
    toggleMic,
    toggleCam,
    switchDevice,
    refreshDevices,
  };
}
