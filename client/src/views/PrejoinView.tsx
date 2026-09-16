import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMediaStream } from '../hooks/useMediaStream';

function formatDeviceLabel(device, kind, index) {
  if (device.label) return device.label;
  const prefix = kind === 'mic' ? 'Микрофон' : kind === 'cam' ? 'Камера' : 'Динамики';
  return `${prefix} ${index + 1}`;
}

export function PrejoinView() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const media = useMediaStream();
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedOutput, setSelectedOutput] = useState('default');
  const [speakerStatus, setSpeakerStatus] = useState('idle');
  const [name, setName] = useState(location.state?.name || '');
  const [nameError, setNameError] = useState('');
  const joinError = location.state?.joinError || null;

  const audioInputCount = media.devices.audioInputs.length;
  const videoInputCount = media.devices.videoInputs.length;
  const webRTCSupported = typeof window !== 'undefined' && typeof window.RTCPeerConnection === 'function';
  const canProceed = Boolean(name.trim()) && webRTCSupported;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.srcObject = media.stream || null;
    return () => { video.srcObject = null; };
  }, [media.stream]);

  useEffect(() => {
    let cancelled = false;
    async function loadOutputs() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (!cancelled) setAudioOutputs(all.filter((device) => device.kind === 'audiooutput'));
    }
    void loadOutputs();
    const onChange = () => { void loadOutputs(); };
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
    };
  }, [media.status]);

  useEffect(() => {
    const track = media.stream?.getAudioTracks()[0];
    if (!track || !media.isMicOn || !window.AudioContext) {
      setMicLevel(0);
      return undefined;
    }

    const context = new AudioContext();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    audioContextRef.current = context;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);
      setMicLevel(Math.min(100, Math.round(rms * 260)));
      animationRef.current = requestAnimationFrame(tick);
    };

    void context.resume().catch(() => {});
    tick();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      analyserRef.current = null;
      audioContextRef.current = null;
      source.disconnect();
      analyser.disconnect();
      void context.close().catch(() => {});
      setMicLevel(0);
    };
  }, [media.stream, media.isMicOn]);

  async function playSpeakerTest() {
    const audio = audioRef.current;
    if (!audio) return;
    setSpeakerStatus('testing');
    audio.currentTime = 0;
    audio.volume = 0.55;
    if (typeof audio.setSinkId === 'function') {
      try { await audio.setSinkId(selectedOutput || 'default'); } catch { /* fallback to default */ }
    }
    try {
      await audio.play();
      audio.onended = () => setSpeakerStatus('done');
    } catch {
      setSpeakerStatus('error');
    }
  }

  function continueToRoom(event) {
    event.preventDefault();
    const value = name.trim();
    if (!value) {
      setNameError('Введите имя.');
      return;
    }
    if (value.length > 30) {
      setNameError('Имя должно содержать не более 30 символов.');
      return;
    }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9\s-]+$/u.test(value)) {
      setNameError('Имя содержит недопустимые символы.');
      return;
    }
    navigate(`/room/${roomId}`, { replace: true, state: { name: value } });
  }

  const micStatus = media.errors.mic
    ? media.errors.mic
    : media.isMicOn && media.stream?.getAudioTracks().length
      ? 'Микрофон работает'
      : 'Микрофон выключен';
  const camStatus = media.errors.cam
    ? media.errors.cam
    : media.isCamOn && media.stream?.getVideoTracks().length
      ? 'Камера работает'
      : 'Камера выключена';

  return (
    <main className="page prejoin-page">
      <section className="prejoin-card">
        <div className="prejoin-header">
          <div>
            <p className="eyebrow">VIDEO CHAT ROOM</p>
            <h1>Проверка устройств</h1>
            <p className="muted">Проверьте камеру, микрофон и звук перед входом в комнату.</p>
          </div>
          <span className="prejoin-room">Комната {roomId}</span>
        </div>

        {!webRTCSupported && (
          <section className="error-banner media-error-banner">
            <strong>WebRTC не поддерживается</strong>
            <span>Откройте приложение в современном Chrome, Firefox или Edge.</span>
          </section>
        )}

        {joinError && (
          <section className="error-banner media-error-banner">
            <strong>{joinError.code === 'ROOM_FULL' ? 'Комната заполнена' : 'Ошибка подключения'}</strong>
            <span>{joinError.message}</span>
          </section>
        )}

        <div className="prejoin-grid">
          <section className="device-test-card camera-test">
            <div className="test-card-heading"><div><h2>Камера</h2><p>{camStatus}</p></div><span className={media.errors.cam ? 'status-dot status-bad' : 'status-dot'} /></div>
            <div className="preview-frame">
              <video ref={videoRef} autoPlay playsInline muted className={media.isCamOn && media.stream?.getVideoTracks().length ? '' : 'video-hidden'} />
              {(!media.isCamOn || !media.stream?.getVideoTracks().length) && <div className="preview-placeholder">Камера не передаёт видео</div>}
            </div>
            <label className="device-select-label"><span>Устройство</span><select value={media.selectedDevices.cam} onChange={(event) => media.switchDevice('cam', event.target.value)} disabled={!videoInputCount}>
              {media.devices.videoInputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{formatDeviceLabel(device, 'cam', index)}</option>)}
            </select></label>
            <button className={`test-toggle ${media.isCamOn ? '' : 'off'}`} onClick={media.toggleCam}>{media.isCamOn ? 'Выключить камеру' : 'Включить камеру'}</button>
          </section>

          <section className="device-test-card">
            <div className="test-card-heading"><div><h2>Микрофон</h2><p>{micStatus}</p></div><span className={media.errors.mic ? 'status-dot status-bad' : 'status-dot'} /></div>
            <div className="mic-meter">
              <div className="meter-label"><span>Уровень сигнала</span><strong>{micLevel}%</strong></div>
              <div className="meter-track"><div className="meter-fill" style={{ width: `${micLevel}%` }} /></div>
              <p>{media.isMicOn ? 'Скажите что-нибудь — шкала должна реагировать на голос.' : 'Включите микрофон, чтобы проверить сигнал.'}</p>
            </div>
            <label className="device-select-label"><span>Устройство</span><select value={media.selectedDevices.mic} onChange={(event) => media.switchDevice('mic', event.target.value)} disabled={!audioInputCount}>
              {media.devices.audioInputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{formatDeviceLabel(device, 'mic', index)}</option>)}
            </select></label>
            <button className={`test-toggle ${media.isMicOn ? '' : 'off'}`} onClick={media.toggleMic}>{media.isMicOn ? 'Выключить микрофон' : 'Включить микрофон'}</button>
          </section>
        </div>

        <section className="device-test-card speaker-test">
          <div className="test-card-heading"><div><h2>Динамики</h2><p>{speakerStatus === 'testing' ? 'Проигрываем тестовый звук…' : speakerStatus === 'done' ? 'Тест завершён' : speakerStatus === 'error' ? 'Не удалось запустить звук' : 'Проверьте, слышен ли тестовый звук.'}</p></div><span className={speakerStatus === 'error' ? 'status-dot status-bad' : 'status-dot'} /></div>
          <div className="speaker-row">
            <select value={selectedOutput} onChange={(event) => setSelectedOutput(event.target.value)} disabled={!audioOutputs.length}>
              {audioOutputs.length ? audioOutputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{formatDeviceLabel(device, 'output', index)}</option>) : <option value="default">Системные динамики</option>}
            </select>
            <button className="test-toggle" onClick={playSpeakerTest}>▶ Проверить звук</button>
          </div>
          <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=" />
          <p className="speaker-note">Если браузер не позволяет выбрать устройство вывода, тест будет воспроизведён через системные динамики.</p>
        </section>

        <form className="prejoin-name" onSubmit={continueToRoom}>
          <div><h2>Ваше имя</h2><p className="muted">Под этим именем вас увидят участники комнаты.</p></div>
          <input value={name} maxLength={30} onChange={(event) => { setName(event.target.value); setNameError(''); }} placeholder="Например, Анна" autoComplete="name" />
          {nameError && <p className="form-error">{nameError}</p>}
          <div className="prejoin-actions">
            <button type="button" className="secondary-button" onClick={() => navigate('/', { replace: true })}>Назад</button>
            <button type="submit" disabled={!canProceed}>Войти в комнату</button>
          </div>
        </form>
      </section>
    </main>
  );
}
