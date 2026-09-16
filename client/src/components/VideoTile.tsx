import { useEffect, useRef } from 'react';

export function VideoTile({ stream, name, isLocal = false, isCamOn = true, isMicOn = true, peerState = undefined }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    video.srcObject = stream || null;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const showVideo = Boolean(stream && isCamOn);
  const placeholderText = !isCamOn ? 'Камера выключена' : (stream ? 'Видео недоступно' : 'Ожидаем видео…');

  return (
    <article className="video-tile">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={showVideo ? '' : 'video-hidden'}
      />
      {!showVideo && (
        <div className="video-placeholder">
          <div className="avatar">{name?.slice(0, 1).toUpperCase() || '?'}</div>
          <span>{placeholderText}</span>
        </div>
      )}
      <div className="video-tile-footer">
        <strong>{name}{isLocal ? ' (вы)' : ''}</strong>
        <span className="tile-status">
          <span>{isMicOn ? '🎙' : '🔇'}</span>
          {!isLocal && peerState && <small>{peerState === 'connected' ? 'подключено' : peerState}</small>}
        </span>
      </div>
    </article>
  );
}
