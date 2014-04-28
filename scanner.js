var request = require('request');
var async = require('async');
var IConv = require('iconv').Iconv;
var FeedParser = require('feedparser');
var validator = require('validator');
var events = require('events');
var util = require('util');

module.exports.createScanner = function (options) {
  return new FeedScanner(options);
};

// Creates a FeedScanner object
// * charset - the charset to convert feeds to, can be false
// * scanInterval - how often to scan the feeds, in seconds
// * concurrent - the number of requests to send at once
function FeedScanner(options) {
  this.charset = options.charset || 'utf-8';
  this.scanInterval = options.scanInterval || 300;
  this.concurrent = options.concurrent || 20;

  this.feeds = [];
};

util.inherits(FeedScanner, events.EventEmitter);

FeedScanner.prototype.listFeeds = function () {
  return this.feeds;
};

// Adds an array of feeds to the feeds list
FeedScanner.prototype.addFeeds = function (feeds, callback) {
  feeds.forEach((function (item, index, array) {
    this.feeds.push(item);
  }).bind(this));
  return callback();
};

// Takes an array of feeds and removes each one from the feeds list
FeedScanner.prototype.removeFeeds = function (feeds, callback) {
  feeds.forEach((function (item, index, array) {
    var newIndex = this.feeds.indexOf(item);
    if (newIndex != -1) {
      this.feeds.splice(newIndex, 1);
    };
  }).bind(this));
  return callback();
};

// Removes all feeds from list
FeedScanner.prototype.removeAllFeeds = function (callback) {
  feeds.splice(0, feeds.length+1);
  return callback();
};

FeedScanner.prototype.startScanning = function () {
  var intervalMilliseconds = this.scanInterval * 1000;
  this.interval = setInterval(this.scan(function () {return;}), intervalMilliseconds);
};

FeedScanner.prototype.stopScanning = function () {
  clearInterval(this.interval);
  console.log('Finished scanning');
};

// Fetches all feeds in list
FeedScanner.prototype.scan = function (concurrent, callback) {
  if (!callback) {
    var callback = concurrent;
    var concurrentFeeds = this.concurrent;
  } else {
    var concurrentFeeds = concurrent || this.concurrent;
  };
  var time = process.hrtime();
  console.log('Starting scan of %s feeds', this.feeds.length);
  // The queue function
  var q = async.queue((function (feed, donefetch) {
    this.fetch(feed, function (err) {
      if (err) return donefetch(err);
      return donefetch(null, feed);
    });
  }).bind(this), concurrentFeeds);

  // Called when queue is finished
  q.drain = function () { 
    var diff = process.hrtime(time);
    console.log('Finished sending feed requests in %dms', diff[1] / 1e6);
    callback(null, diff);
  };

  // Add feeds to queue
  q.push(this.feeds, function (err, feed) {
    if (err) return console.error(err);
    return console.log('Finished processing %s', feed);
  });
};

// Fetches a feed
FeedScanner.prototype.fetch = function (feed, callback) {
  if (!validator.isURL(feed)) {
    return this.emit('error', 'Not a valid URL');
  };
  var charset = this.charset;
  var scanner = this;

  // Sets the request
  var req = request(feed, {timeout: 10000});
  req.setHeader('user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2'+ 
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/36.0.1944.0 Safari/537.36');
  req.setHeader('accept', 'text/html,application/xhtml+xml');

  var feedparser = new FeedParser();

  req.on('error', done);
  req.on('response', function (res) {
    var stream = this;
    var iconv;
    var resCharset;

    if (res.statusCode != 200) {
      this.emit('error', 'Bad status code');
    };

    resCharset = getParams(res.headers['content-type'] || '').charset;

    // If charset is different pipe response through iconv
    if (!iconv && resCharset && !charset.match(resCharset)) {
      try {
        iconv = new IConv(resCharset, charset);   
        console.log('Converting from charset %s to %s', resCharset, charset);
        iconv.on('error', done);
        stream = this.pipe(iconv);
      } catch (err) {
        this.emit('error', err);
      };
    };

    stream.pipe(feedparser);
  });

  feedparser.on('error', done);
  feedparser.on('end', done);

  feedparser.on('meta', function (meta) {
    scanner.emit('feed_meta', {
      meta: meta,
      feed: feed
    });
  });

  feedparser.on('readable', function () {
    var item;
    while (item = this.read()) {
      scanner.emit('article', {
        item: item,
        feed: feed
      });
    };
  });

  if (callback && typeof(callback) === 'function') {
    callback();
  };
};

function getParams(str) {
  var params = str.split(';').reduce(function (params, param) {
    var parts = param.split('=').map(function (part) { return part.trim(); });
    if (parts.length === 2) {
      params[parts[0]] = parts[1];
    }
    return params;
  }, {});
  return params;
};

var done = function (err) {
  if (err) console.log(err, err.stack);
};