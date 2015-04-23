var app = require('app');
var BrowserWindow = require('browser-window');

// Report crashes
require('crash-reporter').start();

var mainWindow = null;
var PREFIX_FILEEXT_PROXYFILE = ".prox";

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

var crypto = require('crypto');

var ipc = require('ipc');
ipc.on('synchronous-message', function(event, path, type) {
	console.log("a:" + path, " b:" + type);

	var dirData = {};
	var newRevision = 1;
	var oldRevision = 0;

	var recFiles = function(basePath, files) {
		files.forEach(
			function(fileOrDir) {
				var isDir = fs.lstatSync(basePath + "/" + fileOrDir).isDirectory();
				if (isDir) {
					var basePath2 = basePath + "/" + fileOrDir;
					fs.readdir(
						basePath2,
						function(err, files2) {
							if (err) throw err;
							recFiles(basePath2, files2);
						}
					);
				} else {
					var filePath = basePath + "/" + fileOrDir;
					console.log("filePath:" + filePath);

					var oldRevFilePath = filePath.replace("/Users/runnershigh/Desktop/", "/Users/runnershigh/Desktop/dest/" + oldRevision + "/");
					console.log("どのrevと比較するか、とかを入れるのがこの辺にくる気がする。");
					var output = shouldCopy(filePath, oldRevFilePath);



					var newRevDestPath = filePath.replace("/Users/runnershigh/Desktop/", "/Users/runnershigh/Desktop/dest/" + newRevision + "/");

					// 一個上のフォルダが無ければつくるしかないのか、、
					// fs.exists('/etc/passwd', function (exists) {
					// 	fs.mkdirSync();
					// });

					// console.log("コピーする必要があるかどうか、hashで考える。ってなると、一度ファイルのMD5とかでチェックしたほうがいいのかな。もしマッチしたら、.prc、代理でhashの書いてあるファイルを置く。");
					// if (output) {
					// 	fs.createReadStream(filePath).pipe(fs.createWriteStream(newRevDestPath));
					// } else {// proxyを作成
					// 	console.log("should make proxy:" + oldRevision);
					// }
				}
			}
		);
	}

	/*
		ローディング処理を行って、終わったら返す。
	*/
	// データツリーを作ろう。
	fs.readdir(
		path,
		function(err, files){
			if (err) throw err;
			var basePath = path;
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
