
/**
 * @fileOverview
 * @author zhuqi
 */
const cheerio = require('cheerio')
const http = require('http');
const https = require('https');
const curl = require('curl');
const url = require('url');
const path = require('path');
const fs = require('fs');
const urlencode = require('urlencode');
const colors = require( "colors")

// 福音影视网下载目录
var host = 'https://downs.fuyin.tv';
// 福音证道
var pageUrl = '/pcdown/06%E7%A6%8F%E9%9F%B3%E8%AF%81%E9%81%93/';
// 存储的目录
var resourcesDir = '/Volumes/MY PASSPORT/Video-from-fuyinTV-with-nodejs';//'./resources';
// 解析后的数据
var resultData = {
  files: [],
  dirs: []
};
// 下载文件日志
var loadedFilesLogs = 'loadedFiles.json';
// 下载目录的日志
var loadedDirLogs = 'loadedDir.json';

// Utility function that downloads a URL and invokes
// callback with the data.
function download(url, callback) {
  https.get(url, function(res) {
    var data = '';
    res.on('data', function (chunk) {
      data += chunk;
    });
    res.on('end', function() {
      callback(data);
    });
  }).on('error', function() {
    callback(null);
  });
}

var hasWait = false;// 是否有等待的对列
var k = 0;
var kMax = 10; // 允许同时下载目录的最大数量
var loadingCount = 0;
var loadingFileMax = 6; // 允许同时下载文件的最大数量
var si = null;// 轮询查询
var currentUrl = null;// 当前正在等待的下载地址
function getPageDataSuccess(data) {
  var keys = Object.keys(data);
  if (!keys || keys.length <= 0) {
    return;
  }
  // while (keys[keys.length - 1]) {
  //   if (hasWait) {
  //     warnTip('有等待的对列，暂停处理');
  //     break;
  //   }
  //   var targetData = data[keys[0]];
  //   var pathObj = path.parse(targetData.url);
  //   var dirName = urlencode.decode(pathObj.base, 'utf-8');
  //   var fullPath;
  //   // 是个目录
  //   if (!pathObj.ext) {
  //     resultData.dirs.push(targetData);
  //     fullPath = resourcesDir + (targetData.parent ?  '/' + targetData.parent : '') + '/' + dirName;
  //     // 如果当前目录不存在
  //     if (!fs.existsSync(fullPath)) {
  //       fs.mkdirSync(fullPath);
  //       successTip('' + k + '：文件夹：【' + (targetData.parent ? targetData.parent : '') + '/' + dirName + '】本地已创建成功');
  //     } else {
  //       warnTip('' + k + '：文件夹：【' + (targetData.parent ? targetData.parent : '') + '/' + dirName + '】已存在');
  //     }
  //     infoTip('开始获取该文件夹中的数据...');
  //     getPageData(targetData.url, (targetData.parent ? targetData.parent + '/' : '') + dirName);
  //   }
  //   keys.splice(keys[keys.length - 1], 1);
  // }
  // return;
  // infoTip('当前的数据结构：');
  // infoTip(JSON.stringify(data, null, '\t'));
  // infoTip('获取到以下资源：');
  // for (let i in data) {
  //     if (hasWait) {
  //       warnTip('有等待的对列，暂停处理');
  //       break;
  //     }
  //     (function (index){

      // })(i);
  // }
  function process (){
    if (si) {
      return;
    }
    if (!keys || keys.length <= 0) {
      return;
    }
    var pathObj = path.parse(data[keys[0]].url);
    var dirName = urlencode.decode(pathObj.base, 'utf-8');
    var fullPath;
    // 处理父目录不存在的问题
    if (!data[keys[0]].parent) {
      if (pathObj.dir.charAt(pathObj.dir.length - 1) !== '/') {
        pathObj.dir += '/';
      }
      data[keys[0]].parent = urlencode.decode(pathObj.dir.replace(pageUrl, ''));
    }
    if (data[keys[0]].parent && data[keys[0]].parent.charAt(0) === '/') {
      data[keys[0]].parent = data[keys[0]].parent.substr(1);
    }
    // 是个目录
    if (!pathObj.ext) {
      resultData.dirs.push(data[keys[0]]);
      fullPath = resourcesDir + (data[keys[0]].parent ?  '/' + data[keys[0]].parent : '') + '/' + dirName;
      if (!isLoaded(fullPath)) {
        // infoTip('开始获取该文件夹中的数据...');
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath);
          writeLog(fullPath);
          successTip('' + k + '：文件夹：【' + (data[keys[0]].parent ? data[keys[0]].parent : '') + '/' + dirName + '】本地已创建成功');
        } else {
          warnTip('' + k + '：文件夹：【' + (data[keys[0]].parent ? data[keys[0]].parent : '') + '/' + dirName + '】已存在');
          writeLog(fullPath);
        }
      }
      if (k > 0) {
        k--;
      }
      getPageData(data[keys[0]].url, (data[keys[0]].parent ? data[keys[0]].parent + '/' : '') + dirName);
    } else {
      resultData.files.push(data[keys[0]]);
      fullPath = urlencode.decode(resourcesDir + (data[keys[0]].parent ?  '/' + data[keys[0]].parent : '') + '/' + pathObj.base);
      if (!isLoaded(fullPath, 'file')) {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          warnTip('已删除本地 ' + fullPath);
        }
        downloadFile(host + data[keys[0]].url , fullPath);
      } else {
        if (loadingCount > 0) {
          loadingCount--;
        }
      }
    }
    if (keys.length > 0) {
      delete data[keys[0]];
      keys.splice(0, 1);
      process();
    }
  }
  process();
}

function downloadFile(mp4Url, filepath, callback) {
  if (loadingCount > loadingFileMax) {
    warnTip('下载数量' + loadingCount + '，已达上限，加入等待队列');
    si = setTimeout(function() {
      reset();
      getPageData(currentUrl);
    }, 1000 * 60 * 30);
    return;
  }
  if (loadingCount <= loadingFileMax) {
    loadingCount++;
  }
  infoTip(loadingCount + ' 正在下载【' + filepath + '】');
  var file = fs.createWriteStream(filepath);

  try {
    var req = https.get(mp4Url, function(res) {
      res.on('data', function(data) {
        file.write(data);
      }).on('end', function() {
        file.end();
        successTip(filepath + '下载完成');
        writeLog(filepath, 'file');
        if (loadingCount > 0) {
          loadingCount--;
        }
        if (loadingCount <= 0) {
          reset();
          getPageData(pageUrl);
        }
        callback && callback();
      });
    });
    req.on('error', (error) => {
        console.error(error);
    });
  } catch (e) {
    errorTip('网络异常');
  }
}

function writeLog(fileName, type) {
  // 记录日志
  try {
    var existLogs = fs.readFileSync( type === 'file' ? loadedFilesLogs: loadedDirLogs, 'utf-8') ? JSON.parse(fs.readFileSync( type === 'file' ? loadedFilesLogs: loadedDirLogs)) : null;
    if(!existLogs) {
      existLogs = [];
    }
    if (existLogs && existLogs.indexOf(fileName) < 0) {
      existLogs.push(fileName);
    }
    fs.writeFileSync(type === 'file' ? loadedFilesLogs: loadedDirLogs, JSON.stringify(existLogs));
    successTip('写入日志成功');
  } catch (e) {
    errorTip('写入日志失败');
  }
}

function isLoaded(fullPath, type) {
  var existLogs = fs.readFileSync( type === 'file' ? loadedFilesLogs: loadedDirLogs, 'utf-8') ? JSON.parse(fs.readFileSync( type === 'file' ? loadedFilesLogs: loadedDirLogs)) : null;
  if(!existLogs) {
    return false;
  }
  if (existLogs.indexOf(fullPath) < 0) {
    return false;
  } else {
    return true;
  }
}

function reset(){
  // 初始化变量
  // hasWait = false;
  k = 0;
  loadingCount = 0;
  if (si) {
    clearTimeout(si);
  }
  si = null;
}

function getPageData(url, parent) {
  if (k > kMax) {
    // hasWait = true;
    warnTip('任务数量' + k + '，已达上限，加入等待队列');
    si = setTimeout(function() {
      reset();
      getPageData(currentUrl);
    }, 1000 * 30 * 1); // 30m后再处理这条请求
    return;
  }
  var resources = {};
  if (k < kMax) {
    k++;
  }
  currentUrl = url;
  infoTip('准备抓取【' + (host + urlencode.decode(url)) + '】的数据');
  download(host + url, function(data) {
    if (data) {
      // successTip('抓取成功');
      const $ = cheerio.load(data);
      // infoTip('开始解析');
      $('a').each(function (k, v) {
        // 过滤不相关的链接
        if ($(v).text() != '[To Parent Directory]') {
          resources[$(v).text()] = {
            url : $(v).attr('href'),
            children: {},
            parent : parent
          }
        }
      });
      // successTip('解析成功！');
      getPageDataSuccess(resources);
    } else {
      errorTip('抓取失败');
    }
  });
}

function infoTip(text){
  console.log(text + '\n');
}
function successTip(text){
  console.log(text.green + '\n');
}
function warnTip(text){
  console.log(text.yellow + '\n');
}
function errorTip(text){
  console.log(text.red + '\n');
}
getPageData(pageUrl);

process.on('uncaughtException', function (err) {
  console.error(err.stack);
  console.log("Node NOT Exiting...");
  reset();
  getPageData(pageUrl);
});