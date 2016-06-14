var should  = require('should');
var helpers = require('../helpers');
var Task    = require('./../../');

describe('Migrator', function(done) {
  var task;
  var conn;

  before(function (done) {
    helpers.connect(function(err, connection) {
      if (err) return done(err);

      conn = connection;
      done();
    });
  });

  after(function (done) {
    helpers.cleanupDir('migrations', function() {
      conn.close(done);
    });
  });

  //ensure the migration folder is cleared before each test
  beforeEach(function(done) {
    task = new Task(conn, { dir: 'migrations' });
    helpers.cleanupDbAndDir(conn, task.dir, ['table1', 'table2'], function(){
      task.setup(function(err) {
        should.not.exist(err);
        helpers.writeMigration(task, '001-create-table1.js', table1Migration);
        helpers.writeMigration(task, '002-add-two-columns.js', column2Migration);
        done();
      });
    });
  });

  describe('#up', function(done) {
    it('runs a no arg up migrations successfully', function(done) {
      task.up(function(err, result) {
        conn.execQuery('SELECT count(*) FROM ??', ['orm_migrations'], function(err, result) {
          should.equal(result[0]['count'] || result[0]['count(*)'], 2);
          done();
        });
      })
    });

    it('runs a specific up migration successfully', function(done) {
      task.up('001-create-table1.js', function(err, result) {
        conn.execQuery('SELECT count(*) FROM ??', ['orm_migrations'], function(err, result) {
          should.equal(result[0]['count'] || result[0]['count(*)'], 1);
          done();
        });
      })
    });

    it('runs two migrations successfully', function(done) {
      task.up(function(err, result){
        conn.execQuery(
          'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND column_name LIKE ?',
          ['table1', 'wobble'],
          function (err, result) {
            if (err) return done(err);

            should.equal(result[0].column_name, 'wobble');

            conn.execQuery(
              'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND column_name LIKE ?',
              ['table1', 'wibble'],
              function (err, result) {
                should.equal(result[0].column_name, 'wibble');
                done();
              }
            );
          }
        );
      });
    });

    it('doesnt re perform existing migration', function(done) {
      task.up('001-create-table1.js', function(err, result) {
        should.not.exist(err);
        task.up(function(err, result) {
          should.not.exist(err);
          conn.execQuery('SELECT count(*) FROM ??', ['orm_migrations'], function(err, result) {
            should.equal(result[0]['count'] || result[0]['count(*)'], 2);
            done();
          });
        });
      });
    });
  });

  describe('#down', function(done) {
    it('runs a no arg down migrations successfully (one step)', function(done) {
      task.up(function(err, result) {
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result) {
          should.equal(result.length, 2);
          task.down(function(err, result) {
            should.not.exist(err);
            conn.execQuery('SELECT * FROM orm_migrations', function(err, result) {
              should.not.exist(err);
              should.equal(result.length, 1);
              done();
            });
          });
        });
      });
    });
    it('runs down migrations using name (including)', function(done){
      task.up(function(err, result) {
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result) {
          should.equal(result.length, 2);
          task.down('001-create-table1.js', function(err, result) { // revert 002 then 001
            should.not.exist(err);
            conn.execQuery('SELECT * FROM orm_migrations', function(err, result) {
              should.not.exist(err);
              should.equal(result.length, 0); // no recorded migrations
              conn.execQuery(
                'SELECT count(*) FROM INFORMATION_SCHEMA.TABLES WHERE table_name = ?',
                ['table1'],
                function (err, result) {
                  should.equal(result[0]['count'] || result[0]['count(*)'], 0); // no table1 exist
                  done();
                }
              );
            });
          });
        });
      });
    });
  });
});

var table1Migration = "exports.up = function (next) {          \n\
this.createTable('table1', {                                   \n\
  id     : { type : \"integer\", key: true },                  \n\
  name   : { type : \"text\", required: true }                 \n\
}, next);                                                      \n\
};                                                             \n\
                                                               \n\
exports.down = function (next){                                \n\
  this.dropTable('table1', next);                              \n\
};";

var column2Migration = "exports.up = function (next) {         \n\
  var that = this;                                             \n\
  this.addColumn('table1', {                                   \n\
    wobble   : { type : \"text\", required: true }             \n\
  }, function(err) {                                           \n\
    if(err) { return next(err); }                              \n\
    that.addColumn('table1', {                                 \n\
      wibble   : { type : \"text\", required: true }           \n\
    }, next);                                                  \n\
  });                                                          \n\
};                                                             \n\
exports.down = function(next){                                 \n\
  var that = this;                                             \n\
  this.dropColumn('table1', 'wibble', function(err){           \n\
    if(err) { return next(err); }                              \n\
    that.dropColumn('table1', 'wobble', next);                 \n\
  });                                                          \n\
};";
