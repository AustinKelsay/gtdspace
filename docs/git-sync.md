# Encrypted Git Sync & Backups

GTD Space can now keep your GTD workspace in sync across devices by creating encrypted snapshots and pushing them to a Git repository (e.g., GitHub). All encryption happens locally before data ever reaches git, so the remote only sees ciphertext.

## How It Works

1. **Workspace Snapshot** – The backend walks your configured workspace directory (skipping `.git`/`.gtdsync`) and builds a compressed archive.
2. **Client-Side Encryption** – The archive is encrypted with AES-256-GCM using a PBKDF2-derived key from your passphrase.
3. **Git Repo** – The encrypted artifact is written to a dedicated git repository (separate from your plain workspace) under `backups/backup-YYYYMMDDTHHMMSSZ.tar.gz.enc`.
4. **Manual Push/Pull** – From the app header or Settings → Git Sync & Backups you can push the latest snapshot or pull/decrypt the newest backup onto the current machine.

## Configuration

Open **Settings → Advanced → Git Sync & Backups** and configure:

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
