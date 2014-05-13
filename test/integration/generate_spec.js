var should  = require('should');
var fs      = require('fs');
var helpers = require('../helpers');
var Task    = require('./../../');


describe('generate a migration', function (done) {
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

  describe('#generate', function(done){
    afterEach(function (done) {
      helpers.cleanupDir(task.dir, done);
    });

    it('generates a migration', function(done){
      task.generate('test1', function(err, filename){
        var filePath = this.process.cwd() +  '/' + task.dir + '/' + filename + '.js';
        fs.exists(filePath, function(exists){
          exists.should.be.ok;
          done()
        });
      });
    });

    it('generates a coffee migration', function(done){
      task = new Task(conn, {coffee: true});
      task.generate('test1', function(err, filename){
        var filePath = this.process.cwd() +  '/' + task.dir + '/' + filename + '.coffee';
        fs.exists(filePath, function(exists){
          exists.should.be.ok;
          done()
        });
      });
    });
  })
});
