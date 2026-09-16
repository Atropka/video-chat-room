import { VideoTile } from './VideoTile';

export function VideoGrid({ local, participants, remoteStreams = {}, peerStates = {} }) {
  return (
    <div className={`video-grid video-grid-${Math.max(1, participants.length + 1)}`}>
      <VideoTile
        stream={local.stream}
        name={local.name}
        isLocal
        isCamOn={local.isCamOn}
        isMicOn={local.isMicOn}
      />
      {participants.map((participant) => (
        <VideoTile
          key={participant.id}
          stream={remoteStreams[participant.id]}
          name={participant.name}
          isCamOn={participant.isCamOn}
          isMicOn={participant.isMicOn}
          peerState={peerStates[participant.id]}
        />
      ))}
    </div>
  );
}
