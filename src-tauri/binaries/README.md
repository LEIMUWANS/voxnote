# Desktop Sidecars

This directory is reserved for bundled native tools that users should not have to install manually.

Planned sidecars:

- `voxnote-engine`: local transcription service built around `whisper.cpp`
- `voxnote-ffmpeg`: bundled media conversion/extraction helper

Tauri sidecar binaries must be named with the target triple suffix when they are enabled in `tauri.conf.json`, for example:

- `voxnote-engine-aarch64-apple-darwin`
- `voxnote-engine-x86_64-apple-darwin`
- `voxnote-engine-x86_64-pc-windows-msvc.exe`

We are not enabling `externalBin` yet because placeholder files would break real builds. Add it after the actual binaries exist.
