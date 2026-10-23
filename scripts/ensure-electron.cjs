// Electron 44+ downloads its binary on first use rather than at install time.
// `electron .` (npm start) triggers that download, but electron-vite's dev
// server only checks for the binary and fails with "Electron uninstall".
// Requiring the package runs the download (verified against the checksums in
// the package) whenever the binary is missing, so `npm run dev` works on a
// fresh clone and right after an Electron upgrade.
const electronPath = require('electron')
console.log(`Electron binary: ${electronPath}`)
