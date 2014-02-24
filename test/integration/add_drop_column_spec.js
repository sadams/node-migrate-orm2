var should  = require('should');
var fs      = require('fs');
var helpers = require('../helpers');
var Task    = require('./../../');

describe('add/drop column dsl', function (done) {
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
        fs.writeFile(task.dir + '/002-add-one-column.js', column1Migration, done);
      });
    });
  });

  it('runs one migration successfully', function(done){
    task.up(function(err, result){
      conn.execQuery(
        'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND column_name LIKE ?',
        ['table1', 'full_name'],
        function (err, result) {
          should.equal(result[0].column_name, 'full_name')
          done();
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

var column1Migration = "exports.up = function (next) {         \n\
this.addColumn('table1', {                                     \n\
  full_name   : { type : 'text', required: true }              \n\
}, next);                                                      \n\
};                                                             \n\
exports.down = function(next){                                 \n\
  this.dropColumn('table1', 'malcolm', next);                  \n\
};";
