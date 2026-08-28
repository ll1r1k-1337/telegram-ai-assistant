# Запись GIF-демо

## Инструменты

- [ScreenToGif](https://www.screentogif.com/) (Windows) — бесплатный, с редактором
- Или: Chrome DevTools → Performance → Screenshot → ffmpeg

## Сценарий записи

1. Открыть web.telegram.org в Chrome
2. Убедиться что расширение включено (иконка 🤖 активна)
3. Открыть чат с несколькими входящими сообщениями
4. Показать появление панели подсказок
5. Кликнуть по одной из подсказок — текст вставляется в поле ввода
6. Показать переключение темы (light ↔ dark)

## Технические требования

- Разрешение: 1280×720 или 1440×900
- FPS: 15–20 (для компактного размера)
- Продолжительность: 8–15 секунд
- Формат: GIF (для README) + MP4 (для landing page)
- Максимальный размер GIF: 5 MB (GitHub отображает до ~10 MB)

## Оптимизация размера

```bash
# Конвертация MP4 → GIF через ffmpeg
ffmpeg -i demo.mp4 -vf "fps=15,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 demo.gif

# Оптимизация через gifsicle
gifsicle -O3 --lossy=80 demo.gif -o demo-opt.gif
```

## Расположение файлов

- `docs/demo.gif` — основной GIF для README
- `docs/demo.mp4` — видео-версия для landing page
- `docs/screenshot-popup.png` — скриншот popup
- `docs/screenshot-options.png` — скриншот options page
- `docs/screenshot-suggestions.png` — скриншот подсказок в чате
