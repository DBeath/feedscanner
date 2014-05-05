var app = require('./scanner.js');
var fs = require('fs');
var lazy = require('lazy');
var async = require('async');
var MongoClient = require('mongodb').MongoClient;
var mongodb = require('mongodb');

var scanner = app.createScanner({
  charset: 'UTF-8',
  scanInterval: 30,
  concurrent: 5
});

var sliceStart = 0;
var sliceEnd = 10;

var feedList = [];
var time;

var numfired = 0;
var numerrors = 0;

var entries;

async.series({
  db: function (callback) {
    MongoClient.connect('mongodb://localhost:27017/feedscanner', function (err, db) {
      if (err) return callback(err);
      entries = new mongodb.Collection(db, 'entries');
      callback(null);
    });
  },
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
    scanner.addFeeds(feedList.slice(sliceStart,sliceEnd), function () {
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
  if (err) {
    console.log(err);
    process.exit();
  };
  console.log('Finished array');
});

scanner.on('feed', function (data) {
  var diff = process.hrtime(time);
  if (data.meta) {
    console.log('%ds:%dms, Feed: %s, Title: %s', diff[0],diff[1] / 1000000, data.feed, data.meta.title);
  } else {
    console.log('no meta for %s', data.feed);
  };
  data.articles.forEach(function (item, index, array) {
    entries.update({
      id: item.guid
    },
    item,
    {
      upsert: true,
      w: 1
    },
    function (err, result) {
      if (err) console.log(err);
      console.log('Updated %s', item.title);
    });
  });
  numfired += 1;
});

scanner.on('error', function (data) {
  console.log('Received error');
  console.log(data.feed + ' : ' + data.err);
  numerrors += 1;
}); 

scanner.on('end', function (data) {
  var diff = data.time;
  console.log('*/---------------------------------------------------------');
  console.log('Finished sending feed requests in %ds:%dms', diff[0], diff[1] / 1000000);
  console.log('*/---------------------------------------------------------');
});