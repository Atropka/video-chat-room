import { useState } from 'react';

const NAME_RE = /^[a-zA-Zа-яА-ЯёЁ0-9\s-]+$/u;

export function NameForm({ title, description, submitLabel, initialValue = '', onSubmit }) {
  const [name, setName] = useState(initialValue);
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    const value = name.trim();

    if (!value) {
      setError('Введите имя.');
      return;
    }
    if (value.length > 30) {
      setError('Имя должно содержать не более 30 символов.');
      return;
    }
    if (!NAME_RE.test(value)) {
      setError('Имя содержит недопустимые символы.');
      return;
    }

    setError('');
    onSubmit(value);
  }

  return (
    <section className="lobby-card">
      <div className="brand-mark">VC</div>
      <p className="eyebrow">VIDEO CHAT ROOM</p>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      <form onSubmit={submit} className="name-form">
        <label htmlFor="name">Ваше имя</label>
        <input
          id="name"
          value={name}
          maxLength={30}
          onChange={(event) => setName(event.target.value)}
          placeholder="Например, Анна"
          autoComplete="name"
          autoFocus
        />
        {error && <p className="form-error">{error}</p>}
        <button type="submit">{submitLabel}</button>
      </form>
    </section>
  );
}
