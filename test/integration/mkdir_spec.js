var should  = require('should');
var fs      = require('fs');
var helpers = require('../helpers');
var Task    = require('./../../');


describe('mkdir (initializes the migrations folder)', function (done) {
  var task;
  var conn;

  //ensure the migration folder is cleared before each test
  beforeEach(function(done){
    helpers.cleanupDir('migrations', done);
  });

  beforeEach(function (done) {
    helpers.connect(function (err, driver) {
      if (err) return done(err);

      conn = driver;
      task = new Task(conn, { dir: 'migrations' });

      done();
    });
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
