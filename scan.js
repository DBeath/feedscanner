var app = require('./scanner.js');
var fs = require('fs');
var lazy = require('lazy');
var async = require('async');

var scanner = app.createScanner({
  charset: 'UTF-8',
  scanInterval: 30,
  concurrent: 20
});

var feedList = [];
var time;

async.series({
  lazy: function (callback) {
    new lazy(fs.createReadStream('./test/superfeedr_popular_feeds.txt'))
    .on('end', function () {
        callback(null);
    })
    .lines
    .forEach(function (line) {
      feedList.push(line.toString());
    });
  },
  addFeeds: function (callback) {
    scanner.addFeeds(feedList.slice(0,500), function () {
      callback(null);
    });
  },
  scan: function (callback) {
    time = process.hrtime();
    scanner.scan(function () {
      callback(null);
    });
  }
},function (err, results) {
  console.log('Finished array');
});

var numfired = 0;
scanner.on('feed_meta', function (data) {
  var diff = process.hrtime(time);
  console.log('%dms, Feed: %s, Title: %s', diff[1] / 1000000, data.feed, data.meta.title);
  numfired += 1;
  console.log(numfired);
  
});

scanner.on('error', function (err) {
  console.log(err);
}); 


// setTimeout(function () {
//   console.log(feedList);
// }, 500);