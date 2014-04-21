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
};

util.inherits(FeedScanner, events.EventEmitter);

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
    console.log(resCharset);

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
  if (err) {
    console.log(err +'\n'+ err.stack);
    return process.exit(1);
  }
  return console.log('done');
};
