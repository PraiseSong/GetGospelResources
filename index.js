
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
var urlencode = require('urlencode');

// 福音影视网下载目录
var host = 'https://downs.fuyin.tv';
// 福音证道
var pageUrl = '/pcdown/06%E7%A6%8F%E9%9F%B3%E8%AF%81%E9%81%93/';
// 存储的目录
var resourcesDir = './resources';

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

function getPageDataSuccess(data) {
  console.log('解析成功，获取到以下资源：' + '\n');
  for (let i in data) {
      (function (index){
        var pathObj = path.parse(data[index].url);
        var dirName = urlencode.decode(pathObj.base, 'utf-8');
        var fullPath;
        // 是个目录git init
        if (!pathObj.ext) {
          fullPath = resourcesDir + (data[index].parent ?  '/' + data[index].parent : '') + '/' + dirName;
          fs.exists(fullPath, (exists) => {
              if (!exists) {
                fs.mkdir(fullPath, () => {
                    console.log('文件夹：' + (data[index].parent ? data[index].parent : '') + '/' + dirName + ' ，本地已创建成功' + '\n');
                });
              } else {
                console.log('文件夹：' + (data[index].parent ? data[index].parent : '') + '/' + dirName + ' ，已存在' + '\n');
              }
              console.log('开始获取该文件夹中的数据...\n');
              getPageData(data[i].url, (data[index].parent ? data[index].parent + '/' : '') + dirName);
          });
        } else {
          fullPath = urlencode.decode(resourcesDir + (data[index].parent ?  '/' + data[index].parent : '') + '/' + pathObj.base);
          fs.exists(fullPath, (exists) => {
            if (exists) {
              // 如果本地有历史文件就删除
              fs.unlink(fullPath);
            }
            downloadFile(host + data[index].url , fullPath);
          });
        }
      })(i);
      break;
  }
}

function downloadFile(mp4Url, filepath, callback) {
  console.log('正在下载' + filepath + '...\n');
  var file = fs.createWriteStream(filepath);

  https.get(mp4Url, function(res) {
    res.on('data', function(data) {
      file.write(data);
    }).on('end', function() {
      file.end();
      console.log(filepath + '下载完成\n');
    });
  });
}

function getPageData(url, parent) {
  var resources = {};
  download(host+url, function(data) {
    if (data) {
      console.log('获取资源成功！' + urlencode.decode(host+url) + '\n');
      const $ = cheerio.load(data);
      console.log('开始解析页面...' + '\n');
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
      getPageDataSuccess(resources);
    } else {
      console.log('error');
    }
  });
}
getPageData(pageUrl);

