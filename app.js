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

function FeedScanner(options) {
  this.charset = options.charset || 'utf-8';
  this.interval = options.interval;
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

FeedScanner.prototype.removeAllFeeds = function (callback) {
  feeds.splice(0, feeds.length+1);
  return callback();
};

FeedScanner.prototype.scan = function (callback) {
  this.q = async.queue((function (feed, donefetch) {
    this.fetch(feed);
  }).bind(this), 20);

  this.q.drain = function () {
    console.log('Finished fetching feeds');
    return callback();
  };

  this.q.push(this.feeds, function (err) {
    if (err) return console.error(err);
    return;
  });
};

FeedScanner.prototype.fetch = function (feed) {
  if (!validator.isURL(feed)) {
    return this.emit('error', new Error('Not a valid URL'));
  };
  var charset = this.charset;
  var scanner = this;

  var req = request(feed, {timeout: 10000, pool: false});
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
      return this.emit('error', new Error('Bad status code'));
    };

    resCharset = getParams(res.headers['content-type'] || '').charset;

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
    scanner.emit('feed_meta', meta);
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

function done(err) {
  if (err) return console.log(err, err.stack);
};