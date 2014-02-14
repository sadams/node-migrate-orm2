var should  = require('should');
var fs      = require('fs');
var helpers = require('../helpers');
var Task    = require('./../../');


describe('node-migrate-orm2', function (done) {
  var task;
  var conn;

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

  afterEach(function (done) {
    helpers.cleanupDbAndDir(conn, task.dir, ['table1'], done);
  });

  describe('#addIndex', function() {

    beforeEach(function(done){
      task.mkdir(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, done);
      });
    });

    it('runs one up migration successfully', function(done){
      fs.writeFile(task.dir + '/002-add-one-index.js', index1Migration, function(err, result){
        task.up(function(err, result){
          if (conn.config.protocol === 'postgresql'){
            conn.execQuery(
              'SELECT indexname FROM pg_indexes WHERE indexname = ?',
              ['name_idx'],
              function (err, result) {
                should.equal(result[0].indexname, 'name_idx');
                done();
              }
            );
          }
          else{ //we say it's MySQL
            conn.execQuery(
              'SELECT name FROM information_schema.innodb_sys_indexes WHERE name = ?',
              ['name_idx'],
              function (err, result) {
                should.equal(result[0].name, 'name_idx');
                done();
              }
            );
          }
        });
      });
    });
  });

  describe('#dropIndex', function() {

    beforeEach(function(done){
      task.mkdir(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, done);
      });
    });

    it('drops the index in a down function', function(done){
      fs.writeFile(task.dir + '/002-add-one-index.js', index1Migration, function(err, result){
        task.up(function(err, result){
          task.down(function(err, result){
            if (conn.config.protocol === "postgresql"){
              conn.execQuery(
                'SELECT indexname FROM pg_indexes WHERE indexname = ?',
                ['name_idx'],
                function (err, result) {
                  result.should.be.empty;
                  done();
                }
              );
            }
            else {
              conn.execQuery(
                'SELECT name FROM information_schema.innodb_sys_indexes WHERE name = ?',
                ['name_idx'],
                function (err, result) {
                  result.should.be.empty;
                  done();
                }
              );
            }
          });
        });
      });
    });
  });
});

var table1Migration = "exports.up = function (next) {         \n\
this.createTable('table1', {                                  \n\
  id     : { type : \"number\", primary: true, serial: true },\n\
  name   : { type : \"text\", required: true }                \n\
}, next);                                                     \n\
};                                                            \n\
                                                              \n\
exports.down = function (next){                               \n\
  this.dropTable('table1', next);                             \n\
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
