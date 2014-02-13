var should  = require('should');
var fs      = require('fs');
var helpers = require('../helpers');
var Task    = require('./../../');


describe('node-migrate-orm2- foreign key DSL', function (done) {
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

  describe('foreign keys', function(done){

    beforeEach(function(done){
      task.mkdir(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          fs.writeFile(task.dir + '/002-create-table2.js', table2Migration, function(err, result){
            fs.writeFile(task.dir + '/003-add-foreign-key.js', table2AddForeignKey, function(err, result){
              done();
            });
          });
        })
      })
    });

    afterEach(function (done) {
      helpers.cleanupDbAndDir(conn, task.dir, done);
    });

    it('adding one', function(done){
      task.up('001-create-table1.js', function(err, result){
        task.up('/002-create-table2.js', function(err, result){
          task.up('/003-add-foreign-key.js', function(err, result){
            if (conn.config.protocol === "postgresql"){
              conn.execQuery(pgListForeignKeys('table2'), function (err, result) {
                should.equal(result[0].foreign_table_name, 'table1');
                should.equal(result[0].foreign_column_name, 'id');
                should.not.exist(err);
                done();
              });
            }
            else {
              conn.execQuery('describe table2',
                function (err, result) {
                  should.equal(result[1].Field, 'table1id');
                  should.equal(result[1].Key, 'MUL');
                  done();
                }
              );
            }
          });
        });
      });
    });

    it('dropping one', function(done){
      task.up('001-create-table1.js', function(err, result){
        task.up('/002-create-table2.js', function(err, result){
          task.up('/003-add-foreign-key.js', function(err, result){
            task.down('/003-add-foreign-key.js', function(err, result){
              if (conn.config.protocol === 'postgresql'){
                conn.execQuery(pgListForeignKeys('table1'), function (err, result) {
                  should.not.exist(result[0]);
                  done();
                });
              }
              else { //we say it's MySQL
                conn.execQuery('show create table table2',
                  function (err, result) {
                    result.should.not.match(/CONSTRAINT `table1id_fk` FOREIGN KEY (`table1id`) REFERENCES `table1`/)
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
});

var table1Migration = "exports.up = function(next){           \n\
this.createTable('table1', {                                  \n\
  id  : { type : \"number\", primary : true,  serial: true }, \n\
}, next);                                                     \n\
};                                                            \n\
                                                              \n\
exports.down = function(next){                                \n\
  this.dropTable('table1', next);                             \n\
};";

var table2Migration = "\exports.up = function(next){          \n\
this.createTable('table2', {                             \n\
  id     : { type : \"number\", primary: true, serial: true },\n\
  table1id : { type : \"number\", },\n\
}, next);                                                     \n\
};                                                            \n\
                                                              \n\
exports.down = function(next){                                \n\
  this.dropTable('table2', next);                             \n\
};";

var table2AddForeignKey = "exports.up = function(next){           \n\
  this.addForeignKey('table2',                                \n\
    { name:       'table1id',                                 \n\
      references: { table: 'table1', column: 'id' }           \n\
    }, next);                                                 \n\
};                                                            \n\
                                                              \n\
exports.down = function(next){                                \n\
  this.dropForeignKey('table2', 'table1id', next);               \n\
};";

var pgListForeignKeys1 =
"SELECT                                                       \n\
tc.constraint_name, tc.table_name, kcu.column_name,           \n\
  ccu.table_name AS foreign_table_name,                       \n\
  ccu.column_name AS foreign_column_name                      \n\
FROM                                                          \n\
information_schema.table_constraints AS tc                    \n\
JOIN information_schema.key_column_usage AS kcu               \n\
ON tc.constraint_name = kcu.constraint_name                   \n\
JOIN information_schema.constraint_column_usage AS ccu        \n\
ON ccu.constraint_name = tc.constraint_name                   \n\
WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name='";

var pgListForeignKeys = function(tableName){
  return pgListForeignKeys1 + tableName + "';";
}