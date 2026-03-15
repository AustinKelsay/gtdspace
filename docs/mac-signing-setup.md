# macOS Code Signing & Notarization

GTD Space now ships the macOS desktop build as a **Developer ID signed** and **Apple notarized** app. This mirrors the hardened workflow we use in [`FROSTR-ORG/igloo-desktop`](https://github.com/FROSTR-ORG/igloo-desktop) while adapting the details for Tauri.

> **TL;DR:** Configure the secrets listed below, then create a release tag. The GitHub Actions pipeline will import your Developer ID certificate, sign the `GTD Space.app`, and notarize the resulting DMG automatically.

---

## Prerequisites

1. An active Apple Developer Program membership.
2. A macOS machine (for the initial certificate export/validation).
3. Xcode Command Line Tools (`xcode-select --install`).

---

## Required GitHub Secrets

| Secret | Source | Purpose |
| ------ | ------ | ------- |
| `CSC_LINK` | Base64 of your exported `.p12` Developer ID Application certificate | Imported into the ephemeral keychain during CI |
| `CSC_KEY_PASSWORD` | Password you set when exporting the `.p12` | Unlocks the certificate |
| `APPLE_ID` | Apple Developer account email | Used for notarization authentication |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password generated at [appleid.apple.com](https://appleid.apple.com) | Used by `notarytool` |
| `APPLE_TEAM_ID` | 10-character Team ID from the Apple Developer portal | Associates the notarization request |
| `MACOS_KEYCHAIN_PASSWORD` | Any strong random string | Unlocks the temporary keychain CI creates |
| `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | (Already in use) | Tauri's updater signature (unchanged) |

### Export & encode the certificate

```bash
# Export the certificate from Keychain as DeveloperIDCertificate.p12
# Then base64 encode it and copy the result (no newlines)
base64 -i /path/to/DeveloperIDCertificate.p12 | pbcopy
```

Paste the base64 output into the value for `CSC_LINK`, and record the export password as `CSC_KEY_PASSWORD`.

---

## Local Validation Checklist

Run these on your macOS development machine to confirm the cert + tooling are ready:

1. Verify the certificate was imported:
   ```bash
   security find-identity -v -p codesigning | grep "Developer ID Application"
   ```
2. Ensure `codesign` and `notarytool` are available:
   ```bash
   codesign --version
   xcrun notarytool --version
   ```
3. Test local signing & notarization (requires `rustup` + npm dependencies):
   ```bash
   export APPLE_ID="your@email"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   export APPLE_TEAM_ID="TEAMID1234"

   export APPLE_CERTIFICATE="$(base64 -i /path/to/DeveloperIDCertificate.p12)"
   export APPLE_CERTIFICATE_PASSWORD="p12-password"
   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID1234)"
   export APPLE_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD}"

   npm run tauri:build -- --target universal-apple-darwin
   ```

   You should see notarization status output from `notarytool`. When it completes, verify:
   ```bash
   spctl -a -vv src-tauri/target/universal-apple-darwin/release/bundle/macos/GTD\ Space.app
   ```

---

## What the CI Pipeline Does

Within `.github/workflows/build.yml` the macOS runners now:

1. **Import the certificate** into a temporary keychain using `CSC_LINK`, `CSC_KEY_PASSWORD`, and `MACOS_KEYCHAIN_PASSWORD`.
2. **Discover the Developer ID identity** (e.g. `Developer ID Application: Your Name (TEAMID1234)`) and expose it as `APPLE_SIGNING_IDENTITY`.
3. **Call `tauri-apps/tauri-action@v0`** with the signing identity, certificate, Apple ID credentials, and team ID. The action signs the `.app`, packages the DMG, submits it to notarization, waits for notarization to succeed, then staples the ticket.

If any of the required secrets are missing, the macOS build matrix jobs fail fast with a clear error.

---

## Troubleshooting Tips

- **Missing signing identity**: Re-export the certificate, ensure you selected *Developer ID Application*, and double-check the base64 contents in `CSC_LINK`.
- **Authentication failed**: Reset the app-specific password and update the `APPLE_APP_SPECIFIC_PASSWORD` secret.
- **Notarization timeouts**: Apple occasionally experiences delays. Re-run the workflow; notarization is retried automatically by the action.
- **Local builds skipping notarization**: The action only notarizes when the Apple secrets are present. Locally, make sure the necessary environment variables are exported before running `npm run tauri:build`.

---

## Next Steps

- Keep the `.p12` file secured and rotate the app-specific password periodically.
- Update the secrets if you renew or reissue your Developer ID certificate.
- See `docs/release-process.md` for the release workflow that consumes this signing configuration.
