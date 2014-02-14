var should  = require('should');
var fs      = require('fs');
var helpers = require('../helpers');
var Task    = require('./../../');


describe('node-migrate-orm2- primary key DSL', function (done) {
  var task;
  var conn;

  beforeEach(function (done) {
    helpers.connect(function (err, driver) {
      if (err) return done(err);
      conn = driver;
      task = new Task(conn, { dir: 'foo/bar' });
      done();
    });
  });

  afterEach(function (done) {
    helpers.cleanupDbAndDir(conn, task.dir, ['table1'], done);
  });


  describe('adding a primary key', function(done){

    beforeEach(function(done){
      task.mkdir(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          fs.writeFile(task.dir + '/002-add-primary-key-table1.js', table1AddPrimaryKey, function(err, result){
            done();
          });
        })
      })
    });

    it('adds a primary key', function(done){
      task.up('001-create-table1.js', function(err, result){
        task.up('002-add-primary-key-table1.js', function(err, result){
          if (conn.config.protocol === "postgresql"){
            conn.execQuery(pgListPrimaryKeys('table1'), function (err, result) {
              should.equal(result[0].attname, 'price');
              should.not.exist(err);
              done();
            });
          }
          else {
            conn.execQuery('describe table1',
              function (err, result) {
                should.equal(result[0].Field, 'price');
                should.equal(result[0].Key, 'PRI');
                done();
              }
            );
          }
        });
      });
    });

    it('drops a primary key', function(done){
      task.up('001-create-table1.js', function(err, result){
        task.up('002-add-primary-key-table1.js', function(err, result){
          task.down('002-add-primary-key-table1.js', function(err, result){
            if (conn.config.protocol === 'postgresql'){
              conn.execQuery(pgListPrimaryKeys('table1'), function (err, result) {
                should.not.exist(result[0]);
                done();
              });
            }
            else { //we say it's MySQL
              conn.execQuery('describe table1',
                function (err, result) {
                  should.equal(result[0].Field, 'price');
                  should.equal(result[0].Key, '');
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

var table1Migration = "exports.up = function(next){             \n\
this.createTable('table1', {                                    \n\
  price  : { type : \"number\" },                               \n\
}, next);                                                       \n\
};                                                              \n\
                                                                \n\
exports.down = function(next){                                  \n\
  this.dropTable('table1', next);                               \n\
};";

var table1AddPrimaryKey = "exports.up = function(next){         \n\
this.addPrimaryKey('table1', 'price', next);                    \n\
};                                                              \n\
                                                                \n\
exports.down = function(next){                                  \n\
  this.dropPrimaryKey('table1', 'price', next);                 \n\
};";

var pgListPrimaryKeys1 =   "SELECT                              \n\
  pg_attribute.attname,                                         \n\
    format_type(pg_attribute.atttypid, pg_attribute.atttypmod)  \n\
  FROM pg_index, pg_class, pg_attribute                         \n\
  WHERE                                                         \n\
  pg_class.oid = '";

var pgListPrimaryKeys2 =   "'::regclass AND                     \n\
  indrelid = pg_class.oid AND                                   \n\
  pg_attribute.attrelid = pg_class.oid AND                      \n\
  pg_attribute.attnum = any(pg_index.indkey)                    \n\
  AND indisprimary;";


pgListPrimaryKeys = function(tableName){
  return pgListPrimaryKeys1 + tableName + pgListPrimaryKeys2;
}