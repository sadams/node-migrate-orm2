var should     = require('should');
var sinon      = require('sinon');
var async      = require('async');
var _          = require('lodash');
var fs         = require('fs');
var path       = require('path');
var helpers    = require('../helpers');
var Task       = require('./../../');

describe('Migrator', function() {
  var task;
  var conn;
  var cwd;

  var SELECT_MIGRATIONS = 'SELECT * FROM orm_migrations';
  var hasMigrations = function(count, cb) {
    conn.execQuery(SELECT_MIGRATIONS, function(err, migrations) {
      should.not.exist(err);
      migrations.should.have.length(count);
      cb();
    });
  };
  var SELECT_COLUMN = 'SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND column_name = ?';
  var hasColumn = function(table, column, cb) {
    conn.execQuery(SELECT_COLUMN, [table, column], function(err, columns) {
      should.not.exist(err);
      columns.should.have.length(1);
      cb();
    });
  };
  var SELECT_TABLE = 'SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE table_name = ?';
  var hasTable = function(table, cb) {
    conn.execQuery(SELECT_TABLE, [table], function(err, tables) {
      should.not.exist(err);
      tables.should.have.length(1);
      cb();
    });
  };
  var hasNoTable = function(table, cb) {
    conn.execQuery(SELECT_TABLE, [table], function(err, tables) {
      should.not.exist(err);
      tables.should.have.length(0);
      cb();
    });
  }

  before(function(done) {
    helpers.connect(function(err, connection) {
      if (err) return done(err);
      conn = connection;
      cwd = this.process.cwd();
      done();
    });
  });

  after(function(done) {
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

  describe('#up', function() {
    it('runs a no arg up migrations successfully', function(done) {
      task.up(function(err, result) {
        hasMigrations(2, done);
      })
    });

    it('runs a specific up migration successfully', function(done) {
      task.up('001-create-table1.js', function(err, result) {
        hasMigrations(1, done);
      })
    });

    it('runs two migrations successfully', function(done) {
      async.series([
        task.up.bind(task),
        _.partial(hasColumn, 'table1', 'wobble'),
        _.partial(hasColumn, 'table1', 'wibble')
      ], done);
    });

    it('doesnt re perform existing migration', function(done) {
      async.series([
        task.up.bind(task, '001-create-table1.js'),
        _.partial(hasMigrations, 1),
        task.up.bind(task),
        _.partial(hasMigrations, 2)
      ], done);
    });
  });

  describe('#down', function() {
    it('runs a no arg down migrations successfully (one step)', function(done) {
      async.series([
        task.up.bind(task),
        _.partial(hasMigrations, 2),
        task.down.bind(task),
        _.partial(hasMigrations, 1)
      ], done);
    });

    it('runs down migrations using name (including)', function(done) {
      async.series([
        task.up.bind(task),
        _.partial(hasMigrations, 2),
        task.down.bind(task, '001-create-table1.js'),
        _.partial(hasMigrations, 0),
        _.partial(hasNoTable, 'table1')
      ], done);
    });
  });

  describe('#up and #down combinations', function() {
    it('works with [up(no args), down(no args - one step), up(no args)]', function(done) {
      async.series([
        task.up.bind(task),
        _.partial(hasMigrations, 2),
        task.down.bind(task),
        _.partial(hasMigrations, 1),
        task.up.bind(task),
        _.partial(hasMigrations, 2)
      ], done);
    });

    it('works with [up(with args - one step), down(no args - one step), up(no args)]', function(done) {
      async.series([
        task.up.bind(task, '001-create-table1.js'),
        _.partial(hasMigrations, 1),
        task.down.bind(task),
        _.partial(hasMigrations, 0),
        task.up.bind(task),
        _.partial(hasMigrations, 2)
      ], done);
    });

    it('works with [up(with args - one step), up(with args - one step), down(with args - two steps)]', function(done) {
      async.series([
        task.up.bind(task, '001-create-table1.js'),
        _.partial(hasMigrations, 1),
        task.up.bind(task, '002-create-table1.js'),
        _.partial(hasMigrations, 2),
        task.down.bind(task, '001-create-table1.js'),
        _.partial(hasMigrations, 0)
      ], done);
    });
  });

  describe('#generate', function() {
    it('generates a migration', function(done) {
      task.generate('test1', function(err, filename) {
        var filePath = path.join(cwd, task.dir, filename + '.js');
        fs.statSync(filePath).isFile().should.be.true;
        done();
      });
    });

    it('generates a coffee migration', function(done) {
      task = new Task(conn, {coffee: true});
      task.generate('test1', function(err, filename) {
        var filePath = path.join(cwd, task.dir, filename + '.coffee');
        fs.statSync(filePath).isFile().should.be.true;
        done();
      });
    });
  });

  describe('#setup', function(done) {
    beforeEach(function() {
      sinon.spy(task, 'setup');
    });

    afterEach(function() {
      task.setup.restore();
    });

    it('creates the migrtion folder', function(done) {
      var dirPath = path.join(cwd, task.dir);
      fs.statSync(dirPath).isDirectory().should.be.true;
      done();
    });

    it('create the migrations table', function(done) {
      hasTable('orm_migrations', done);
    });

    it('gets called when calling #up', function(done) {
      task.up(function() {
        task.setup.called.should.be.true;
        done();
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
