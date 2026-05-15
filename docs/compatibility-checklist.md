# VoxNote Compatibility Checklist

## Permission Rules

Microphone permission should be visible and actionable before recording starts.

Expected user flow:

1. App opens and shows microphone state.
2. User clicks `检查`.
3. Browser or desktop OS asks for microphone access if permission has not been decided.
4. App updates the state to `已授权`, `已阻止`, `没有麦克风`, or `设备被占用`.
5. User clicks `开始`.
6. Recording starts only after permission succeeds.

If no permission prompt appears, check:

- Page is opened from `localhost`, HTTPS, or the desktop app.
- Browser has not already blocked the microphone for this site.
- macOS Privacy & Security has allowed the app/browser to use the microphone.
- Windows Privacy & security has allowed desktop apps/browser microphone access.
- Another app is not occupying the microphone.
- Browser supports the feature being used.

## Web MVP

| Feature | macOS Chrome/Edge | Windows Chrome/Edge | Notes |
| --- | --- | --- | --- |
| Microphone permission check | Required | Required | Uses `getUserMedia`. |
| Browser real-time speech | Limited by browser support | Limited by browser support | Web Speech API support is not equal across browsers. |
| Local media upload preview | Expected | Expected | Browser can preview many, but not all, formats. |
| Local file transcription | Requires local service | Requires local service | `server.py` or desktop bridge must be running. |
| System audio capture | Browser-limited | More likely in Chrome/Edge | User must explicitly choose a source with audio. |
| TXT/SRT export | Expected | Expected | Uses browser downloads. |

## macOS Desktop

Before public release:

- Add microphone usage text to the app bundle plist.
- Test first-run microphone prompt.
- Test denial and recovery through System Settings.
- Test Apple Silicon and Intel builds.
- Test unsigned build warning.
- Test signed and notarized build.
- Test local model download and deletion.
- Test audio/video import with common formats:
  - `.mp3`
  - `.wav`
  - `.m4a`
  - `.mp4`
  - `.mov`
  - `.webm`
- Test system audio capture separately from microphone capture.

## Windows Desktop

Before public release:

- Test first-run microphone prompt or Windows privacy gate.
- Test denial and recovery through Settings.
- Test x64 installer.
- Test unsigned SmartScreen warning.
- Test signed installer.
- Test local model download and deletion.
- Test audio/video import with common formats:
  - `.mp3`
  - `.wav`
  - `.m4a`
  - `.mp4`
  - `.mov`
  - `.webm`
- Test WASAPI loopback/system audio capture.

## Release Gate

Do not publish a non-alpha release until all required features have:

- visible permission state
- clear failure messages
- retry path
- at least one successful run on macOS
- at least one successful run on Windows
- exported TXT and SRT verified from the same transcript
