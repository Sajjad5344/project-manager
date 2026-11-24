const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// On Linux, the Chromium sandbox needs a setuid helper (chrome-sandbox) that
// .deb/AppImage installs don't set up, and Ubuntu 24.04+ blocks the fallback,
// so the app fails to start. The renderer itself stays sandboxed.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: 'مدیریت پروژه',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Open external links (e.g. Google Fonts) in the system browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
