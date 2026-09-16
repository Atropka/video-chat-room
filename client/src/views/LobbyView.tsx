import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { NameForm } from '../components/NameForm';

export function LobbyView() {
  const [mode, setMode] = useState('home');
  const [roomLink, setRoomLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  function createRoom(value) {
    navigate(`/room/${nanoid(10)}/prejoin`, { state: { name: value } });
  }

  function enterRoom(event) {
    event.preventDefault();
    const value = roomLink.trim();
    const match = value.match(/\/room\/([a-zA-Z0-9_-]+)\/?(?:\?.*)?(?:#.*)?$/);
    const roomId = match?.[1] || value;

    if (!/^[a-zA-Z0-9_-]{6,32}$/.test(roomId)) {
      setLinkError('Введите корректную ссылку на комнату или её ID.');
      return;
    }

    setLinkError('');
    navigate(`/room/${roomId}/prejoin`);
  }

  if (mode === 'create') {
    return (
      <main className="page lobby">
        <NameForm
          title="Создать комнату"
          description="До 4 участников. Без регистрации и лишних настроек."
          submitLabel="Создать комнату"
          initialValue={name}
          onSubmit={createRoom}
        />
        <button className="secondary-action" onClick={() => setMode('home')}>
          Назад
        </button>
      </main>
    );
  }

  if (mode === 'join') {
    return (
      <main className="page lobby">
        <section className="lobby-card">
          <div className="brand-mark">VC</div>
          <p className="eyebrow">VIDEO CHAT ROOM</p>
          <h1>Войти по ссылке</h1>
          <p className="muted">Вставьте ссылку на комнату или введите её ID.</p>
          <form onSubmit={enterRoom} className="name-form">
            <label htmlFor="room-link">Ссылка или ID комнаты</label>
            <input
              id="room-link"
              value={roomLink}
              onChange={(event) => setRoomLink(event.target.value)}
              placeholder="https://.../room/AbCd1234"
              autoComplete="off"
              autoFocus
            />
            {linkError && <p className="form-error">{linkError}</p>}
            <button type="submit">Продолжить</button>
          </form>
        </section>
        <button className="secondary-action" onClick={() => setMode('home')}>
          Назад
        </button>
      </main>
    );
  }

  return (
    <main className="page lobby">
      <section className="lobby-card lobby-home-card">
        <div className="brand-mark">VC</div>
        <p className="eyebrow">VIDEO CHAT ROOM</p>
        <h1>Видеоразговор без регистрации</h1>
        <p className="muted">Создайте комнату или войдите по ссылке. В комнате может быть до 4 участников.</p>
        <div className="lobby-actions">
          <button onClick={() => setMode('create')}>Создать комнату</button>
          <button className="secondary-button" onClick={() => setMode('join')}>Войти по ссылке</button>
        </div>
      </section>
    </main>
  );
}
