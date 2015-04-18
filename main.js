var app = require('app');
var BrowserWindow = require('browser-window');

// Report crashes
require('crash-reporter').start();

var mainWindow = null;

/*
  https://github.com/atom/electron/blob/master/docs/api/app.md
*/


app.on('will-finish-launching', function () {
  console.log("will-finish-launching!");
});

app.on('ready', function() {
  mainWindow = new BrowserWindow({width: 800, height: 600});

  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});

// D&Dに使える。伝搬してこない、、？
// app.on("open-file", function (path) {
//   console.log("fufufuf path:" + path);
// });

// こっち
// https://github.com/atom/electron/blob/master/docs/api/file-object.md
// が使えるっぽい。




app.on('window-all-closed', function() {
  app.quit();
});



app.on('quit', function () {
  console.log("quit!!");
});
