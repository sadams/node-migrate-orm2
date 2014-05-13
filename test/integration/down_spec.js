var should  = require('should');
var helpers = require('../helpers');
var Task    = require('./../../');

describe('down', function (done) {
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
    helpers.cleanupDir('migrations', done);
  });

  beforeEach(function () {
    task = new Task(conn, { dir: 'migrations' });
  });

  afterEach(function (done) {
    helpers.cleanupDbAndDir(conn, task.dir, ['table1'], done);
  });

  it('runs a no arg down migrations successfully', function(done){
    down = function(err, cb){
      task.down(function(err, result){
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
          should.equal(result.length, 2);
          conn.execQuery('desc table)', function(err, result){
            err.should.exist
            cb();
          });
        })
      })
    }

    task.mkdir(function(err, result){
      helpers.writeMigration(task, '001-create-table1.js',  table1Migration);
      task.up(function(err, result){
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
          should.equal(result.length, 1);
          should.equal(result[0].direction, 'up');

          conn.execQuery(
            'SELECT count(*) FROM INFORMATION_SCHEMA.TABLES WHERE table_name = ? and table_schema = ?',
            ['table1', 'test'],
            function (err, result) {
              should.equal(result.length, 1);
              down(null, done);
            }
          );
        });
      });
    })
  });

  it('runs a specific (and legitimate) down migration successfully', function(done){
    down = function(err, cb){  //tidy this up, it's a copy n paste from the no arg down
      task.down('001-create-table1.js', function(err, result){
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
          should.equal(result.length, 2);
          conn.execQuery(
            'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? and table_schema = ?',
            ['table1', 'test'],
            function (err, result) {
              should.equal(result.length, 0);
              cb();
            }
          );
        })
      })
    }

    task.mkdir(function (err, result) {
      helpers.writeMigration(task, '001-create-table1.js', table1Migration);
      task.up(function(err, result){
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
          should.equal(result.length, 1);
          should.equal(result[0].direction, 'up')

          conn.execQuery(
            'SELECT count(*) FROM INFORMATION_SCHEMA.TABLES WHERE table_name = ?',
            ['table1'],
            function (err, result) {
              should.equal(result.length, 1);
              down(null, done);
            }
          );
        });
      });
    })
  });
});


var table1Migration = "exports.up = function (next) {         \n\
this.createTable('table1', {                                  \n\
  id     : { type : \"serial\", key: true },                  \n\
  name   : { type : \"text\", required: true }                \n\
}, next);                                                     \n\
};                                                            \n\
                                                              \n\
exports.down = function (next){                               \n\
  this.dropTable('table1', next);                             \n\
};";
