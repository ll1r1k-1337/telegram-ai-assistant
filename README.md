# telegram-ai-assistant

Chrome Extension (Manifest V3) для web.telegram.org — AI-подсказки по ответам в чатах.

## Концепция

- Расширение встраивается в web.telegram.org
- Читает контекст чата (последние сообщения)
- Генерирует AI-подсказки по ответу через настраиваемый провайдер (OpenAI, Anthropic, Ollama и др.)
- Авторизация в Telegram через webcookie (без API ключей Telegram)

## Стек

- Chrome Extension (Manifest V3)
- TypeScript
- Content Scripts (инъекция в web.telegram.org)
- Background Service Worker (AI API запросы)
- Popup/Options page (настройки провайдера)

## Структура

```
src/
├── manifest.json
├── background/        # Service Worker — AI API, cookie management
├── content/           # Content Script — DOM, UI injection
├── popup/             # Popup — быстрые настройки
├── options/           # Options page — провайдер, API key, модель
├── lib/               # Общие утилиты, типы
│   ├── providers/     # AI провайдеры (OpenAI, Anthropic, Ollama)
│   ├── telegram/      # Telegram DOM parsing, cookie auth
│   └── types.ts
└── assets/            # Иконки, стили
```
