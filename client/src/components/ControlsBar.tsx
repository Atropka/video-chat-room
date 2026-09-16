function MicIcon({ off = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="control-icon">
      <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      {off && <path d="m4 4 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>}
    </svg>
  );
}

function CameraIcon({ off = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="control-icon">
      <path d="M4.5 7.5h10.2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8"/>
      <path d="m16.7 10.5 4-2.2v7.4l-4-2.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      {off && <path d="m4 4 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>}
    </svg>
  );
}

export function ControlsBar({
  isMicOn,
  isCamOn,
  onToggleMic,
  onToggleCam,
  devices,
  selectedDevices,
  onDeviceChange,
}) {
  return (
    <div className="controls-wrap">
      <div className="controls-bar">
        <button aria-label={isMicOn ? 'Выключить микрофон' : 'Включить микрофон'} title={isMicOn ? 'Выключить микрофон' : 'Включить микрофон'} className={`control-button ${!isMicOn ? 'control-off' : ''}`} onClick={onToggleMic}>
          <MicIcon off={!isMicOn} />
          <span>{isMicOn ? 'Микрофон' : 'Микрофон выключен'}</span>
        </button>
        <button aria-label={isCamOn ? 'Выключить камеру' : 'Включить камеру'} title={isCamOn ? 'Выключить камеру' : 'Включить камеру'} className={`control-button ${!isCamOn ? 'control-off' : ''}`} onClick={onToggleCam}>
          <CameraIcon off={!isCamOn} />
          <span>{isCamOn ? 'Камера' : 'Камера выключена'}</span>
        </button>
      </div>
      <div className="device-controls">
        <label>
          <span>Микрофон</span>
          <select value={selectedDevices.mic} onChange={(event) => onDeviceChange('mic', event.target.value)} disabled={!devices.audioInputs.length}>
            {devices.audioInputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Микрофон ${index + 1}`}</option>)}
          </select>
        </label>
        <label>
          <span>Камера</span>
          <select value={selectedDevices.cam} onChange={(event) => onDeviceChange('cam', event.target.value)} disabled={!devices.videoInputs.length}>
            {devices.videoInputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Камера ${index + 1}`}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
