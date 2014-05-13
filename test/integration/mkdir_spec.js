var should  = require('should');
var fs      = require('fs');
var helpers = require('../helpers');
var Task    = require('./../../');

describe('mkdir (initializes the migrations folder)', function (done) {
  var task;
  var conn;

  before(function (done) {
    helpers.connect(function (err, connection) {
      if (err) return done(err);

      conn = connection;
      done();
    });
  });

  after(function (done) {
    conn.close(done);
  });

  //ensure the migration folder is cleared before each test
  beforeEach(function(done){
    task = new Task(conn, { dir: 'migrations' });
    helpers.cleanupDir('migrations', done);
  });

  describe('#mkdir', function(done){
    afterEach(function (done) {
      helpers.cleanupDir(task.dir, done);
    });

    it('creates the default migrations folder', function(done){
      task.mkdir(
        function(err, result){
          should.not.exist(err);
          fs.exists(task.dir, function(exists){
            exists.should.be.ok;
            done();
          })
        }
      );
    });

    it('creates the migrations folder with the second argument', function(done){
      var task = new Task(conn, {dir: 'db'});

      task.mkdir(
        function(err, result){
          should.not.exist(err);
          fs.exists('db', function(exists){
            exists.should.be.ok;
            helpers.cleanupDir(task.dir, done);
          })
        }
      );
    });
  });
});
