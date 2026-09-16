# Release checklist

## User-verified

- [x] Создание комнаты
- [x] Вход по ссылке
- [x] Несуществующий room ID создаёт новую комнату
- [x] Одинаковые имена разрешены
- [x] Максимум 4 участника
- [x] 5-й участник получает состояние заполненной комнаты и не попадает в активную комнату
- [x] WebRTC на 4 участниках: аудио и видео
- [x] Чат
- [x] Устройства
- [x] Перезагрузка страницы
- [x] Выход из комнаты
- [x] Повторный вход
- [x] Недоступный сервер обрабатывается до входа в активную комнату

## Automated / local checks

- [x] TypeScript source/typecheck smoke-check выполнен без внутренних ошибок (с локальными ambient shims, так как npm registry недоступен в текущей среде)
- [x] Backend test suite ранее проходила: 8/8
- [x] Production `npm run build`

## TypeScript migration

- [x] Frontend `.js/.jsx` → `.ts/.tsx`
- [x] Backend `.js` → `.ts`
- [x] Server tests `.js` → `.ts`
- [x] Added shared client/server domain types
- [x] Added TypeScript configs and npm scripts
- [x] Added npm workspaces for one-command dependency installation

## Known scope

- Нет TURN.
- Нет persistent storage.
- Нет автоматического reconnect.
