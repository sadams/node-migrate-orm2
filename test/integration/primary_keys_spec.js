var should  = require('should');
var helpers = require('../helpers');
var Task    = require('./../../');

describe('node-migrate-orm2- primary key DSL', function (done) {
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
    helpers.cleanupDbAndDir(conn, task.dir, ['table_primary_keys'], done);
  });

  afterEach(function (done) {
    helpers.cleanupDir('migrations', done);
  });

  describe('adding a primary key', function(done){

    beforeEach(function(done){
      task.mkdir(function(err, result){
        helpers.writeMigration(task, '001-create-table1.js',          table1Migration);
        helpers.writeMigration(task, '002-add-primary-key-table1.js', table1AddPrimaryKey);
        done();
      })
    });

    it('adds a primary key', function(done){
      task.up('001-create-table1.js', function(err, result){
        task.up('002-add-primary-key-table1.js', function(err, result){
          if (conn.config.protocol === "postgresql"){
            conn.execQuery(pgListPrimaryKeys('table_primary_keys'), function (err, result) {
              should.equal(result[0].attname, 'price');
              should.not.exist(err);
              done();
            });
          }
          else {
            conn.execQuery('describe table_primary_keys',
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
              conn.execQuery(pgListPrimaryKeys('table_primary_keys'), function (err, result) {
                should.not.exist(result[0]);
                done();
              });
            }
            else { //we say it's MySQL
              conn.execQuery('describe table_primary_keys',
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
this.createTable('table_primary_keys', {                        \n\
  price  : { type : \"number\" },                               \n\
}, next);                                                       \n\
};                                                              \n\
                                                                \n\
exports.down = function(next){                                  \n\
  this.dropTable('table_primary_keys', next);                   \n\
};";

var table1AddPrimaryKey = "exports.up = function(next){         \n\
this.addPrimaryKey('table_primary_keys', 'price', next);        \n\
};                                                              \n\
                                                                \n\
exports.down = function(next){                                  \n\
  this.dropPrimaryKey('table_primary_keys', 'price', next);     \n\
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
