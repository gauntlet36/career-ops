@echo off
REM ============================================================
REM  Launcher for the career-ops dashboard TUI.
REM  Double-click this file, or run it from any terminal.
REM
REM  Why this exists: career-dashboard.exe needs to be told where
REM  the career-ops folder is (--path), and double-clicking the
REM  .exe directly runs it from the dashboard\ folder with no
REM  argument, so it can't find data\applications.md and exits
REM  instantly. This launcher passes the correct path for you.
REM ============================================================
title career-ops dashboard

REM %~dp0 is the folder this script lives in (the career-ops root),
REM with a trailing backslash. The ".path" trick avoids a trailing
REM backslash sitting just before a quote, which cmd mis-parses.
"%~dp0dashboard\career-dashboard.exe" --path "%~dp0."

if errorlevel 1 (
  echo.
  echo The dashboard exited with an error ^(see the message above^).
  pause
)
