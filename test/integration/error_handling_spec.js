var should  = require('should');
var fs      = require('fs');
var helpers = require('../helpers');
var Task    = require('./../../');


describe('node-migrate-orm2', function (done) {
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

  describe('#addColumn', function() {
    beforeEach(function(done){
      task.mkdir(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, done);
      });
    });

    it("should throw an error if asked to add the same column twice", function (done) {
      fs.writeFile(task.dir + '/003-add-one-column-twice.js', addColumnTwiceMigration, function(err, result){
        task.up(function (err, result) {
          should.exist(err);
          done();
        })
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

var addColumnTwiceMigration = "                                \n\
exports.up = function (next) {                                 \n\
  var that = this;                                             \n\
  this.addColumn('table1', {                                   \n\
    answer: { type: 'text', required: true }                   \n\
  }, function (err) {                                          \n\
    if (err) return next(err);                                 \n\
    that.addColumn('table1', {                                 \n\
      answer: { type: 'text', required: true }                 \n\
    }, next);                                                  \n\
  });                                                          \n\
};                                                             \n\
exports.down = function (next) {                               \n\
  this.dropColumn('table1', 'answer', next);                   \n\
};";
