import { useEffect, useRef, useState } from 'react';

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesRef = useRef(null);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  async function submit(event) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;

    setSending(true);
    setError('');
    const result = await onSend(value);
    if (result?.ok) {
      setText('');
    } else {
      setError(result?.error || 'Не удалось отправить сообщение.');
    }
    setSending(false);
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit(event);
    }
  }

  return (
    <div className="chat-panel-content">
      <div className="chat-messages" ref={messagesRef} aria-live="polite">
        {messages.length === 0 && <p className="chat-empty">Сообщений пока нет. Напишите первым.</p>}
        {messages.map((message) => (
          <article className={`chat-message chat-message-${message.type}`} key={message.id}>
            {message.type === 'system' ? (
              <>
                <span>{message.text}</span>
              </>
            ) : (
              <>
                <div className="chat-message-meta">
                  <strong>{message.senderName}</strong>
                  {message.createdAt && <time>{formatTime(message.createdAt)}</time>}
                </div>
                <span>{message.text}</span>
              </>
            )}
          </article>
        ))}
      </div>

      <form className="chat-composer" onSubmit={submit}>
        <textarea
          value={text}
          maxLength={1000}
          rows={2}
          placeholder="Напишите сообщение…"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          aria-label="Сообщение"
        />
        <button type="submit" disabled={!text.trim() || sending}>
          {sending ? 'Отправка…' : 'Отправить'}
        </button>
      </form>
      <div className="chat-footer">
        <span>{text.length}/1000</span>
        <span>Enter — отправить · Shift+Enter — новая строка</span>
      </div>
      {error && <p className="form-error chat-error">{error}</p>}
    </div>
  );
}
