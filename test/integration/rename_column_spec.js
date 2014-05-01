var should  = require('should');
var fs      = require('fs');
var helpers = require('../helpers');
var Task    = require('./../../');

describe('rename column dsl', function (done) {
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

  afterEach(function (done) {
    helpers.cleanupDbAndDir(conn, task.dir, ['table1'], done);
  });

  beforeEach(function(done){
    task.mkdir(function(err, result){
      fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
        fs.writeFile(task.dir + '/002-rename-column.js', column1Migration, done);
      });
    });
  });

  it('runs one migration successfully', function(done){
    task.up(function(err, result){
      conn.execQuery(
        'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ?', ['table1'],
        function (err, result) {
          should.not.exist(err);
          should.equal(result[1].column_name, 'name2')
          done();
        }
      );
    });
  });
});

var table1Migration =
"exports.up = function (next) {                                 \n\
  this.createTable('table1', {                                  \n\
    id     : { type : \"number\", primary: true, serial: true },\n\
    name   : { type : \"text\", required: true }                \n\
  }, next);                                                     \n\
};                                                              \n\
                                                                \n\
exports.down = function (next){                                 \n\
  this.dropTable('table1', next);                               \n\
};";

var column1Migration =
"exports.up = function (next) {                                 \n\
  this.renameColumn('table1', 'name', 'name2', next);           \n\
};                                                              \n\
exports.down = function(next){                                  \n\
  this.renameColumn('table1', 'name2', 'name', next);           \n\
};";
