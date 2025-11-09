# Encrypted Git Sync & Backups

GTD Space can now keep your GTD workspace in sync across devices by creating encrypted snapshots and pushing them to a Git repository (e.g., GitHub). All encryption happens locally before data ever reaches git, so the remote only sees ciphertext.

## How It Works

1. **Workspace Snapshot** – The backend walks your configured workspace directory (skipping `.git`/`.gtdsync`) and builds a compressed archive.
2. **Client-Side Encryption** – The archive is encrypted with AES-256-GCM using a PBKDF2-derived key from your passphrase.
3. **Git Repo** – The encrypted artifact is written to a dedicated git repository (separate from your plain workspace) under `backups/backup-YYYYMMDDTHHMMSSZ.tar.gz.enc`.
4. **Manual Push/Pull** – From the app header or Settings → Git Sync & Backups you can push the latest snapshot or pull/decrypt the newest backup onto the current machine.

## Configuration

Open **Settings → Git Sync & Backups** and configure:

- **Workspace Path** – The GTD Space directory you want to protect.
- **Git Repository Path** – A separate folder that contains the git repo tracking encrypted backups.
- **Remote URL & Branch** – Optional. If you provide a GitHub URL, the app will push/pull that branch.
- **Encryption Key** – Enter any passphrase; it stays local and is required on every machine.

> ⚠️ The repository path must live **outside** the workspace to avoid recursive backups. The app enforces this.

## Daily Workflow

1. **Push** – Use the cloud-upload icon in the header (or Settings card) after making changes on one Mac. This adds a new encrypted snapshot, commits it, and optionally pushes to GitHub.
2. **Pull** – On another machine, click the cloud-download icon. The app fetches latest backups, decrypts, and replaces the local workspace.
3. **Status** – Hover the shield indicator in the header to see the latest backup timestamp or read detailed status inside Settings.

## Tips

- Keep the same encryption key on every device. Losing it means you cannot decrypt previous backups.
- You can stay “local only” by skipping the remote URL—snapshots stay on disk until you add a remote.
- Old backups are pruned automatically (defaults to the last 5 snapshots). To change this, edit the `git_sync_keep_history` field in your settings file:
  - **macOS**: `~/Library/Application Support/com.gtdspace.app/settings.json`
  - **Windows**: `%APPDATA%\com.gtdspace.app\settings.json`
  - **Linux**: `~/.config/com.gtdspace.app/settings.json`
  
  Open the file and add or modify the `git_sync_keep_history` field in the `user_settings` object. Example: `"git_sync_keep_history": 10` to keep the last 10 snapshots.
- The git repo intentionally ignores everything except `backups/` so your plain files never leave the workspace unless explicitly encrypted.

## Troubleshooting

- **Missing git binary** – Ensure `git` is available on your PATH. The backend shells out to the system binary.
- **Auth failures** – Pushing to GitHub uses whatever credentials your system git config provides (token, SSH agent, etc.). Configure those outside of GTD Space.
- **Key mismatch** – If decryption fails on pull, verify that the same passphrase is saved on the current machine.

## Key Rotation

If you need to rotate your encryption key (e.g., after a security incident or to update a weak passphrase), follow these steps:

1. **Backup Current State** – Ensure all devices have the latest backup pushed before rotating.
2. **Decrypt Existing Backups** – On a trusted machine, pull and decrypt the latest backup using your current passphrase.
3. **Update Passphrase** – In Settings → Git Sync & Backups, change your encryption key to the new passphrase.
4. **Create New Encrypted Backup** – Push a new backup using the new key. This creates a new encrypted snapshot.
5. **Migrate History** – Old backups encrypted with the previous key remain in the repository but cannot be decrypted with the new key. If you need access to historical backups:
   - Keep a record of the old passphrase in a secure password manager
   - Or re-encrypt historical backups manually using the old key, then re-encrypt with the new key

> ⚠️ **Warning**: After key rotation, only backups created after the rotation can be decrypted with the new key. Previous backups require the old passphrase.

## Passphrase Recovery

### Recommended Recovery Options

- **Password Manager** – Store your encryption passphrase in a secure password manager (e.g., 1Password, Bitwarden, or macOS Keychain).
- **Physical Backup** – Write down your passphrase and store it in a secure physical location (safe, safety deposit box).
- **Multi-Device Sync** – Use your password manager's sync feature to ensure the passphrase is available on all devices.

### Recovery Steps

If you've lost your passphrase:

1. **Check Password Manager** – Search for "GTD Space" or "git sync" entries.
2. **Check Settings File** – The passphrase may be stored in your settings file (though it's recommended to use a password manager instead):
   - **macOS**: `~/Library/Application Support/com.gtdspace.app/settings.json`
   - **Windows**: `%APPDATA%\com.gtdspace.app\settings.json`
   - **Linux**: `~/.config/com.gtdspace.app/settings.json`
3. **If Passphrase is Lost** – Unfortunately, without the passphrase, encrypted backups cannot be decrypted. This is by design for security. You can:
   - Start fresh with a new encryption key
   - Create new backups going forward
   - Old encrypted backups will remain inaccessible without the original passphrase

> ⚠️ **Critical**: There is no recovery mechanism if you lose your passphrase. The encryption is designed so that only someone with the passphrase can decrypt backups. Always store your passphrase securely.
