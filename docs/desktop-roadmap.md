# VoxNote Desktop Roadmap

## Direction

Use Tauri as the desktop shell, keep the current web UI, and move heavy transcription work into bundled native sidecars.

## Engine Plan

1. Browser mode
   - Use Web Speech API for quick microphone dictation.
   - Good for drafts, not reliable for long recordings.

2. Local free mode
   - Bundle `whisper.cpp` as `voxnote-engine`.
   - Bundle `ffmpeg` or a narrowly scoped media helper as `voxnote-ffmpeg`.
   - Users should not need Python, pip, ffmpeg, or manual model installation.

3. Cloud API mode
   - Optional.
   - User provides their own API key.
   - Never ship a developer API key inside the desktop app.

## Packaging Plan

1. Create unsigned alpha builds for internal testing.
2. Add GitHub Releases artifacts:
   - `VoxNote_0.1.0_mac_universal.dmg`
   - `VoxNote_0.1.0_windows_x64-setup.exe`
   - `VoxNote_0.1.0_windows_x64.msi`
3. Add code signing before public release:
   - macOS Developer ID + notarization
   - Windows code signing certificate
4. Add auto-update after signing is stable.

## Next Implementation Steps

1. Replace the Python local server with a desktop-native command bridge.
2. Build a small `voxnote-engine` CLI contract:
   - input file path
   - model id
   - language
   - output JSON with text and segments
3. Add model manager UI:
   - download model
   - show model size
   - delete model
   - choose speed/accuracy profile
4. Add OS-specific system audio capture:
   - Windows WASAPI loopback
   - macOS ScreenCaptureKit/system audio permission path
5. Enable GitHub release automation once real sidecars exist.
