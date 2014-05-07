var app = require('../scanner.js');
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

// Create the processFeed function
var processFeed = function (err, feed, result, callback) {
  if (err) {
    numerrors += 1;
    console.log('%s : %s', feed, err);
    // Return callback on error
    return callback(err);
  };
  numfired += 1;
  if (result.meta) {
    console.log('%ds:%dms, Feed: %s, Title: %s', diff[0],diff[1] / 1000000, feed, result.meta.title);
  } else {
    console.log('no meta for %s', result.feed);
  };
  // Add articles to database
  var bulkop = entries.initializeUnorderedBulkOp();

  result.articles.forEach(function (item, index, array) {
    bulkop.find({id: item.guid}).updateOne(item).upsert();
  });
  
  bulkop.execute();
};

async.series({
  // Initialise the database
  db: function (callback) {
    MongoClient.connect('mongodb://localhost:27017/feedscanner', function (err, db) {
      if (err) return callback(err);
      entries = new mongodb.Collection(db, 'entries');
      callback(null);
    });
  },
  // Read the feeds from a file
  lazy: function (callback) {
    new lazy(fs.createReadStream('../test/superfeedr_popular_feeds.txt'))
    .on('end', function () {
        callback(null);
    })
    .lines
    .forEach(function (line) {
      feedList.push(line.toString());
    });
  },
  // Add the feeds to the scanner
  addFeeds: function (callback) {
    scanner.addFeeds(feedList.slice(sliceStart,sliceEnd), function () {
      callback(null);
    });
  },
  // Start scanning
  scan: function (callback) {
    time = process.hrtime();
    scanner.scan(processFeed, function () {
      console.log('Received %s feeds', numfired);
      console.log('Received %s errors', numerrors);
      callback(null);
    });
  }
},function (err, results) {
  if (err) {
    console.log(err);
  };
  console.log('Finished array');
});

scanner.on('end', function (data) {
  var diff = data.time;
  console.log('Finished sending feed requests in %ds:%dms', diff[0], diff[1] / 1000000);
});