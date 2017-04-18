
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
var resourcesDir = '/Volumes/MY PASSPORT/Video-from-fuyinTV-with-nodejs';
// 解析后的数据
var resultData = {
  files: [],
  dirs: []
};
// 日志
var logsFile = 'logs.json';

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

var k = 0;
var loadingCount = 0;
var si = null;// 轮询查询
function getPageDataSuccess(data) {
  if (k > 3) {
    warnTip('任务数量' + k + '，已达上限，加入等待队列');
    si = setTimeout(function() {
      getPageData(pageUrl);
    }, 1000 * 60 * 15);
    return;
  }

  // infoTip('当前的数据结构：');
  // infoTip(JSON.stringify(data, null, '\t'));
  infoTip('获取到以下资源：');
  for (let i in data) {
      (function (index){
        var pathObj = path.parse(data[index].url);
        var dirName = urlencode.decode(pathObj.base, 'utf-8');
        var fullPath;
        // 是个目录
        if (!pathObj.ext) {
          resultData.dirs.push(data[index]);
          fullPath = resourcesDir + (data[index].parent ?  '/' + data[index].parent : '') + '/' + dirName;
          fs.exists(fullPath, (exists) => {
              if (!exists) {
                fs.mkdir(fullPath, () => {
                  successTip('' + k + '：文件夹：【' + (data[index].parent ? data[index].parent : '') + '/' + dirName + '】本地已创建成功');
                  infoTip('开始获取该文件夹中的数据...');
                  getPageData(data[index].url, (data[index].parent ? data[index].parent + '/' : '') + dirName);
                });
                k++;
              } else {
                  warnTip('' + k + '：文件夹：【' + (data[index].parent ? data[index].parent : '') + '/' + dirName + '】已存在');
                  infoTip('开始获取该文件夹中的数据...');
                  getPageData(data[index].url, (data[index].parent ? data[index].parent + '/' : '') + dirName);
                k--;
              }
          });
        } else {
          resultData.files.push(data[index]);
          fullPath = urlencode.decode(resourcesDir + (data[index].parent ?  '/' + data[index].parent : '') + '/' + pathObj.base);
          if (!isLoaded(fullPath)) {
            fs.exists(fullPath, (exists) => {
                if (exists) {
                  // 如果本地有历史文件就删除
                  fs.unlink(fullPath, () => {
                      warnTip('已删除本地 ' + fullPath);
                      downloadFile(host + data[index].url , fullPath);
                  });
                } else {
                  downloadFile(host + data[index].url , fullPath);
                }
            });
            k++;
          } else {
            loadingCount--;
            k--;
          }
        }
      })(i);
  }
}

function downloadFile(mp4Url, filepath, callback) {
  if (loadingCount > 8) {
    warnTip('下载数量' + loadingCount + '，已达上限，加入等待队列');
    si = setTimeout(function() {
      getPageData(pageUrl);
    }, 1000 * 60 * 30);
    return;
  }
  infoTip('正在下载【' + filepath + '】');
  var file = fs.createWriteStream(filepath);

  try {
    https.get(mp4Url, function(res) {
      res.on('data', function(data) {
        file.write(data);
      }).on('end', function() {
        file.end();
        successTip(filepath + '下载完成');
        writeLog(filepath);
      });
    });
    loadingCount++;
  } catch (e) {
    errorTip('网络异常');
  }
}

function writeLog(fileName) {
  // 记录日志
  try {
    var existLogs = fs.readFileSync( logsFile, 'utf-8') ? JSON.parse(fs.readFileSync( logsFile)) : null;
    if(!existLogs) {
      existLogs = [];
    }
    if (existLogs && existLogs.indexOf(fileName) < 0) {
      existLogs.push(fileName);
    }
    fs.writeFileSync(logsFile, JSON.stringify(existLogs));
    successTip('写入日志成功');
  } catch (e) {
    errorTip('写入日志失败');
  }
}

function isLoaded(fullPath) {
  var existLogs = fs.readFileSync( logsFile, 'utf-8') ? JSON.parse(fs.readFileSync( logsFile)) : null;
  if(!existLogs) {
    return false;
  }
  if (existLogs.indexOf(fullPath) < 0) {
    return false;
  } else {
    return true;
  }
}

function getPageData(url, parent) {
  // 初始化变量
  k = 0;
  loadingCount = 0;
  if (si) {
    clearTimeout(si);
    si = null;
  }
  infoTip('准备抓取【' + (host + urlencode.decode(url)) + '】的数据');
  var resources = {};
  download(host + url, function(data) {
    if (data) {
      successTip('抓取成功');
      const $ = cheerio.load(data);
      infoTip('开始解析');
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
      successTip('解析成功！');
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