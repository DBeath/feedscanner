var expect = require('chai').expect;
var http = require('http');
var app = require('../scanner.js');
var fs = require('fs');
var path = require('path');

var metaFired = false;
var articleFired = false;
var numArticleFired = 0;
var numMetaFired = 0;
var time;

var scanner = app.createScanner({
  charset: 'utf-8'
});

scanner.on('feed_meta', function (data) {
  metaFired = true;
  numMetaFired += 1;
  var diff = process.hrtime(time);
  console.log('%s finished in %d milliseconds', data.feed, diff[1] / 1000000);
});

scanner.on('article', function (data) {
  articleFired = true;
  numArticleFired += 1;
});

describe('scanner', function () {
  before(function (done) {
    var server = http.createServer(function (req, res) {
      var stream = fs.createReadStream(path.resolve(__dirname, './' + req.url));
      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      stream.pipe(res);
    }).listen(3000, function () {
      done();
    });
  });

  it('should add feeds to array', function (done) {
    var feedArray = ['http://test.com', 'http://test2.com'];

    scanner.addFeeds(feedArray, function () {
      feeds = scanner.listFeeds();
      expect(feeds).to.include('http://test.com');
      expect(feeds).to.include('http://test2.com');
      done();
    });
  });

  it('should remove feeds from the array', function (done) {
    var feedArray = ['http://test.com'];

    scanner.removeFeeds(feedArray, function () {
      feeds = scanner.listFeeds();
      expect(feeds).to.include('http://test2.com');
      expect(feeds).to.not.include('http://test.com');
      done();
    });
  });

  it('should remove all feeds from the array', function (done) {
    expect(scanner.listFeeds().length).to.equal(1);
    scanner.removeAllFeeds(function () {
      expect(scanner.feeds.length).to.equal(0);
      done();
    });
  });

  it('should emit article event', function (done) {
    articleFired = false;
    numArticleFired = 0;

    time = process.hrtime();
    scanner.fetch('http://localhost:3000/rss.xml');

    setTimeout(function () {
      expect(articleFired).to.equal(true);
      expect(numArticleFired).to.equal(10);
      done();
    }, 50);
  });

  it('should emit meta event', function (done) {
    metaFired = false;
    numMetaFired = 0;
    time = process.hrtime();
    scanner.fetch('http://localhost:3000/rss.xml');

    setTimeout(function () {
      expect(metaFired).to.equal(true);
      expect(numMetaFired).to.equal(1);
      done();
    }, 50);
  });

  it('should emit multiple meta events', function (done) {
    numMetaFired = 0;
    scanner.removeAllFeeds(function () {
      expect(scanner.feeds.length).to.equal(0);
    });
    var feedArray = ['http://localhost:3000/rss.xml', 'http://localhost:3000/iconv.xml'];
    scanner.addFeeds(feedArray, function () {
      expect(scanner.feeds.length).to.equal(2);
      expect(scanner.listFeeds()).to.include('http://localhost:3000/rss.xml');
    });

    time = process.hrtime();
    scanner.scan(function () {
      return;
    });

    setTimeout(function () {
      expect(numMetaFired).to.equal(2);
      done();
    }, 50);
  });
});