@echo off
:: Native Messaging Host launcher for Windows
:: Invoked by Chrome via native messaging manifest
python "%~dp0host.py" %*
