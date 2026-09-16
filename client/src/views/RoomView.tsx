import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { RoomProvider, useRoom } from '../context/RoomContext';
import { VideoGrid } from '../components/VideoGrid';
import { ControlsBar } from '../components/ControlsBar';
import { ChatPanel } from '../components/ChatPanel';

function RoomContent({ name, roomId }) {
  const navigate = useNavigate();
  const {
    connectionState,
    participants,
    messages,
    error,
    stream,
    isMicOn,
    isCamOn,
    mediaErrors,
    mediaStatus,
    devices,
    selectedDevices,
    toggleMic,
    toggleCam,
    switchDevice,
    remoteStreams,
    peerStates,
    selfId,
    sendMessage,
  } = useRoom();

  useEffect(() => {
    if (!error) return;
    navigate(`/room/${roomId}/prejoin`, {
      replace: true,
      state: { name, joinError: { code: error.code, message: error.message } },
    });
  }, [error, name, navigate, roomId]);

  const leaveRoom = () => {
    navigate('/', { replace: true });
  };

  return (
    <main className="page room-page">
      <header className="room-header">
        <div>
          <p className="eyebrow">VIDEO CHAT ROOM</p>
          <h1>Комната</h1>
        </div>
        <div className="room-meta">
          <span>{roomId}</span>
          <span className={`connection-status connection-${connectionState}`}>{connectionState}</span>
          <button className="leave-room-button" onClick={leaveRoom}>Выйти из комнаты</button>
        </div>
      </header>

      {(mediaErrors.mic || mediaErrors.cam) && (
        <section className="error-banner media-error-banner">
          <strong>Доступ к устройствам</strong>
          <div>
            {mediaErrors.mic && <span>{mediaErrors.mic}</span>}
            {mediaErrors.cam && <span>{mediaErrors.cam}</span>}
          </div>
        </section>
      )}

      <section className="room-shell">
        <div className="room-main">
          <div className="video-stage">
            <VideoGrid
              local={{ stream, name, isCamOn, isMicOn }}
              participants={participants}
              remoteStreams={remoteStreams}
              peerStates={peerStates}
            />

            <div className="media-status-row">
              <span>
                {mediaStatus === 'requesting' && 'Запрашиваем доступ к камере и микрофону…'}
                {mediaStatus === 'ready' && 'Камера и микрофон готовы'}
                {mediaStatus === 'error' && 'Некоторые устройства недоступны'}
              </span>
            </div>
          </div>

          <ControlsBar
            isMicOn={isMicOn}
            isCamOn={isCamOn}
            onToggleMic={toggleMic}
            onToggleCam={toggleCam}
            devices={devices}
            selectedDevices={selectedDevices}
            onDeviceChange={switchDevice}
          />
        </div>

        <aside className="room-sidebar">
          <div className="panel">
            <h2>Участники</h2>
            <div className="participant-list">
              <div className="participant-row">
                <span>{name}</span>
                <small>{isMicOn ? 'Микрофон' : 'Без микрофона'}</small>
              </div>
              {participants.map((participant) => (
                <div className="participant-row" key={participant.id}>
                  <span>{participant.name}</span>
                  <small>{participant.isMicOn ? 'Микрофон' : 'Без микрофона'}</small>
                </div>
              ))}
            </div>
          </div>

          <div className="panel chat-panel">
            <div className="panel-heading">
              <h2>Чат</h2>
              <span>{messages.length}</span>
            </div>
            <ChatPanel messages={messages} onSend={sendMessage} />
          </div>
        </aside>
      </section>
    </main>
  );
}

export function RoomView() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [enteredName, setEnteredName] = useState<string>(location.state?.name || '');
  const name = enteredName.trim();

  useEffect(() => {
    if (!name) {
      navigate(`/room/${roomId}/prejoin`, { replace: true });
    }
  }, [name, navigate, roomId]);

  if (!name) return null;

  return (
    <RoomProvider roomId={roomId} name={name}>
      <RoomContent name={name} roomId={roomId} />
    </RoomProvider>
  );
}
