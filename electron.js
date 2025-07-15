const { app, BrowserWindow, dialog, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true
    }
  });

  // Load the app
  console.log('isDev:', isDev);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  if (isDev || process.env.NODE_ENV === 'development') {
    console.log('Loading development server...');
    mainWindow.loadURL('http://localhost:5173');
    
    // Handle dev server connection errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.log('Failed to load:', errorCode, errorDescription);
      if (errorCode === -102) { // Connection refused
        console.log('Dev server not ready, retrying in 1 second...');
        setTimeout(() => {
          mainWindow.loadURL('http://localhost:5173');
        }, 1000);
      }
    });
  } else {
    console.log('Loading production build...');
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
  
  // Add keyboard shortcut to toggle dev tools (F12 or Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { 
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Excel Grade Entry',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Excel Grade Entry',
              message: 'Excel Grade Entry v1.0.0',
              detail: 'A powerful tool for managing student grades with Excel integration.'
            });
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Check for updates when app is ready
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Auto-updater events with enhanced notifications
autoUpdater.on('checking-for-update', () => {
  console.log('🔍 Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('🆕 Update available:', info.version);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '🚀 Excel Grade Entry - Update Available',
    message: `A new version (${info.version}) is available!\n\n` +
             `🔹 New features and improvements await\n` +
             `🔹 The update will download in the background\n` +
             `🔹 You can continue working normally\n\n` +
             `Current version: ${app.getVersion()}\n` +
             `New version: ${info.version}`,
    buttons: ['Great! Download Now', 'Remind Me Later'],
    defaultId: 0,
    cancelId: 1,
    icon: null
  }).then((result) => {
    if (result.response === 1) {
      // User chose to be reminded later
      setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
      }, 30 * 60 * 1000); // Check again in 30 minutes
    }
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('✅ No updates available. You have the latest version!');
});

autoUpdater.on('error', (err) => {
  console.log('❌ Auto-updater error:', err);
  dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: '⚠️ Update Error',
    message: 'There was an error checking for updates.\n\n' +
             'Please check your internet connection and try again later.',
    buttons: ['OK']
  });
});

let progressWindow;
autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  const speed = Math.round(progressObj.bytesPerSecond / 1024); // KB/s
  console.log(`📥 Download progress: ${percent}% (${speed} KB/s)`);
  
  // Update main window title with progress
  if (mainWindow) {
    mainWindow.setTitle(`Excel Grade Entry - Downloading Update ${percent}%`);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Update downloaded successfully!');
  
  // Reset window title
  if (mainWindow) {
    mainWindow.setTitle('Excel Grade Entry');
  }
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '🎉 Update Ready to Install',
    message: `Version ${info.version} has been downloaded and is ready to install!\n\n` +
             `🔹 Your work will be saved automatically\n` +
             `🔹 The app will restart quickly\n` +
             `🔹 All your settings will be preserved\n\n` +
             `Would you like to install the update now?`,
    buttons: ['🚀 Install Now', '⏰ Install Later'],
    defaultId: 0,
    cancelId: 1,
    icon: null
  }).then((result) => {
    if (result.response === 0) {
      // Show a brief "preparing update" message
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '⚡ Installing Update',
        message: 'Preparing to install the update...\n\nThe app will restart in a moment.',
        buttons: []
      });
      
      // Install after a short delay
      setTimeout(() => {
        autoUpdater.quitAndInstall();
      }, 2000);
    } else {
      // User chose to install later
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '📌 Update Reminder',
        message: 'The update will be installed the next time you restart the application.\n\n' +
                 'You can also check for updates manually from the Help menu.',
        buttons: ['OK']
      });
    }
  });
});

// Add manual update check function
function checkForUpdatesManually() {
  autoUpdater.checkForUpdatesAndNotify();
}

// Export the function for use in menu
module.exports = { checkForUpdatesManually };
