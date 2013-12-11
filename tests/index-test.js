var should  = require('should')
  , Task    = require('./../')
  , fs      = require('fs')
  , join    = require('path').join
  , rimraf  = require('rimraf');

var task;
var conn;

var getConnection = function(){
  var sqlite3     = require('sqlite3');
  var db = new sqlite3.Database(':memory:');
  var connection = {dialect: 'sqlite', db: db}
  return connection;
}

var cleanup = function(folder, cb){
  rimraf(join(this.process.cwd() ,folder), function(err, result){
    conn.db.all('drop table ORM2_MIGRATIONS', cb)
  })
}

describe('node-migrate-orm2', function(done){
  beforeEach(function(){
    conn = getConnection();
    task = new Task(conn);
  })

  afterEach(function(done){
    cleanup('migrations', function(err, result){
      done();
    })
  })

  describe('#run', function(done){
    it('creates the default migrations folder', function(done){
      task.run(
        function(err, result){
          should.not.exist(err);
          fs.exists('migrations', function(exists){
            exists.should.be.ok;
            done();
          })
        }
      );
    });

    it('creates the migrations folder with the second argument', function(done){
      cleanup('migrations', function(err, result){
        var task = new Task(conn, 'db');
        task.run(
          function(err, result){
            should.not.exist(err);
            fs.exists('db', function(exists){
              exists.should.be.ok;
              cleanup('db', done);
            })
          }
        );
      })
    });

    it('creates the ORM2_MIGRATIONS table', function(done){
      task.run(
        function(err, result){
          should.not.exist(err);
          conn.db.all('select count(*) from ORM2_MIGRATIONS', function(err, result){
            should.not.exist(err);
            done();
          });
        }
      );
    });
  });

  describe('#generate', function(done){
    it('generates a migration', function(done){
      task.generate('test1', function(err, filename){
        fs.exists('migrations/' + filename + '.js', function(exists){
          exists.should.be.ok;
          done()
        });
      });
    });
  })

  describe('#up', function(done){
    afterEach(function(done){
      conn.db.all('drop table table1;', done)
    });

    it('runs a no arg up migrations successfully', function(done){
      task.run(function(err, result){
        fs.writeFile('migrations/001-create-table1.js', table1Migration, function(err, result){
          task.up('', function(err, result){
            conn.db.all('select count(*) from ORM2_MIGRATIONS', function(err, result){
              result[0]['count(*)'].should.eql(1)
              done();
            });
          })
        })
      })
    });

    it('runs a specific up migration successfully', function(done){
      task.run(function(err, result){
        fs.writeFile('migrations/001-create-table1.js', table1Migration, function(err, result){
          task.up('001-create-table1.js', function(err, result){
            conn.db.all('select count(*) from ORM2_MIGRATIONS', function(err, result){
              result[0]['count(*)'].should.eql(1)
              done();
            });
          })
        })
      })
    });
  })

  describe('#down', function(done){
    it('runs a no arg down migrations successfully', function(done){
      down = function(err, cb){
        task.down('', function(err, result){
          conn.db.all('select * from ORM2_MIGRATIONS', function(err, result){
            result.length.should.eql(2);
            conn.db.all('PRAGMA table_info(table1)', function(err, result){
              result.length.should.eql(0);
              cb();
            });
          })
        })
      }

      task.run(function(err, result){
        fs.writeFile('migrations/001-create-table1.js', table1Migration, function(err, result){
          task.up('', function(err, result){
            conn.db.all('select * from ORM2_MIGRATIONS', function(err, result){
              result.length.should.eql(1);
              result[0].direction.should.eql('up');
              conn.db.all('PRAGMA table_info(table1)', function(err, result){
                result.length.should.eql(2);
                down(null, done);
              })
            });
          })
        })
      })
    });

    it('runs a specific (and legitimate) down migration successfully', function(done){
      down = function(err, cb){
        task.down('001-create-table1.js', function(err, result){
          conn.db.all('select * from ORM2_MIGRATIONS', function(err, result){
            result.length.should.eql(2);
            conn.db.all('PRAGMA table_info(table1)', function(err, result){
              result.length.should.eql(0);
              cb();
            });
          })
        })
      }

      task.run(function(err, result){
        fs.writeFile('migrations/001-create-table1.js', table1Migration, function(err, result){
          task.up('', function(err, result){
            conn.db.all('select * from ORM2_MIGRATIONS', function(err, result){
              result.length.should.eql(1);
              result[0].direction.should.eql('up');
              conn.db.all('PRAGMA table_info(table1)', function(err, result){
                result.length.should.eql(2);
                down(null, done);
              })
            });
          })
        })
      })
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
};                                                            \n\
"

var table2Migration = "\exports.up = function(next){          \n\
this.createTable('test_table2', {                             \n\
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
  this.dropTable('test_table2', next);                        \n\
};"