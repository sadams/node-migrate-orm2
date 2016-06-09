var should    = require('should');
var _         = require('lodash');
var async     = require('async');

var helpers   = require('../helpers');
var Task      = require('../../');
var Migration = require('../../lib/migration-dsl');
var MigrationManager = require('../../lib/migration-manager');

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

var v2Data = ['001-create-pets.js', '002-create-cats.js'];

describe('MigrationManager', function () {
  var task;
  var conn;
  var dsl;
  var manager;

  var createV1Table = function(done) {
    dsl.dropTable('orm_migrations', function(err) {
      if (err) return done(err);
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
  var loadV2Data = function(done) {
    var inserter = function(migration, cb) {
      var query = 'INSERT INTO orm_migrations (migration) VALUES(?)';
      dsl.execQuery(query, [migration], cb);
    };
    async.eachSeries(v2Data, inserter, done);
  };


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

  //ensure the migration table is cleared before each test
  beforeEach(function(done) {
    task = new Task(conn, { dir: 'migrations' });
    dsl = Migration(conn, task).dsl;
    manager = new MigrationManager(conn, dsl);
    // clean the db and create the migration table
    async.series([
      helpers.cleanupDb.bind(helpers, conn, []),
      manager.ensureMigrationsTable.bind(manager)
    ], done);
  });

  describe('#load', function() {
    beforeEach(loadV2Data);

    it('returns the full list', function(done) {
      manager.load(function(err, migrations) {
        should.not.exist(err);
        migrations.should.eql(['002-create-cats.js', '001-create-pets.js']);
        done();
      });
    });
  });

  describe('#ensureMigrationsTable', function() {
    describe('when no table', function() {
      beforeEach(function(done) {
        dsl.dropTable('orm_migrations', function(err) {
          manager.ensureMigrationsTable(done);
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
      beforeEach(function (done) {
        async.series([
          createV1Table,
          manager.ensureMigrationsTable.bind(manager)
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
        beforeEach(function (done) {
          async.series([
            createV1Table,
            _.partial(loadV1Data, data.in),
            manager.ensureMigrationsTable.bind(manager)
          ], done);
        });

        it('has migrated the data', function(done) {
          manager.load(function(err, migrations) {
            should.not.exist(err);
            migrations.should.eql(data.out);
            done();
          });
        });
      });
    });

    describe('when v2 table', function() {
      beforeEach(function(done) {
        loadV2Data(function() {
          manager.ensureMigrationsTable(done)
        })
      });

      it('does not change anything', function(done) {
        manager.load(function(err, migrations) {
          should.not.exist(err);
          migrations.should.eql(['002-create-cats.js', '001-create-pets.js']);
          done();
        });
      });
    });

  });


});
