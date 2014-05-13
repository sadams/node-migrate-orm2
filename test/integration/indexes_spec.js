var should  = require('should');
var helpers = require('../helpers');
var Task    = require('./../../');

describe('node-migrate-orm2', function (done) {
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

  beforeEach(function(done){
    task = new Task(conn, { dir: 'migrations' });
    helpers.cleanupDir('migrations', done);
  });

  afterEach(function (done) {
    helpers.cleanupDbAndDir(conn, task.dir, ['table1'], done);
  });

  describe('#addIndex', function() {

    beforeEach(function(done){
      task.mkdir(function(err, result){
        helpers.writeMigration(task, '001-create-table1.js', table1Migration);
        helpers.writeMigration(task, '002-add-one-index.js', index1Migration);
        done();
      });
    });

    it('runs one up migration successfully', function (done) {
      task.up(function (err, result) {
        should.not.exist(err);

        if (conn.config.protocol === 'postgresql'){
          conn.execQuery(
            'SELECT indexname FROM pg_indexes WHERE indexname = ?',
            ['name_idx'],
            function (err, result) {
              should.not.exist(err);
              should.equal(result[0].indexname, 'name_idx');
              done();
            }
          );
        } else { // MySQL
          conn.execQuery(
            "SHOW INDEX FROM ?? WHERE ?? = ?", ['table1', 'Key_name', 'name_idx'], function (err, results) {
              should.not.exist(err);
              should.equal(results[0].Key_name, 'name_idx');
              done();
            }
          );
        }
      });
    });
  });

  describe('#dropIndex', function() {
    beforeEach(function(done){
      task.mkdir(function(err, result){
        helpers.writeMigration(task, '001-create-table1.js', table1Migration);
        helpers.writeMigration(task, '002-add-one-index.js', index1Migration);
        done();
      });
    });

    it('drops the index in a down function', function(done){
      task.up(function (err, result) {
        should.not.exist(err);
        task.down(function (err, result) {
          should.not.exist(err);

          if (conn.config.protocol === "postgresql"){
            conn.execQuery(
              'SELECT indexname FROM pg_indexes WHERE indexname = ?',
              ['name_idx'],
              function (err, result) {
                should.not.exist(err);
                result.should.be.empty;
                done();
              }
            );
          } else { // MySQL
            conn.execQuery(
              "SHOW INDEX FROM ?? WHERE ?? = ?", ['table1', 'Key_name', 'name_idx'], function (err, results) {
                should.not.exist(err);
                should.equal(results.length, 0);
                done();
              }
            );
          }
        });
      });
    });
  });
});

var table1Migration = "exports.up = function (next) {          \n\
this.createTable('table1', {                                   \n\
  id     : { type : \"serial\", key: true },                   \n\
  name   : { type : \"text\", required: true }                 \n\
}, next);                                                      \n\
};                                                             \n\
                                                               \n\
exports.down = function (next){                                \n\
  next();                                                      \n\
};";

var index1Migration = "exports.up = function (next) {          \n\
this.addIndex('name_idx', {                                    \n\
  table: 'table1',                                             \n\
  columns: ['name']                                            \n\
}, next);                                                      \n\
};                                                             \n\
exports.down = function(next){                                 \n\
  console.log('running the down') \n\
  this.dropIndex('name_idx', 'table1', next);                  \n\
};";
