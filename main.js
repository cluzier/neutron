const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, nativeTheme, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const http = require('http');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const packageJson = require('./package.json');

function waitForNextJs() {
  return new Promise((resolve) => {
    const checkServer = () => {
      http.get('http://localhost:3000', (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(checkServer, 1000);
        }
      }).on('error', () => {
        setTimeout(checkServer, 1000);
      });
    };
    checkServer();
  });
}

function showAboutDialog() {
  dialog.showMessageBox({
    type: 'info',
    title: 'About Neutron',
    message: 'Neutron',
    detail: `Version ${packageJson.version}\nCreated by @cluzier\n\nA tool for exploring and analyzing Electron applications.`,
    buttons: ['OK'],
    icon: nativeImage.createFromPath(path.join(__dirname, 'icon.png'))
  });
}

function showContributorsDialog() {
  dialog.showMessageBox({
    type: 'info',
    title: 'Contributors',
    message: 'Contributors',
    // if you're reading this and have committed code, you're a contributor, plop your name in here ✨
    detail: 'Contributors', 
    buttons: ['OK'],
    icon: nativeImage.createFromPath(path.join(__dirname, 'icon.png'))
  });
}

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: 'Neutron',
      submenu: [
        {
          label: 'About Neutron',
          click: () => showAboutDialog()
        },
        {
          label: 'Contributors',
          click: () => showContributorsDialog()
        },
        {
          label: 'Toggle DevTools',
          accelerator: 'CmdOrCtrl+Alt+I',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : [])
  ];

  return Menu.buildFromTemplate(template);
}

async function createWindow() {
  if (process.env.NODE_ENV === 'development') {
    // Wait for Next.js server in development
    await waitForNextJs();
  }

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 700,
    title: 'Neutron',
    frame: true,
    backgroundColor: '#fff',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Send theme change events to renderer
  nativeTheme.on('updated', () => {
    mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
  });

  // Intercept console logs and send to renderer
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    originalConsoleLog.apply(console, args);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('console-log', args.map(arg => String(arg)).join(' '));
    }
  };

  // In development, load from React dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile('out/index.html');
  }
}

app.setName('Neutron');

app.whenReady().then(() => {
  Menu.setApplicationMenu(createMenu());
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Function to get immediate directory contents
async function getDirectoryContents(dirPath) {
  try {
    const items = await fs.readdir(dirPath);
    const contents = await Promise.all(
      items
        .filter(item => !item.startsWith('.')) // Skip hidden files
        .map(async item => {
          const fullPath = path.join(dirPath, item);
          const stats = await fs.stat(fullPath);
          return {
            name: item,
            path: fullPath,
            type: stats.isDirectory() ? 'directory' : 'file',
            hasChildren: stats.isDirectory()
          };
        })
    );
    return contents;
  } catch (error) {
    console.error('Error reading directory:', error);
    return [];
  }
}

// Function to analyze an application
async function analyzeApp(appPath) {
  console.log('Analyzing app at path:', appPath);
  try {
    // Ensure we have an absolute path
    const absolutePath = path.resolve(appPath);
    console.log('Absolute path:', absolutePath);

    // Check if it's an Electron app by looking for app.asar
    const contentsPath = path.join(absolutePath, 'Contents');
    const resourcesPath = path.join(contentsPath, 'Resources');
    console.log('Looking for Resources at:', resourcesPath);
    
    // First check if the Resources directory exists
    if (!await fs.pathExists(resourcesPath)) {
      console.log('Resources directory not found');
      return {
        isElectronApp: false,
        message: 'This is not an Electron application (no Resources directory found).'
      };
    }

    // Get the app icon path
    const iconPath = path.join(contentsPath, 'Resources', 'electron.icns');
    const defaultIconPath = path.join(contentsPath, 'Resources', 'app.icns');
    let appIconPath = null;
    
    if (await fs.pathExists(iconPath)) {
      appIconPath = iconPath;
    } else if (await fs.pathExists(defaultIconPath)) {
      appIconPath = defaultIconPath;
    }

    // Get only the Contents directory structure initially
    const initialStructure = {
      name: path.basename(absolutePath),
      path: absolutePath,
      type: 'directory',
      hasChildren: true,
      children: await getDirectoryContents(contentsPath)
    };

    // Look for app.asar in the Resources directory
    const asarPath = path.join(resourcesPath, 'app.asar');
    console.log('Looking for app.asar at:', asarPath);
    
    if (await fs.pathExists(asarPath)) {
      console.log('Found app.asar');
      return {
        isElectronApp: true,
        asarPath: asarPath,
        appName: path.basename(absolutePath, '.app'),
        appIconPath,
        structure: initialStructure
      };
    }

    // If app.asar doesn't exist, check for app.asar.unpacked
    const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
    console.log('Looking for app.asar.unpacked at:', unpackedPath);
    if (await fs.pathExists(unpackedPath)) {
      console.log('Found app.asar.unpacked');
      return {
        isElectronApp: true,
        asarPath: 'This app uses an unpacked asar archive',
        unpackedPath: unpackedPath,
        appName: path.basename(absolutePath, '.app'),
        appIconPath,
        structure: initialStructure
      };
    }
    
    console.log('No asar files found');
    return {
      isElectronApp: false,
      message: 'This is not an Electron application (no app.asar or app.asar.unpacked found).'
    };
  } catch (error) {
    console.error('Error analyzing application:', error);
    return {
      isElectronApp: false,
      message: `Error analyzing application: ${error.message}`
    };
  }
}

// Handle loading directory contents
ipcMain.handle('load-directory', async (event, dirPath) => {
  return await getDirectoryContents(dirPath);
});

// Handle app selection via dialog
ipcMain.handle('select-app', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Applications', extensions: ['app'] }
    ],
    defaultPath: '/Applications'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return await analyzeApp(result.filePaths[0]);
  }
  
  return {
    isElectronApp: false,
    message: 'No application selected.'
  };
});

// Handle dropped files
ipcMain.handle('handle-drop', async (event, filePath) => {
  console.log('Received dropped file path:', filePath);
  return await analyzeApp(filePath);
});

// Handle opening folder in Finder
ipcMain.handle('open-folder', async (event, folderPath) => {
  try {
    await shell.showItemInFolder(folderPath);
    return true;
  } catch (error) {
    console.error('Error opening folder:', error);
    return false;
  }
});

// Handle getting app icon
ipcMain.handle('get-app-icon', async (event, iconPath) => {
  try {
    if (!iconPath) return null;
    
    const iconBuffer = await fs.readFile(iconPath);
    const icon = nativeImage.createFromBuffer(iconBuffer);
    
    // Resize to a reasonable size for display
    const resized = icon.resize({ width: 32, height: 32 });
    return resized.toDataURL();
  } catch (error) {
    console.error('Error loading app icon:', error);
    return null;
  }
});

// Handle extracting app.asar
ipcMain.handle('extract-asar', async (event, asarPath) => {
  try {
    const resourcesDir = path.dirname(asarPath);
    const appDir = path.join(resourcesDir, 'app');
    
    // Check if global asar is installed
    try {
      await execPromise('asar --version');
    } catch (error) {
      // Install asar globally if not found
      await execPromise('npm install -g asar');
    }

    // Extract the asar
    await execPromise(`asar extract "${asarPath}" "${appDir}"`);
    
    // Rename the original asar
    const backupPath = path.join(resourcesDir, 'original-app.asar');
    await fs.rename(asarPath, backupPath);

    return {
      success: true,
      extractedPath: appDir,
      originalPath: backupPath
    };
  } catch (error) {
    console.error('Error extracting asar:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle restoring original app.asar
ipcMain.handle('restore-asar', async (event, originalPath) => {
  try {
    const resourcesDir = path.dirname(originalPath);
    const asarPath = path.join(resourcesDir, 'app.asar');
    const appDir = path.join(resourcesDir, 'app');

    // Restore the original asar
    await fs.rename(originalPath, asarPath);
    
    // Remove the extracted directory
    await fs.remove(appDir);

    return {
      success: true
    };
  } catch (error) {
    console.error('Error restoring asar:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle getting current theme
ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors;
}); 