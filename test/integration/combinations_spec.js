var should  = require('should');
var helpers = require('../helpers');
var Task    = require('./../../');

describe('generic mkdir, generate, up and down functionality', function (done) {
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
  beforeEach(function (done) {
    task = new Task(conn, { dir: 'migrations' });
    helpers.cleanupDir('migrations', done);
  });

  afterEach(function (done) {
    helpers.cleanupDbAndDir(conn, task.dir, ['table1', 'table2'], done);
  });

  describe('multi file migrations', function () {
    beforeEach(function (done) {
      task.mkdir(function (err, result) {
        should.not.exist(err);

        helpers.writeMigration(task, '001-create-table1.js',  table1Migration);
        helpers.writeMigration(task, '002-create-table2.js',  table2Migration);
        done();
      })
    });

    it('migrates up', function (done) {
      task.up(function (err, result) {
        should.not.exist(err);

        conn.execQuery('SELECT * FROM orm_migrations', function (err, result) {
          should.not.exist(err);

          result.length.should.eql(2);
          result[0].migration.should.eql('001-create-table1.js');
          result[1].migration.should.eql('002-create-table2.js');
          done();
        });
      })
    });

    it('migrates up, then migrates down to the specified file', function (done) {
      task.up(function(err, result){
        task.down('002-create-table2.js', function (err, result) {
          should.not.exist(err);

          conn.execQuery(
            'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? and table_schema = ?',
            ['table2', 'test'],
            function (err, result) {
              should.not.exist(err);

              should.equal(result.length, 0);
              conn.execQuery('SELECT * FROM orm_migrations', function (err, result) {
                should.not.exist(err);

                result.length.should.eql(3);
                result[0].direction.should.eql('up');
                result[1].direction.should.eql('up');
                result[2].direction.should.eql('down');
                should.strictEqual(result[3], undefined);
                done();
              }
            );
          });
        });
      })
    });

    it('migrates up to a file, then resumes there from another up cquery', function (done) {
      task.up('001-create-table1.js', function (err, result) {
        conn.execQuery('SELECT * FROM orm_migrations', function (err, result) {
          should.not.exist(err);
          var lastIdx = result.length -1;

          result[lastIdx].migration.should.eql('001-create-table1.js');
          task.up('002-create-table2.js', function (err, result) {
            should.not.exist(err);

            conn.execQuery('SELECT * FROM orm_migrations', function (err, result) {
              should.not.exist(err);

              var lastIdx = result.length -1;
              result[lastIdx].migration.should.eql('002-create-table2.js');
              done();
            })
          })
        })
      })
    });

    it('migrates up and down simply', function(done){
      task.up(function(err, result){
        should.not.exist(err);

        task.down(function(err, result){
          should.not.exist(err);

          conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
            should.not.exist(err);

            result.length.should.eql(4);
            result[0].direction.should.eql('up');
            result[0].migration.should.eql('001-create-table1.js');
            result[1].direction.should.eql('up');
            result[1].migration.should.eql('002-create-table2.js');
            result[2].direction.should.eql('down');
            result[2].migration.should.eql('002-create-table2.js');
            result[3].direction.should.eql('down');
            result[3].migration.should.eql('001-create-table1.js');
            done();
          });
        })
      })
    })
  })

  describe('#up, stop, then #up again from the remembered position', function () {
    beforeEach(function (done) {
      task.mkdir(function (err, r) {
        should.not.exist(err);

        helpers.writeMigration(task, '001-create-table1.js',  table1Migration);
        done();
      });
    });

    it('remembers', function(done){
      task.up(function(err, result){
        should.not.exist(err);

        conn.execQuery('SELECT * FROM orm_migrations', function (err, result) {
          should.not.exist(err);

          result[0].migration.should.eql('001-create-table1.js');
          task2 = new Task(conn, {dir: 'migrations'});

          helpers.writeMigration(task, '002-create-table2.js',  table2Migration);
          task2.up(function (err, result) {
            should.not.exist(err);

            conn.execQuery('SELECT * FROM orm_migrations', function (err, result) {
              should.not.exist(err);

              result[1].migration.should.eql('002-create-table2.js');
              done();
            })
          });
        })
      })
    });
  })

  describe('#up, stop, then #down again from the remembered position', function () {
    beforeEach(function (done) {
      task.mkdir(function (err, r) {
        should.not.exist(err);

        helpers.writeMigration(task, '001-create-table1.js',  table1Migration);
        done();
      })
    });

    it('remembers', function(done){
      task.up(function (err, result) {
        should.not.exist(err);

        conn.execQuery('SELECT * FROM orm_migrations', function (err, result) {
          should.not.exist(err);

          result[0].migration.should.eql('001-create-table1.js');
          task2 = new Task(conn, {dir: 'migrations'});

          helpers.writeMigration(task, '002-create-table2.js',  table2Migration);
          task2.down(function (err, result) {
            should.not.exist(err);

            conn.execQuery('SELECT * FROM orm_migrations', function (err, result) {
              should.not.exist(err);

              result[1].migration.should.eql('001-create-table1.js');
              result[1].direction.should.eql('down');
              done();
            })
          });
        })
      })
    });
  })
});


var table1Migration = "exports.up = function (next) {         \n\
this.createTable('table1', {                                  \n\
  id     : { type : \"serial\", key: true },                  \n\
  name   : { type : \"text\", required: true }                \n\
}, next);                                                     \n\
};                                                            \n\
                                                              \n\
exports.down = function (next){                               \n\
  this.dropTable('table1', next);                             \n\
};";

var table2Migration = "exports.up = function(next){           \n\
this.createTable('table2', {                                  \n\
  id     : { type : \"serial\", key: true },                  \n\
  int2   : { type : \"integer\", size: 2 },                   \n\
  int4   : { type : \"integer\", size: 4 },                   \n\
  int8   : { type : \"integer\", size: 8 },                   \n\
  float4 : { type : \"number\", rational: true, size: 4 },    \n\
  float8 : { type : \"number\", rational: true, size: 8 }     \n\
}, next);                                                     \n\
};                                                            \n\
                                                              \n\
exports.down = function(next){                                \n\
  this.dropTable('table2', next);                             \n\
};";
