
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
function getPageDataSuccess(data) {
  infoTip('当前的数据结构：');
  infoTip(JSON.stringify(data, null, '\t'));
  infoTip('获取到以下资源：');
  for (let i in data) {
      (function (index){
        var pathObj = path.parse(data[index].url);
        var dirName = urlencode.decode(pathObj.base, 'utf-8');
        var fullPath;
        // 是个目录git init
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
              } else {
                  warnTip('' + k + '：文件夹：【' + (data[index].parent ? data[index].parent : '') + '/' + dirName + '】已存在');
                  infoTip('开始获取该文件夹中的数据...');
                  getPageData(data[index].url, (data[index].parent ? data[index].parent + '/' : '') + dirName);
              }
          });
        } else {
          resultData.files.push(data[index]);
          fullPath = urlencode.decode(resourcesDir + (data[index].parent ?  '/' + data[index].parent : '') + '/' + pathObj.base);
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
        }
      })(i);
      k++;
      break;
  }
}

function downloadFile(mp4Url, filepath, callback) {
  infoTip('正在下载【' + filepath + '】');
  var file = fs.createWriteStream(filepath);

  https.get(mp4Url, function(res) {
    res.on('data', function(data) {
      file.write(data);
    }).on('end', function() {
      file.end();
      successTip(filepath + '下载完成');
      writeLog(filepath);
    });
  });
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
writeLog('/home/user/dir/file.txt');
function getPageData(url, parent) {
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