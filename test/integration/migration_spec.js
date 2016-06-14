var should    = require('should');
var _         = require('lodash');
var async     = require('async');

var helpers      = require('../helpers');
var Task         = require('../../');
var Migration    = require('../../lib/migration');
var MigrationDSL = require('../../lib/migration-dsl');

var data = ['001-create-pets.js', '002-create-cats.js'];

var tableV1 = {
  migration  : { type : "text", required: true },
  direction  : { type : "text", required: true },
  created_at : { type : "text", time: true, required: true }
};

// v1 permutations
var v1Datas = [
  {
    in: [
      [ '001-create-pets.js', 'up',   '2016-06-08T04:52:56.584Z' ],
      [ '002-create-cats.js', 'up',   '2016-06-09T04:52:56.584Z' ]
    ],
    out: ['002-create-cats.js', '001-create-pets.js']
  },
  {
    in: [
      [ '001-create-pets.js', 'up',   '2016-06-08T04:52:56.584Z' ],
      [ '002-create-cats.js', 'up',   '2016-06-09T04:52:56.584Z' ],
      [ '002-create-cats.js', 'down', '2016-06-10T04:52:56.584Z' ],
      [ '002-create-cats.js', 'up',   '2016-06-11T04:52:56.584Z' ]
    ],
    out: ['002-create-cats.js', '001-create-pets.js']
  },
  {
    in: [
      [ '001-create-pets.js', 'up',   '2016-06-08T04:52:56.584Z' ],
      [ '002-create-cats.js', 'up',   '2016-06-09T04:52:56.584Z' ],
      [ '002-create-cats.js', 'down', '2016-06-10T04:52:56.584Z' ]
    ],
    out: ['001-create-pets.js']
  },
  {
    in: [
      [ '001-create-pets.js', 'up',   '2016-06-08T04:52:56.584Z' ],
      [ '002-create-cats.js', 'up',   '2016-06-09T04:52:56.584Z' ],
      [ '002-create-dogs.js', 'up',   '2016-06-10T04:52:56.584Z' ],
      [ '002-create-dogs.js', 'down', '2016-06-11T04:52:56.584Z' ],
      [ '002-create-cats.js', 'down', '2016-06-12T04:52:56.584Z' ]
    ],
    out: ['001-create-pets.js']
  }
];

describe('Migration', function () {
  var conn;
  var dsl;
  var migration;

  var createTable = function(done) {
    dsl.dropTable('orm_migrations', function() {
      migration.ensureMigrationsTable(done);
    });
  };
  var loadData = function(done) {
    var inserter = function(migration, cb) {
      var query = 'INSERT INTO orm_migrations (migration) VALUES(?)';
      dsl.execQuery(query, [migration], cb);
    };
    async.eachSeries(data, inserter, done);
  };
  var reload = function(done) {
    createTable(function() {
      loadData(done);
    });
  };

  var createV1Table = function(done) {
    dsl.dropTable('orm_migrations', function() {
      dsl.createTable('orm_migrations', tableV1, done);
    });
  };
  var loadV1Data = function(lines, done) {
    var inserter = function(line, cb) {
      var query = 'INSERT INTO orm_migrations (migration, direction, created_at) VALUES(?, ?, ?)';
      dsl.execQuery(query, line, cb);
    };
    async.eachSeries(lines, inserter, done);
  };



  before(function (done) {
    helpers.connect(function (err, connection) {
      if (err) return done(err);
      conn = connection;
      dsl = new MigrationDSL(conn);
      migration = new Migration(dsl);
      done();
    });
  });

  after(function (done) {
    conn.close(done);
  });

  describe('#all', function() {
    before(reload);

    it('returns the full list', function(done) {
      migration.all(function(err, migrations) {
        should.not.exist(err);
        migrations.should.eql(['002-create-cats.js', '001-create-pets.js']);
        done();
      });
    });
  });

  describe('#last', function() {
    before(reload);

    it('returns the last migration', function(done) {
      migration.last(function(err, last) {
        should.not.exist(err);
        last.should.eql('002-create-cats.js');
        done();
      });
    });
  });

  describe('#save', function() {
    before(function(done) {
      reload(function() {
        migration.save('003-create-dogs.js', done);
      });
    });

    it('contains the added migration', function(done) {
      migration.all(function(err, migrations) {
        should.not.exist(err);
        migrations.should.have.length(3);
        _.first(migrations).should.eql('003-create-dogs.js');
        done();
      });
    });
  });

  describe('#delete', function() {
    before(function(done) {
      reload(function() {
        migration.delete('002-create-cats.js', done);
      });
    });

    it('removed the migration', function(done) {
      migration.all(function(err, migrations) {
        should.not.exist(err);
        migrations.should.have.length(1);
        _.first(migrations).should.eql('001-create-pets.js');
        done();
      });
    });
  });

  describe('#ensureMigrationsTable', function() {
    describe('when no table', function() {
      before(function(done) {
        dsl.dropTable('orm_migrations', function(err) {
          migration.ensureMigrationsTable(done);
        });
      });

      it('creates orm_migrations', function(done){
        dsl.hasTable('orm_migrations', function(err, hasTable) {
          should.not.exist(err);
          hasTable.should.be.true;
          done();
        });
      });
    });

    describe('when v1 table', function() {
      before(function (done) {
        async.series([
          createV1Table,
          migration.ensureMigrationsTable.bind(migration)
        ], done);
      });

      it('has migrated orm_migrations', function(done) {
        dsl.getColumns('orm_migrations', function(err, columns) {
          should.not.exist(err);
          Object.keys(columns).should.have.length(1);
          done();
        });
      });
    });

    _.each(v1Datas, function(data, i) {
      describe('when v1 table - permutation ' + i, function() {
        before(function (done) {
          async.series([
            createV1Table,
            _.partial(loadV1Data, data.in),
            migration.ensureMigrationsTable.bind(migration)
          ], done);
        });

        it('has migrated the data', function(done) {
          migration.all(function(err, migrations) {
            should.not.exist(err);
            migrations.should.eql(data.out);
            done();
          });
        });
      });
    });

    describe('when v2 table', function() {
      before(reload);

      it('does not change anything', function(done) {
        migration.all(function(err, migrations) {
          should.not.exist(err);
          migrations.should.eql(['002-create-cats.js', '001-create-pets.js']);
          done();
        });
      });
    });

  });


});
