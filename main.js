var app = require('app');
var BrowserWindow = require('browser-window');

// Report crashes
require('crash-reporter').start();

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var assert = require('assert');
var ipc = require('ipc');
var globalShortcut = require('global-shortcut');

var mainWindow = null;
var PREFIX_FILEEXT_PROXYFILE = ".prox";
var FILEMACHINE_POOL_ROOTPATH = app.getPath("userCache");
var FILEMACHINE_EXPORT_DEFAULTPATH = app.getPath("userDesktop");

/*
	app handlers
*/
app.on('will-finish-launching', function () {
  console.log("will-finish-launching!");

	var shortcutReg = globalShortcut.register('command+o', openRecord);
	if (!shortcutReg) {
		console.log("failed to register shortcut.");
		app.quit();
	}
});

app.on('ready', function() {
  mainWindow = new BrowserWindow({width: 800, height: 600});

  mainWindow.loadUrl('file://' + __dirname + '/index.html');

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});

app.on('window-all-closed', function() {
  app.quit();
});

app.on('quit', function () {
  console.log("quit!!");
});


/*
	handler of atom-shell's renderer.
*/
/**
	folder dropped.
*/
ipc.on('fileDropped', function(event, filePath, type) {
	var baseFolderPath = path.join(filePath, "..");

	var oldRevision = recordedLatestRevision();
	var newRevision = oldRevision + 1;
	

	// generate new revision folder
	var newRevFolderPath = path.join(FILEMACHINE_POOL_ROOTPATH, newRevision.toString());
	if (fs.existsSync(newRevFolderPath)) {
		rm(newRevFolderPath);
	}
	fs.mkdirSync(newRevFolderPath);

	/*
		フォルダを読みこむ
		んで書き出す際、辞書の内容を調べないといけない。
		一番上がフォルダな必要がある。
	*/
	var dirsOrFiles = fs.readdirSync(filePath);
	var basePath = filePath;
	recordDirsAndFiles(basePath, dirsOrFiles, newRevision, oldRevision, baseFolderPath);

	console.log("全部syncで書いたんで、ここまで来てからrendererに帰ってる。なんもしないけど。最終的には進捗とかかな。");
});


function openRecord () {
	var latestRevision = recordedLatestRevision();
	var recordedFolderPath = path.join(FILEMACHINE_POOL_ROOTPATH, latestRevision.toString());
	
	console.log("latestRevision:" + latestRevision);

	var recordedFolderPaths = fs.readdirSync(recordedFolderPath);
	for (var i = 0; i < recordedFolderPaths.length; i++) {
		console.log("recordedFolderPath:" + recordedFolderPaths[i]);
	}
	// 吐き出し先フォルダの一番外側を洗う(単一フォルダ?ではない。複数になるはず。でも現状は単一。)
	// 入っているファイルに対して再起で洗う
	// 入ってるファイルを追跡する必要がある。過去のが残ってる前提で0まで追いまくれば良いと思う。
	// ファイルが見つかったら吐きだす。
	// if (fs) {

	// }
}


function recordDirsAndFiles (basePath, files, newRevision, oldRevision, baseFolderPath) {
	files.forEach(
		function(fileOrDir) {
			var isDir = fs.lstatSync(path.join(basePath, fileOrDir)).isDirectory();
			if (isDir) {
				var basePath2 = path.join(basePath, fileOrDir);
				var dirsOrFiles = fs.readdirSync(basePath2);
				recordDirsAndFiles(basePath2, dirsOrFiles, newRevision, oldRevision, baseFolderPath);
			} else {
				if (fileOrDir.lastIndexOf(".", 0) === 0) return;
				console.log("checking... file:" + fileOrDir);
				var filePath1 = path.join(basePath, fileOrDir);
				
				var oldRevFilePath = filePath1.replace(
					baseFolderPath, 
					path.join(FILEMACHINE_POOL_ROOTPATH, oldRevision.toString())
				);

				// copy as new file or make proxy file.

				var shouldCp = shouldCopy(filePath1, oldRevFilePath);


				var newRevDestPath = filePath1.replace(
					baseFolderPath, 
					path.join(FILEMACHINE_POOL_ROOTPATH, newRevision.toString())
				);

				var targetPathBase = path.join(newRevDestPath, "..");
				if (!fs.existsSync(targetPathBase)) {
					fs.mkdirSync(targetPathBase);
				}

				if (shouldCp) {
					fs.createReadStream(filePath1).pipe(fs.createWriteStream(newRevDestPath));
				} else {// proxyを作成
					var newRevDestProxyFilePath = newRevDestPath + PREFIX_FILEEXT_PROXYFILE;
					createProxyFile(newRevDestProxyFilePath, oldRevFilePath);
				}
			}
		}
	);
}

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

function createProxyFile (newProxyFilePath, oldRevFilePath) {
	var oldDigest = "dummy";
	if (fs.existsSync(oldRevFilePath)) {
		var oldDigest = md5Digest(oldRevFilePath);
		fs.writeFileSync(newProxyFilePath, oldDigest);
	} else {
		var oldProxyFilePath = oldRevFilePath + PREFIX_FILEEXT_PROXYFILE;
		assert.ok(fs.existsSync(oldProxyFilePath), "no proxy file exist:" + oldProxyFilePath);
		fs.createReadStream(oldProxyFilePath).pipe(fs.createWriteStream(newProxyFilePath));
	}
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

function recordedLatestRevision () {
	var oldRev = -1;
	var revisonDirs = fs.readdirSync(FILEMACHINE_POOL_ROOTPATH);
	for (var i = 0; i < revisonDirs.length; i++) {
		var revNum = parseInt(revisonDirs[i]);
		if (!isNaN(revNum)) {
			if (oldRev < revNum) oldRev = revNum;
		}
	};
	return oldRev;
}


