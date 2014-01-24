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

  describe('#mkdir', function(done){
    afterEach(function (done) {
      helpers.cleanupDir(task.dir, done);
    });

    it('creates the default migrations folder', function(done){
      task.mkdir(
        function(err, result){
          should.not.exist(err);
          fs.exists(task.dir, function(exists){
            exists.should.be.ok;
            done();
          })
        }
      );
    });

    it('creates the migrations folder with the second argument', function(done){
      var task = new Task(conn, {dir: 'db'});

      task.mkdir(
        function(err, result){
          should.not.exist(err);
          fs.exists('db', function(exists){
            exists.should.be.ok;
            helpers.cleanupDir(task.dir, done);
          })
        }
      );
    });
  });

  describe('#generate', function(done){
    afterEach(function (done) {
      helpers.cleanupDir(task.dir, done);
    });

    it('generates a migration', function(done){
      task.generate('test1', function(err, filename){
        var filePath = this.process.cwd() +  '/' + task.dir + '/' + filename + '.js';
        fs.exists(filePath, function(exists){
          exists.should.be.ok;
          done()
        });
      });
    });

    it('generates a coffee migration', function(done){
      task = new Task(conn, {coffee: true});
      task.generate('test1', function(err, filename){
        var filePath = this.process.cwd() +  '/' + task.dir + '/' + filename + '.coffee';
        fs.exists(filePath, function(exists){
          exists.should.be.ok;
          done()
        });
      });
    });
  })

  describe('#up', function(done){
    afterEach(function (done) {
      helpers.cleanupDbAndDir(conn, task.dir, done);
    });

    it('creates the orm_migrations table', function(done){
      fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
        task.up(
          function(err, result){
            should.not.exist(err);

            conn.execQuery('SELECT count(*) FROM ??', ['orm_migrations'], function(err, result){
              should.not.exist(err);
              done();
            });
        });
      });
    });

    describe('#up migrating', function(done){
      afterEach(function(done){
        conn.execQuery('drop table table1;', done)
      });

      it('runs a no arg up migrations successfully', function(done){
        task.mkdir(function(err, result){
          fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
            task.up(function(err, result){
              conn.execQuery('SELECT count(*) FROM ??', ['orm_migrations'], function(err, result){

                should.equal(result[0]['count'] || result[0]['count(*)'], 1);
                done();
              });
            })
          })
        })
      });

      it('runs a specific up migration successfully', function(done){
        task.mkdir(function(err, result){
          fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
            task.up('001-create-table1.js', function(err, result){
              conn.execQuery('SELECT count(*) FROM ??', ['orm_migrations'], function(err, result){
                should.equal(result[0]['count'] || result[0]['count(*)'], 1);
                done();
              });
            })
          })
        })
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

      describe('#addColumn', function() {
        beforeEach(function(done){
          task.mkdir(function(err, result){
            fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, done);
          });
        });


        it('runs two migrations successfully', function(done){
          fs.writeFile(task.dir + '/002-add-two-columns.js', column2Migration, function(err, result){
            task.up(function(err, result){

              conn.execQuery(
                'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND column_name LIKE ?',
                ['table1', 'wobble'],
                function (err, result) {
                  if (err) return done(err);

                  should.equal(result[0].column_name, 'wobble');

                  conn.execQuery(
                    'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND column_name LIKE ?',
                    ['table1', 'wibble'],
                    function (err, result) {
                      should.equal(result[0].column_name, 'wibble');
                      done();
                    }
                  );
                }
              );
            });
          });
        });

        it('runs one migration successfully', function(done){
          fs.writeFile(task.dir + '/002-add-one-column.js', column1Migration, function(err, result){
            task.up(function(err, result){
              conn.execQuery(
                'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND column_name LIKE ?',
                ['table1', 'malcolm'],
                function (err, result) {
                  should.equal(result[0].column_name, 'malcolm')
                  done();
                }
              );
            });
          });
        });

      });
    });
  });

  describe('#down', function(done){
    afterEach(function (done) {
      helpers.cleanupDbAndDir(conn, task.dir, done);
    });

    it('runs a no arg down migrations successfully', function(done){
      down = function(err, cb){
        task.down(function(err, result){
          conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
            should.equal(result.length, 2);
            conn.execQuery('desc table)', function(err, result){
              err.should.exist
              cb();
            });
          })
        })
      }

      task.mkdir(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          task.up(function(err, result){
            conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
              should.equal(result.length, 1);
              should.equal(result[0].direction, 'up')

              conn.execQuery(
                'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ?',
                ['table1'],
                function (err, result) {
                  should.equal(result.length, 2);
                  down(null, done);
                }
              );
            });
          })
        })
      })
    });

    it('runs a specific (and legitimate) down migration successfully', function(done){
      down = function(err, cb){  //tidy this up, it's a copy n paste from the no arg down
        task.down('001-create-table1.js', function(err, result){
          conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
            should.equal(result.length, 2);
            conn.execQuery(
              'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ?',
              ['table1'],
              function (err, result) {
                should.equal(result.length, 0);
                cb();
              }
            );
          })
        })
      }

      task.mkdir(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          task.up(function(err, result){
            conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
              should.equal(result.length, 1);
              should.equal(result[0].direction, 'up')

              conn.execQuery(
                'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ?',
                ['table1'],
                function (err, result) {
                  should.equal(result.length, 2);
                  down(null, done);
                }
              );
            });
          })
        })
      })
    });

    describe('#dropIndex', function() {

      beforeEach(function(done){
        task.mkdir(function(err, result){
          fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, done);
        });
      });

      it('runs one down migration successfully', function(done){
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

  describe('multi file migrations', function(done){
    beforeEach(function(done){
      task.mkdir(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          fs.writeFile(task.dir + '/002-create-table2.js', table2Migration, function(err, result){
           done();
          })
        })
      })
    });

    afterEach(function (done) {
      helpers.cleanupDbAndDir(conn, task.dir, done);
    });

    it('migrates up', function(done){
      task.up(function(err, result){
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
          result.length.should.eql(2);
          result[0].migration.should.eql('001-create-table1.js');
          result[1].migration.should.eql('002-create-table2.js');
          done();
        });
      })
    });

    it('migrates up, then migrates down to the specified file', function(done){
      task.up(function(err, result){
        task.down('002-create-table2.js', function(err, result){

          conn.execQuery(
            'SELECT column_name FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ?',
            ['table2'],
            function (err, result) {
              should.equal(result.length, 0);
              conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
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

    it('migrates up to a file, then resumes there from another up cquery', function(done){
      task.up('001-create-table1.js', function(err, result){
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
          var lastIdx = result.length -1;
          result[lastIdx].migration.should.eql('001-create-table1.js');
          task.up('002-create-table2.js', function(err, result){
            conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
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
        task.down(function(err, result){
          conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
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

  describe('#up, stop, then #up again from the remembered position', function(done){
    beforeEach(function(done){
      task.mkdir(function(e, r){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, done);
        })
    });

    afterEach(function (done) {
      helpers.cleanupDbAndDir(conn, task.dir, done);
    });

    afterEach(function(done){
      conn.execQuery('drop table table1;', done)
    });

    it('remembers', function(done){
      task.up(function(err, result){
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
          result[0].migration.should.eql('001-create-table1.js');
          task2 = new Task(conn, {dir: 'foo/bar'});
          fs.writeFile(task.dir + '/002-create-table2.js', table2Migration, function(e, r){
            task2.up(function(err, result){
              conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
                result[1].migration.should.eql('002-create-table2.js');
                done();
              })
            })
          });
        })
      })
    });
  })

  describe('#up, stop, then #down again from the remembered position', function(done){
    beforeEach(function(done){
      task.mkdir(function(e, r){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, done);
      })
    });

    afterEach(function (done) {
      helpers.cleanupDbAndDir(conn, task.dir, done);
    });

    it('remembers', function(done){
      task.up(function(err, result){
        conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
          result[0].migration.should.eql('001-create-table1.js');
          task2 = new Task(conn, {dir: 'foo/bar'});
          fs.writeFile(task.dir + '/002-create-table2.js', table2Migration, function(e, r){
            task2.down(function(err, result){
              conn.execQuery('SELECT * FROM orm_migrations', function(err, result){
                result[1].migration.should.eql('001-create-table1.js');
                result[1].direction.should.eql('down');
                done();
              })
            })
          });
        })
      })
    });
  })
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
};                                                            \n\
"

var table2Migration = "\exports.up = function(next){          \n\
this.createTable('table2', {                             \n\
  id     : { type : \"number\", primary: true, serial: true },\n\
  int2   : { type : \"number\", size: 2 },                    \n\
  int4   : { type : \"number\", size: 4 },                    \n\
  int8   : { type : \"number\", size: 8 },                    \n\
  float4 : { type : \"number\", rational: true, size: 4 },    \n\
  float8 : { type : \"number\", rational: true, size: 8 }     \n\
}, next);                                                     \n\
};                                                            \n\
                                                              \n\
exports.down = function(next){                                \n\
  this.dropTable('table2', next);                             \n\
};"

var column1Migration = "exports.up = function (next) {         \n\
this.addColumn('table1', {                                     \n\
  malcolm   : { type : \"text\", required: true }              \n\
}, next);                                                      \n\
};                                                             \n\
exports.down = function(next){                                 \n\
  this.dropColumn('table1', 'malcolm', next);                  \n\
};"

var index1Migration = "exports.up = function (next) {          \n\
this.addIndex('name_idx', {                                    \n\
  table: 'table1',                                             \n\
  columns: ['name']                                            \n\
}, next);                                                      \n\
};                                                             \n\
exports.down = function(next){                                 \n\
  this.dropIndex('name_idx', 'table1', next);                  \n\
};"

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
};"
