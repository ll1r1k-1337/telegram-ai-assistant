#!/usr/bin/env python3
"""
Native Messaging Host — bridges Chrome extension ↔ Claude Code CLI.

Protocol (Chrome Native Messaging):
  - Reads from stdin: 4-byte LE length prefix, then JSON payload.
  - Writes to stdout: 4-byte LE length prefix, then JSON payload.

Each request:  {"type": "GENERATE", "prompt": "...", "model": "..."}
Each response: {"type": "RESULT", "text": "..."} or {"type": "ERROR", "error": "..."}
"""
from __future__ import annotations

import json
import struct
import subprocess
import sys
import os
from typing import Any

# Max message size (1 MB — Chrome's hard limit)
MAX_MSG_SIZE = 1024 * 1024


def read_message() -> dict[str, Any] | None:
    """Read one Native Messaging message from stdin (4-byte LE length + JSON)."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None
    length = struct.unpack("<I", raw_length)[0]
    if length > MAX_MSG_SIZE:
        return None
    data = sys.stdin.buffer.read(length)
    if len(data) < length:
        return None
    return json.loads(data)


def send_message(msg: dict[str, Any]) -> None:
    """Write one Native Messaging message to stdout (4-byte LE length + JSON)."""
    encoded = json.dumps(msg, ensure_ascii=False).encode("utf-8")
    length = len(encoded)
    sys.stdout.buffer.write(struct.pack("<I", length))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def find_claude_cli() -> str:
    """Locate the Claude Code (hermes) CLI binary."""
    # 1. Explicit env override
    env_bin = os.environ.get("CLAUDE_CLI_PATH")
    if env_bin and os.path.isfile(env_bin):
        return env_bin

    # 2. Try 'claude' then 'hermes' on PATH
    for name in ("claude", "hermes"):
        # Windows: check .exe and .cmd variants
        if sys.platform == "win32":
            for ext in (".cmd", ".exe", ""):
                candidate = name + ext
                # shutil.which equivalent via os.path
                import shutil
                found = shutil.which(candidate)
                if found:
                    return found
        else:
            import shutil
            found = shutil.which(name)
            if found:
                return found

    raise FileNotFoundError(
        "Claude Code CLI not found. Install it or set CLAUDE_CLI_PATH."
    )


def call_claude(prompt: str, model: str | None = None) -> str:
    """
    Run `claude -p <prompt>` and return the text output.

    Uses --output-format text for clean text without JSON wrapper.
    """
    cli = find_claude_cli()
    cmd = [cli, "-p", prompt, "--output-format", "text"]
    if model:
        cmd.extend(["--model", model])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        stderr = result.stderr.strip()
        raise RuntimeError(
            f"claude exited {result.returncode}: {stderr[:500]}"
        )

    return result.stdout.strip()


def main() -> None:
    """Main loop: read requests, call Claude, send responses."""
    while True:
        msg = read_message()
        if msg is None:
            break

        msg_type = msg.get("type", "")

        if msg_type == "PING":
            send_message({"type": "PONG", "version": "1.0.0"})
            continue

        if msg_type == "GENERATE":
            prompt = msg.get("prompt", "")
            model = msg.get("model") or None
            if not prompt:
                send_message({"type": "ERROR", "error": "Empty prompt"})
                continue
            try:
                text = call_claude(prompt, model)
                send_message({"type": "RESULT", "text": text})
            except FileNotFoundError as exc:
                send_message({"type": "ERROR", "error": str(exc)})
            except subprocess.TimeoutExpired:
                send_message({"type": "ERROR", "error": "Claude CLI timed out (120s)"})
            except RuntimeError as exc:
                send_message({"type": "ERROR", "error": str(exc)})
            except Exception as exc:
                send_message({"type": "ERROR", "error": f"Unexpected: {exc}"})
            continue

        send_message({"type": "ERROR", "error": f"Unknown message type: {msg_type}"})


if __name__ == "__main__":
    main()
