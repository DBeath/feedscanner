var request = require('request');
var async = require('async');
var IConv = require('iconv').Iconv;
var FeedParser = require('feedparser');
var validator = require('validator');
var events = require('events');
var util = require('util');

/**
 * Creates a FeedScanner service
 *
 * @module FeedScanner
 * 
 * @param [options] {Object} Options object
 * @param [options.charset] {String} Charset to convert entries to
 * @param [options.scanInterval] {Number} How often the scan will run, in seconds
 * @param [options.concurrent] {Number} Maximum length of the request queue
 * @return {Object} A FeedScanner object
 */
module.exports.createScanner = function (options) {
  return new FeedScanner(options);
};

/**
 * Creates a FeedScanner object
 *
 * @class FeedScanner
 * @constructor
 * @param [options] {Object} Options object
 * @param [options.charset] {String} Charset to convert entries to
 * @param [options.scanInterval] {Number} How often the scan will run, in seconds
 * @param [options.concurrent] {Number} Maximum length of the request queue
 */
function FeedScanner(options) {
  this.charset = options.charset || 'utf-8';
  this.scanInterval = options.scanInterval || 300;
  this.concurrent = options.concurrent || 20;

  this.feeds = [];
  this.startTime = null;
};

util.inherits(FeedScanner, events.EventEmitter);

/**
 * Returns the array of feeds
 *
 * @method listFeeds
 * @return {Array} An array of feeds 
 */
FeedScanner.prototype.listFeeds = function () {
  return this.feeds;
};

/**
 * Adds an array of feeds to the feeds array
 *
 * @method addFeeds
 * @param feeds {Array} An array of feed URLs to add 
 */
FeedScanner.prototype.addFeeds = function (feeds) {
  feeds.forEach((function (item, index, array) {
    this.feeds.push(item);
  }).bind(this));
};

/**
 * Takes an array of feeds and removes each one from the feeds array
 *
 * @method removeFeeds
 * @param feeds {Array} An array of feed URLs to remove
 */
FeedScanner.prototype.removeFeeds = function (feeds) {
  feeds.forEach((function (item, index, array) {
    var newIndex = this.feeds.indexOf(item);
    if (newIndex != -1) {
      this.feeds.splice(newIndex, 1);
    };
  }).bind(this));
};

/**
 * Removes all feeds from the feed array
 *
 * @method removeAllFeeds
 */
FeedScanner.prototype.removeAllFeeds = function () {
  feeds.splice(0, feeds.length+1);
};

/**
 * Starts the interval timer for scanning feeds
 *
 * @method startScanning
 * @param processFeed {Function} Called when feed is fetched
 * @param [interval] {Number} How often the scan will run, in seconds
 */
FeedScanner.prototype.startScanning = function (processFeed, interval) {
  if (processFeed && typeof processFeed != 'function') {
    return new Error('ProcessFeed is not a function');
  };
  var intervalMilliseconds = interval * 1000 || this.scanInterval * 1000;
  this.startTime = process.hrtime();
  this.interval = setInterval(this.scan(processFeed, function (diff) {
    console.log('Queue drained in %ds and %dms', diff[0], diff[1]/1000000);
    return;
  }), intervalMilliseconds);
};

/**
 * Stops the interval timer for scanning feeds
 *
 * @method stopScanning
 */
FeedScanner.prototype.stopScanning = function () {
  clearInterval(this.interval);
  var diff = process.hrtime(this.startTime);
  console.log('Finished scanning after % seconds', diff[0]);
};

/**
 * Fetches all the feeds in the array
 *
 * @method scan
 * @param processFeed {Function} Called when feed is fetched
 * @param cb {Function} Callback containing time for queue to drain
 */
FeedScanner.prototype.scan = function (processFeed, cb) {
  if (processFeed && typeof processFeed != 'function') {
    return new Error('ProcessFeed is not a function');
  };
  var time = process.hrtime();
  console.log('Starting scan of %s feeds', this.feeds.length);
  // The queue function
  var q = async.queue((function (feed, callback) {
    this.fetch(feed, (function (err, result) {

      // Process the feed
      processFeed(err, feed, result, function (err) {
        return callback(err);
      });

    }).bind(this));
  }).bind(this), this.concurrent);
  
  // Called when queue is finished
  q.drain = (function () { 
    var diff = process.hrtime(time);
    
    this.emit('end', {
      time: diff
    });
    return cb(null, diff);
  }).bind(this);

  // Add feeds to queue
  q.push(this.feeds, function (err) {
    if (err) return console.error(err);
    return;
  });
};

/**
 * Fetches a single feed
 *
 * @method fetch
 * @param feed {String} The URL of a feed
 * @param callback {Function} Callback containing error or fetched feed
 */
FeedScanner.prototype.fetch = function (feed, callback) {
  var sentError = false;
  function done(err) {
    //if (err) console.log(err, err.stack);
    if (!sentError) {
      sentError = true;
      return callback(err);
    } else {
      console.log(err);
    };
  };

  if (callback && typeof(callback) != 'function') {
    return done(new Error('Callback is not a function'));
  };

  if (!validator.isURL(feed)) {
    return done(new Error(feed + ' is not a valid URL'));
  };

  var charset = this.charset;
  var scanner = this;

  var feedMeta = null;
  var articles = [];

  // Sets the request
  var req = request(feed, {timeout: 5000, pool: false});
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
      return done(new Error('Bad status code'));
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
        return done(err);
      };
    };

    stream.pipe(feedparser);
  });

  feedparser.on('error', done);
  
  feedparser.on('meta', function (meta) {
    feedMeta = meta;
  });

  feedparser.on('readable', function () {
    var item;
    while (item = this.read()) {
      articles.push(item);
    };
  });

 // Return the feed
  feedparser.on('end', function () {
    if (!sentError) {
      return callback(null, {
        meta: feedMeta,
        articles: articles
      }); 
    };
  });
};

/**
 * Gets the parameters from a header string
 *
 * @method getParams
 * @param str {String} A header string
 */
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