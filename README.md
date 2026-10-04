# Global Community Chat

Анонимный чат сообщества: общие чаты по городу, району, школе и университету, группы,
каналы, уведомления и сообщения в реальном времени.

| Папка | Что это | Технологии |
|---|---|---|
| `chat-front` | сайт | Next.js, React, TanStack Query, Axios |
| `chat-beck` | REST API + WebSocket (`/ws`) | Express, TypeScript, ws |
| — | база и вход | Supabase (PostgreSQL, Auth, Google OAuth) |

Подробная настройка Supabase, ключей и Google — в [НАСТРОЙКА.md](НАСТРОЙКА.md).

## Локальный запуск

```
cd chat-beck
cp .env.example .env        # заполнить значения
npm install
npm run dev                 # http://localhost:5000, WebSocket ws://localhost:5000/ws
```

```
cd chat-front
cp .env.local.example .env.local   # заполнить значения
npm install
npm run dev                 # http://localhost:3000
```

Файлы `.env` и `.env.local` в git не попадают. В репозитории только примеры без значений.

## Переменные окружения

### Frontend (`chat-front`, Vercel)

| Переменная | Пример для production |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.onrender.com/api` |
| `NEXT_PUBLIC_WS_URL` | `wss://your-backend.onrender.com/ws` (необязательно — иначе берётся из API URL) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | публичный anon / publishable key |

### Backend (`chat-beck`, Node-хостинг)

| Переменная | Значение |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | публичный ключ |
| `SUPABASE_SERVICE_ROLE_KEY` | секретный ключ — только здесь |
| `FRONTEND_URL` | `https://your-app.vercel.app` (можно несколько через запятую) |
| `MEMBER_ID_SECRET` | случайная строка от 32 символов |
| `ANTHROPIC_API_KEY` | необязательно |
| `PORT` | обычно задаёт хостинг сам |

## Деплой

### Frontend → Vercel

- Import Git Repository → этот репозиторий
- **Root Directory:** `chat-front`
- Framework Preset: Next.js
- Install Command: `npm install`, Build Command: `npm run build`
- Environment Variables — из таблицы «Frontend» выше

### Backend + WebSocket → Render / Railway / Fly.io

Backend — постоянный Node-процесс (WebSocket не работает в serverless-функциях Vercel).

- Root Directory: `chat-beck`
- Build Command: `npm install --include=dev && npm run build` (TypeScript нужен для сборки)
- Start Command: `npm start`
- Health check: `/api/health`
- Environment Variables — из таблицы «Backend» выше

### После деплоя

1. В backend `FRONTEND_URL` — точный адрес сайта на Vercel (без `/` в конце).
2. Supabase → Authentication → URL Configuration: Site URL — адрес Vercel; в Redirect URLs добавить
   `https://your-app.vercel.app/auth/callback` и `https://your-app.vercel.app/auth/reset-password`
   (локальные адреса оставить).
3. Google Cloud → OAuth client → Authorized JavaScript origins: добавить адрес Vercel.
   Redirect URI (Supabase callback) не меняется.
