# GitHub Release Guide

## Manual Release

1. Build installers locally or through GitHub Actions.
2. Create a tag, for example `v0.1.0`.
3. Create a GitHub Release from that tag.
4. Upload the macOS and Windows installer files.
5. Add release notes with:
   - new features
   - known limitations
   - supported platforms
   - whether the build is signed or unsigned

## Automated Release

The workflow in `.github/workflows/release.yml` runs when a tag starting with `v` is pushed.

Example:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow creates a draft release and uploads Tauri build artifacts.

## Signing Notes

Unsigned alpha builds are acceptable for private testing, but public builds should be signed.

macOS:

- Apple Developer Program membership is needed for Developer ID signing.
- Notarization reduces Gatekeeper warnings.

Windows:

- A code signing certificate reduces SmartScreen and installer warnings.
- Keep private keys in GitHub Actions secrets, never in the repository.
