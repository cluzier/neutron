# neutron

Neutron is an application to locate app.asar files in Electron applications.

## Features
- Electron + Next.js app
- Lightweight build with asset compression
- Only English locales included for smaller size
- Cross-platform: macOS, Windows, and Linux support

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Compress assets (optional, but recommended):**
   ```sh
   npm run compress-assets
   ```
   This will optimize images and static assets for a smaller app size.

3. **Build the app:**
   ```sh
   npm run build
   ```
   This runs Next.js build and packages the Electron app. Only necessary files are included, and only English locales are kept.

4. **Run the app in development:**
   ```sh
   npm run dev
   ```

5. **Run the app:**
   ```sh
   npm start
   ```

## Cross-Platform Builds

Neutron can be built for macOS, Windows, and Linux using electron-builder.

- **Build for all platforms:**
  ```sh
  electron-builder -mwl
  ```
  (`-mwl` = mac, windows, linux)

- **Note:**
  - To build Windows apps on macOS or Linux, you need [Wine](https://wiki.winehq.org/Download) installed.
  - Output installers will be in the `release/` directory.

- **Platform targets:**
  - **macOS:** `.dmg`, `.zip`
  - **Windows:** `.exe` (NSIS installer), `.zip`
  - **Linux:** `.AppImage`, `.deb`, `.zip`

## .gitignore Best Practices

The following are excluded from git to keep the repository lightweight:
- `node_modules/`
- `out/`, `.next/`, `release/` (build outputs)
- `*.dmg`, `*.zip`, `*.asar` (packaged artifacts)
- `.DS_Store`, log files

## Notes
- Do not commit build artifacts or release files to git. This keeps the repository well under GitHub's 100MB file limit.
- If you need to further reduce app size, check for unused dependencies or assets.

---

For more details, see the scripts in the `scripts/` directory.
