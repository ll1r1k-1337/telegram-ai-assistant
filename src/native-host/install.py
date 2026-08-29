#!/usr/bin/env python3
"""
Install / uninstall the Telegram AI Assistant native messaging host.

Usage:
    python install.py install   [--extension-id=ID]
    python install.py uninstall

- Windows:  writes a registry key under HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts
- macOS:    writes a JSON manifest to ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
- Linux:    writes a JSON manifest to ~/.config/google-chrome/NativeMessagingHosts/
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import stat
import sys
from pathlib import Path

HOST_NAME = "com.telegram_ai_assistant.claude_bridge"

# Default extension ID — users can override with --extension-id
DEFAULT_EXTENSION_ID = "*"

MANIFEST_TEMPLATE = {
    "name": HOST_NAME,
    "description": "Telegram AI Assistant — Claude Code CLI bridge",
    "type": "stdio",
}


def get_host_dir() -> Path:
    """Directory where host.py lives (same dir as this install script)."""
    return Path(__file__).resolve().parent


def build_manifest(extension_id: str) -> dict:
    """Build the native messaging host manifest JSON."""
    host_dir = get_host_dir()

    if sys.platform == "win32":
        path = str(host_dir / "host.bat")
    else:
        path = str(host_dir / "host.sh")

    manifest = {
        **MANIFEST_TEMPLATE,
        "path": path,
        "allowed_origins": [f"chrome-extension://{extension_id}/"],
    }
    return manifest


def install_windows(manifest: dict) -> None:
    """Register native messaging host via Windows registry."""
    import winreg

    host_dir = get_host_dir()
    manifest_path = host_dir / f"{HOST_NAME}.json"

    # Write manifest file
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"  Manifest: {manifest_path}")

    # Register in HKCU
    key_path = rf"Software\Google\Chrome\NativeMessagingHosts\{HOST_NAME}"
    try:
        key = winreg.CreateKeyEx(
            winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_WRITE
        )
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(manifest_path))
        winreg.CloseKey(key)
        print(f"  Registry: HKCU\\{key_path}")
    except OSError as exc:
        print(f"  ERROR writing registry: {exc}", file=sys.stderr)
        sys.exit(1)


def install_unix(manifest: dict) -> None:
    """Register native messaging host on macOS/Linux."""
    host_dir = get_host_dir()

    # Make launcher executable
    launcher = host_dir / "host.sh"
    launcher.chmod(launcher.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP)

    # Determine manifest directory
    system = platform.system()
    if system == "Darwin":
        manifest_dir = (
            Path.home()
            / "Library"
            / "Application Support"
            / "Google"
            / "Chrome"
            / "NativeMessagingHosts"
        )
    else:
        manifest_dir = (
            Path.home() / ".config" / "google-chrome" / "NativeMessagingHosts"
        )

    manifest_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = manifest_dir / f"{HOST_NAME}.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"  Manifest: {manifest_path}")


def uninstall_windows() -> None:
    """Remove native messaging host registration on Windows."""
    import winreg

    host_dir = get_host_dir()
    manifest_path = host_dir / f"{HOST_NAME}.json"
    if manifest_path.exists():
        manifest_path.unlink()
        print(f"  Deleted: {manifest_path}")

    key_path = rf"Software\Google\Chrome\NativeMessagingHosts\{HOST_NAME}"
    try:
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER, key_path)
        print(f"  Removed: HKCU\\{key_path}")
    except FileNotFoundError:
        print(f"  Registry key not found (already clean).")


def uninstall_unix() -> None:
    """Remove native messaging host registration on macOS/Linux."""
    system = platform.system()
    if system == "Darwin":
        manifest_dir = (
            Path.home()
            / "Library"
            / "Application Support"
            / "Google"
            / "Chrome"
            / "NativeMessagingHosts"
        )
    else:
        manifest_dir = (
            Path.home() / ".config" / "google-chrome" / "NativeMessagingHosts"
        )

    manifest_path = manifest_dir / f"{HOST_NAME}.json"
    if manifest_path.exists():
        manifest_path.unlink()
        print(f"  Deleted: {manifest_path}")
    else:
        print(f"  Not found (already clean).")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Install/uninstall Telegram AI Assistant native messaging host."
    )
    parser.add_argument(
        "action",
        choices=["install", "uninstall"],
        help="install or uninstall the native host",
    )
    parser.add_argument(
        "--extension-id",
        default=DEFAULT_EXTENSION_ID,
        help="Chrome extension ID for allowed_origins (default: wildcard *)",
    )
    args = parser.parse_args()

    if args.action == "install":
        manifest = build_manifest(args.extension_id)
        print(f"Installing native messaging host '{HOST_NAME}'...")
        if sys.platform == "win32":
            install_windows(manifest)
        else:
            install_unix(manifest)
        print("Done. Restart Chrome to pick up changes.")
    else:
        print(f"Uninstalling native messaging host '{HOST_NAME}'...")
        if sys.platform == "win32":
            uninstall_windows()
        else:
            uninstall_unix()
        print("Done.")


if __name__ == "__main__":
    main()
