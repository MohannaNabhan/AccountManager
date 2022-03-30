const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const path_db = 'C:/AccountManager';
const fs = require('fs');
let mainWindow = null;
if (require('electron-squirrel-startup')) {
  app.quit();
}
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1090,
    height: 630,
    title: 'AccountManager',
    minWidth:800,
    minHeight: 580,
    frame: false,
    backgroundColor: '#1B1B1B',
    webPreferences:{
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'pages/content.html'));
  //mainWindow.webContents.openDevTools();
};
ipcMain.on('event:window', (e,type) =>{
  if(type == "minimize"){
    mainWindow.minimize();
  }else if(type == "maximize"){
    mainWindow.maximize();
  }else if(type == "unmaximize"){
    mainWindow.unmaximize();
  }else if(type == "close"){
    mainWindow.close()
  }
})
if (!fs.existsSync(path_db)) {
    fs.mkdirSync(path_db)
    setTimeout(() => {
        if(!fs.existsSync(path_db+'/Category')){
            fs.mkdirSync(path_db+'/Category')
        }
    }, 100);
}else{
    if(!fs.existsSync(path_db+'/Category')){
        fs.mkdirSync(path_db+'/Category')
    }
}
app.on('ready', createWindow);
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