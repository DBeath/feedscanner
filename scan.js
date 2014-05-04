var app = require('./scanner.js');
var fs = require('fs');
var lazy = require('lazy');
var async = require('async');

var scanner = app.createScanner({
  charset: 'UTF-8',
  scanInterval: 30,
  concurrent: 5
});

var feedList = [];
var time;

var numfired = 0;
var numerrors = 0;

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
    scanner.addFeeds(feedList.slice(0,100), function () {
      callback(null);
    });
  },
  scan: function (callback) {
    time = process.hrtime();
    scanner.scan(function () {
      console.log('Received %s feeds', numfired);
      console.log('Received %s errors', numerrors);
      callback(null);
    });
  }
},function (err, results) {
  console.log('Finished array');
});



scanner.on('feed', function (data) {
  var diff = process.hrtime(time);
  if (data.meta) {
    console.log('%ds:%dms, Feed: %s, Title: %s', diff[0],diff[1] / 1000000, data.feed, data.meta.title);
  } else {
    console.log('no meta for %s', data.feed);
  };
  numfired += 1;
  
});

scanner.on('error', function (data) {
  console.log('Received error');
  console.log(data.feed + ' : ' + data.err);
  numerrors += 1;
}); 


// setTimeout(function () {
//   console.log(feedList);
// }, 500);