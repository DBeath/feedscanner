var expect = require('chai').expect;
var http = require('http');
var app = require('../app.js');
var fs = require('fs');
var path = require('path');

var scanner = app.createScanner({
  charset: 'utf-8'
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

  it('should emit article event', function (done) {
    var eventFired = false;
    scanner.fetch('http://localhost:3000/rss.xml');

    scanner.on('article', function (data) {
      eventFired = true;
    });

    setTimeout(function () {
      expect(eventFired).to.equal(true);
      done();
    }, 20);
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
});