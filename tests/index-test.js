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
    conn.db.all('drop table ORM_MIGRATIONS', cb)
  })
}

describe('node-migrate-orm2', function(done){
  beforeEach(function(){
    conn = getConnection();
    task = new Task(conn, {dir: 'foo/bar'});
  })

  afterEach(function(done){
    cleanup(task.dir, function(err, result){
      done();
    })
  })

  describe('#run', function(done){
    it('creates the default migrations folder', function(done){
      task.run(
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
      cleanup(task.dir, function(err, result){
        var task = new Task(conn, {dir: 'db'});
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

    it('creates the ORM_MIGRATIONS table', function(done){
      task.run(
        function(err, result){
          should.not.exist(err);
          conn.db.all('select count(*) from ORM_MIGRATIONS', function(err, result){
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
    afterEach(function(done){
      conn.db.all('drop table table1;', done)
    });

    it('runs a no arg up migrations successfully', function(done){
      task.run(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          task.up(function(err, result){
            conn.db.all('select count(*) from ORM_MIGRATIONS', function(err, result){
              result[0]['count(*)'].should.eql(1)
              done();
            });
          })
        })
      })
    });

    it('runs a specific up migration successfully', function(done){
      task.run(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          task.up('001-create-table1.js', function(err, result){
            conn.db.all('select count(*) from ORM_MIGRATIONS', function(err, result){
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
        task.down(function(err, result){
          conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
            result.length.should.eql(2);
            conn.db.all('PRAGMA table_info(table1)', function(err, result){
              result.length.should.eql(0);
              cb();
            });
          })
        })
      }

      task.run(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          task.up(function(err, result){
            conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
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
      down = function(err, cb){  //tidy this up, it's a copy n paste from the no arg down
        task.down('001-create-table1.js', function(err, result){
          conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
            result.length.should.eql(2);
            conn.db.all('PRAGMA table_info(table1)', function(err, result){
              result.length.should.eql(0);
              cb();
            });
          })
        })
      }

      task.run(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          task.up(function(err, result){
            conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
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

  describe('multi file migrations', function(done){

    beforeEach(function(done){
      task.run(function(err, result){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, function(err, result){
          fs.writeFile(task.dir + '/002-create-table2.js', table2Migration, function(err, result){
           done();
          })
        })
      })
    });



    it('migrates up', function(done){
      task.up(function(err, result){
        conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
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
          conn.db.all('PRAGMA table_info(table2)', function(err, result){
            result.length.should.eql(0);
            conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
              result.length.should.eql(3);
              result[0].direction.should.eql('up');
              result[1].direction.should.eql('up');
              result[2].direction.should.eql('down');
              should.strictEqual(result[3], undefined);
              done();
            });
          });
        });
      })
    });

    it('migrates up to a file, then resumes there from another up call', function(done){
      task.up('001-create-table1.js', function(err, result){
        conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
          var lastIdx = result.length -1;
          result[lastIdx].migration.should.eql('001-create-table1.js');
          task.up('002-create-table2.js', function(err, result){
            conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
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
        task.down('', function(err, result){
          conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
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
      task.run(function(e, r){
        fs.writeFile(task.dir + '/001-create-table1.js', table1Migration, done);
        })
    });
2
    afterEach(function(done){
      conn.db.all('drop table table1;', done)
    });


    it('remembers', function(done){
      task.up(function(err, result){
        conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
          result[0].migration.should.eql('001-create-table1.js');
          task2 = new Task(conn, {dir: 'foo/bar'});
          fs.writeFile(task.dir + '/002-create-table2.js', table2Migration, function(e, r){
            task2.up(function(err, result){
              conn.db.all('select * from ORM_MIGRATIONS', function(err, result){
                result[1].migration.should.eql('002-create-table2.js');
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