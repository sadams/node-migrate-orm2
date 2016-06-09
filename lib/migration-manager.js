var _     = require("lodash");
var fs    = require('fs');
var util  = require('util');
var async = require('async');

function MigrationManager(driver, dsl) {
  this.driver = driver;
  this.dsl = dsl;
}

MigrationManager.prototype.last = function(cb) {
  var self = this;
  var dsl = this.dsl;

  dsl.execQuery('SELECT migration FROM orm_migrations ORDER BY migration DESC LIMIT 1;', [], function(err, results) {
    if (err) return cb(err);
    if (results.length === 0) {
      cb();
    } else {
      self.last = results[0].migration
      cb(null, self.last);
    }
  });
}

MigrationManager.prototype.load = function(cb) {
  var self = this;
  var dsl = this.dsl;

  dsl.execQuery('SELECT migration FROM orm_migrations ORDER BY migration DESC;', [], function(err, results) {
    if (err) return cb(err);
    self.migrations = _.map(results, 'migration');
    cb(null, self.migrations);
  })
}

MigrationManager.prototype.add = function(migration, cb) {
  this.dsl.execQuery('INSERT INTO orm_migrations(migration) VALUES(?);', [migration], cb);
}

MigrationManager.prototype.loadCompat = function(cb) {
  var self = this;
  var dsl = this.dsl;

  dsl.execQuery('SELECT migration, direction, created_at FROM orm_migrations ORDER BY created_at DESC;', [], function(err, results) {
    if (err) return cb(err);
    cb(null, results);
  })
}

MigrationManager.prototype.addCompat = function(migration, cb) {
  this.dsl.execQuery("INSERT INTO orm_migrations(migration, direction, created_at) VALUES(?, 'up', '2016-06-08T04:52:56.584Z');", [migration], cb);
}

MigrationManager.prototype.delete = function(migration, cb) {
  this.dsl.execQuery('DELETE FROM orm_migrations where migration = ?;', [migration], cb);
}

MigrationManager.prototype.ensureMigrationsTable = function(cb) {
  var dsl = this.dsl;
  var self = this;

  var createTable = function(cb) {
    dsl.createTable('orm_migrations', { migration : { type : "text", required: true } }, cb);
  };
  var createIndex = function(cb) {
    dsl.addIndex('unique_orm_migrations', { table: 'orm_migrations', columns: ['migration'] , unique: true }, cb);
  };
  var migrateData = function(cb) {
    // we do the following
    // 1. load all migrations
    // 2. create a list of migrations to delete
    // 3. delete them
    async.waterfall([
      self.loadCompat.bind(self),
      function(migrations, cb) {
        var downMigrations = _.filter(migrations, {direction: 'down'});
        // for each down migration we can delete one matching up migration
        var toDelete = [];
        _.each(downMigrations, function(down) {
          toDelete.push(down);
          var indexUp = _.findIndex(migrations, { direction: 'up', migration: down.migration });
          toDelete.push(migrations.splice(indexUp, 1));
        });
        cb(null, _.flatten(toDelete));
      },
      function(toDelete, cb) {
        var deleteOne = function(m, cb) {
          var query = 'DELETE FROM orm_migrations WHERE orm_migrations.migration = ? AND orm_migrations.created_at = ?';
          var params = [m.migration, m.created_at];
          dsl.execQuery(query, params, cb);
        }
        async.eachSeries(toDelete, deleteOne, cb);
      }
    ], cb);
  };
  var updateTable = function(cb) {
    async.series([
      dsl.dropColumn.bind(dsl, 'orm_migrations', 'direction'),
      dsl.dropColumn.bind(dsl, 'orm_migrations', 'created_at')
    ], cb);
  };

  dsl.hasTable('orm_migrations', function(err, hasMigrationsTable) {
    if (err) return cb(err);
    if (hasMigrationsTable) {
      dsl.getColumns('orm_migrations', function(err, columns) {
        if (err) return cb(err);
        if (Object.keys(columns).length > 1) { // v1 ( multi columns )
          console.log('Migrations table is v1, changing to v2');
          async.series([migrateData, updateTable, createIndex], cb)
        } else { // v2 ... nothing to do
          cb();
        }
      });
    } else { // no migrations table
      console.log('No migrations table, creating one');
      async.series([createTable, createIndex], cb);
    }
  });
}

module.exports = MigrationManager;
