var app = require('app');
var BrowserWindow = require('browser-window');

// Report crashes
require('crash-reporter').start();

var mainWindow = null;
var PREFIX_FILEEXT_PROXYFILE = ".prox";
var FILEMACHINE_POOL_ROOTPATH = app.getPath("userCache");

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

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ipc = require('ipc');


ipc.on('synchronous-message', function(event, filePath, type) {
	console.log("a:" + filePath, " b:" + type + " app.getPath:" + app.getPath("userCache"));
	var baseFolderPath = path.join(filePath, "..");

	// 何が放り込まれても問題ない感じだと思う。

	
	
	var newRevision = 1;
	var oldRevision = 0;

	// generate new revision folder
	var newRevFolderPath = path.join(FILEMACHINE_POOL_ROOTPATH, newRevision.toString());
	if (fs.existsSync(newRevFolderPath)) {
		rm(newRevFolderPath);
	}
	fs.mkdirSync(newRevFolderPath);

	var recFiles = function recFiles (basePath, files) {
		files.forEach(
			function(fileOrDir) {
				var isDir = fs.lstatSync(path.join(basePath, fileOrDir)).isDirectory();
				if (isDir) {
					var basePath2 = path.join(basePath, fileOrDir);
					fs.readdir(
						basePath2,
						function(err, files2) {
							if (err) throw err;
							recFiles(basePath2, files2);
						}
					);
				} else {
					var filePath1 = path.join(basePath, fileOrDir);
					
					var oldRevFilePath = filePath1.replace(
						baseFolderPath, 
						path.join(FILEMACHINE_POOL_ROOTPATH, oldRevision.toString())
					);

					// copy as new file or make proxy file.

					var shouldCp = shouldCopy(filePath1, oldRevFilePath);

					if (shouldCp) {
						var newRevDestPath = filePath1.replace(
							baseFolderPath, 
							path.join(FILEMACHINE_POOL_ROOTPATH, newRevision.toString())
						);
						var targetPathBase = path.join(newRevDestPath, "..");
						if (!fs.existsSync(targetPathBase)) {
							fs.mkdirSync(targetPathBase);
						}
						fs.createReadStream(filePath1).pipe(fs.createWriteStream(newRevDestPath));
					} else {// proxyを作成
						console.log("should make proxy:" + oldRevision);
					}
				}
			}
		);
	}

	/*
		フォルダを読みこむ
		んで書き出す際、辞書の内容を調べないといけない。
		一番上がフォルダな必要がある。
	*/
	fs.readdir(
		filePath,
		function(err, files){
			if (err) throw err;
			var basePath = filePath;
			recFiles(basePath, files);
		}
	);
});

function md5Digest (filePath) {
	var md5sum = crypto.createHash('md5');

	var buf = fs.readFileSync(filePath);
	md5sum.update(buf);
	return md5sum.digest('hex');
}

function md5DigestFromProxy (proxyFilePath) {
	var buf = fs.readFileSync(proxyFilePath);
	return buf;
}

function shouldCopy (filePath, oldRevFilePath) {

	var currentDigest = md5Digest(filePath);
	console.log(currentDigest + '  ' + filePath);


	// 古いファイルが存在する
	if (fs.existsSync(oldRevFilePath)) {
		var oldDigest = md5Digest(oldRevFilePath);

		// digestが一致しないのでcopyの必要がある
		if (oldDigest != currentDigest) {
			console.log("hash unmatched, modified1:" + filePath);
			return true;
		}

		console.log("hash matched. old file exists:" + filePath);
		// digestが一致するので、copyの必要は無い
		return false;
	}

	// no old file of filePath. check about .prox file.

	var proxFilePath = oldRevFilePath + PREFIX_FILEEXT_PROXYFILE;
	// proxファイルが存在する
	if (fs.existsSync(proxFilePath)) {
		// proxファイルの中身を読んで、hashをチェックする。hashが合致したらcopyする必要は無い

		var oldDigestFromProxyFile = md5DigestFromProxy(proxFilePath);
		console.log("oldDigestFromProxyFile:" + oldDigestFromProxyFile);

		if (oldDigestFromProxyFile != currentDigest) {
			console.log("hash unmatched, modified2:" + filePath);
			return true;
		}

		console.log("hash matched to proxy file:" + filePath);
		return false;
	}

	console.log("no old proxy file:" + proxFilePath);

	// completely new file.
	return true;
}

function rm(path) {
    var files = [];
    if( fs.existsSync(path) ) {
        files = fs.readdirSync(path);
        files.forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.lstatSync(curPath).isDirectory()) { // recurse
                rm(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

// file-object ファイル読むのに使える。
// https://github.com/atom/electron/blob/master/docs/api/file-object.md

// remote 気になる。
// https://github.com/atom/electron/blob/master/docs/api/remote.md

// protocol 独自ハンドラ定義かな。
// https://github.com/atom/electron/blob/master/docs/api/remote.md

// menu これどこにでんの。
// https://github.com/atom/electron/blob/master/docs/api/menu.md

// ipc inner procedual call かな？　これでイベント呼べそう。なるほど。
// https://github.com/atom/electron/blob/master/docs/api/ipc-renderer.md
// https://github.com/atom/electron/blob/master/docs/api/ipc-main-process.md

// dialog 使うことがあれば。
// https://github.com/atom/electron/blob/master/docs/api/dialog.md

// crash-reporter お世話になってる。
// https://github.com/atom/electron/blob/master/docs/api/crash-reporter.md

// clipboard クリップボード管理？　どうなってんだろ。どこの？
// https://github.com/atom/electron/blob/master/docs/api/clipboard.md

// window
// https://github.com/atom/electron/blob/master/docs/api/browser-window.md

// node-module の使い方とか。
// https://github.com/atom/electron/blob/master/docs/tutorial/using-native-node-modules.md

app.on('window-all-closed', function() {
  app.quit();
});



app.on('quit', function () {
  console.log("quit!!");
});
