var should  = require('should');
var helpers = require('../helpers');
var Task    = require('./../../');

describe('add/drop column dsl', function (done) {
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

  afterEach(function (done) {
    helpers.cleanupDbAndDir(conn, task.dir, ['table1'], done);
  });

  beforeEach(function(done){
    task.mkdir(function(err, result){
      helpers.writeMigration(task, '001-create-table1.js',  table1Migration);
      helpers.writeMigration(task, '002-add-one-column.js', column1Migration);
      done();
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

var table1Migration = "exports.up = function (next) {          \n\
this.createTable('table1', {                                   \n\
  id     : { type : \"serial\", key: true },                   \n\
  name   : { type : \"text\", required: true, f: 5 }                 \n\
}, next);                                                      \n\
};                                                             \n\
                                                               \n\
exports.down = function (next){                                \n\
  this.dropTable('table1', next);                              \n\
};";

var column1Migration = "exports.up = function (next) {         \n\
this.addColumn('table1', {                                     \n\
  full_name   : { type : 'text', required: true }              \n\
}, next);                                                      \n\
};                                                             \n\
exports.down = function(next){                                 \n\
  this.dropColumn('table1', 'malcolm', next);                  \n\
};";
