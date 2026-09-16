import type { ValidationResult } from './types.js';

const NAME_RE = /^[a-zA-Zа-яА-ЯёЁ0-9\s-]+$/u;
const ROOM_ID_RE = /^[a-zA-Z0-9_-]+$/;

export function validateRoomId(value: unknown): ValidationResult {
  if (typeof value !== 'string' || value.length < 6 || value.length > 32 || !ROOM_ID_RE.test(value)) {
    return { ok: false, error: 'Некорректный идентификатор комнаты.' };
  }
  return { ok: true, value };
}

export function validateName(value: unknown): ValidationResult {
  if (typeof value !== 'string') return { ok: false, error: 'Имя обязательно.' };
  const name = value.trim();
  if (!name) return { ok: false, error: 'Введите имя.' };
  if (name.length > 30) return { ok: false, error: 'Имя должно содержать не более 30 символов.' };
  if (!NAME_RE.test(name)) return { ok: false, error: 'Имя содержит недопустимые символы.' };
  return { ok: true, value: name };
}

export function validateMessage(value: unknown): ValidationResult {
  if (typeof value !== 'string') return { ok: false, error: 'Сообщение обязательно.' };
  const text = value.trim();
  if (!text) return { ok: false, error: 'Сообщение не может быть пустым.' };
  if (text.length > 1000) return { ok: false, error: 'Сообщение должно содержать не более 1000 символов.' };
  return { ok: true, value: text };
}

export function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
