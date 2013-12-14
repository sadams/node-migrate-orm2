var _     = require("lodash")
  , fs      = require('fs');

//duplicated from sql-ddl-sync Sync closure
var createColumn = function (collection, name, property, Dialect) {
  var type =  Dialect.getType(collection, name, property);

  if (type === false) {
    return false;
  }
  if (typeof type == "string") {
    type = { value : type };
  }

  return {
    value  : Dialect.escapeId(name) + " " + type.value,
    before : type.before
  };
};

function MigrationDSL(connection, task) {
  this.connection = connection;
  this.Dialect    = require("sql-ddl-sync/lib/Dialects/" + connection.dialect);
  this.db         = connection.db;
  this.task       = task;
}

MigrationDSL.prototype = {
  //----- Migration DSL functions
  //duplicated and altered from sql-ddl-sync Sync closure
  createTable: function(collectionName, options, cb){
    var columns = [];
    var primary = [];

    for (var k in options) {
      var col = createColumn(collectionName, k, options[k], this.Dialect);

      if (col === false) {
        return cb(new Error("Unknown type for property '" + k + "'"));
      }

      if (options[k].primary) {
        primary.push(k);
      }

      columns.push(col.value);
    }

    if (typeof this.Dialect.checkPrimary == "function") {
      primary = this.Dialect.checkPrimary(primary);
    }

    this.Dialect.createCollection(this.db, collectionName, columns, primary, cb);
  }

  , addColumn: function(collectionName, options, cb){
    var columnName = _.keys(options)[0]
    var column = createColumn(collectionName, columnName, options[columnName], this.Dialect);
    this.Dialect.addCollectionColumn(this.db, collectionName, column.value, null, cb);
  }

  , dropColumn: function(collectionName, columnName, cb){
    this.Dialect.dropCollectionColumn(this.db, collectionName, columnName, cb);
  }

  , dropTable: function(collectionName, cb){
    this.Dialect.dropCollection(this.db, collectionName, cb);
  }
}


//Resumer  - object in charge of resuming the last point of migration
//Recorder - object in charge of updating orm_migrations table after executing a migration's direction
var Recorder = Resumer = function(connection, dsl, task){
  this.connection = connection;
  this.dsl        = dsl;
  this.task       = task;
}

Resumer.prototype.cursor =  function cursor(cb){
  var resumer = this;
  this.ensureMigrationsTable(function(e, r){
    resumer.findPosition(cb);
  })
}

Resumer.prototype.findPosition = function findPosition(cb){
  self = this;
  var positioner = function(migrationName, cb){
    var migrations = _.map(self.task.migrations(), function(migrationPath){ return migrationWithoutPath(migrationPath) })
    var idx = _.indexOf(migrations, migrationName, true);
    if (idx >= 0) {
      self.resumptionPoint = idx + 1;
      cb(null, idx + 1);
    } else {
      cb(null, 0);
    }
  }

  switch(this.connection.dialect){
    case 'sqlite':
      this.currentSqliteMigration(positioner, cb)
      break;
    case 'postgresql':
      this.currentPostgresMigration( positioner, cb)
      break;
    case 'mysql':
      this.currentMySQLMigration(positioner, cb)
      break;
    default:
      throw new Error('Cannot identify ORM2 dialect.');
      break;
  }
}

Resumer.prototype.currentMySQLMigration = function currentMySQLMigration(positioner, cb){
  var sql = "select migration from orm_migrations order by created_at desc limit 1;";
  this.execute(sql, function(e,r){
    if (r.length == 0){
      cb('', e);
    } else {
      positioner(r[0].migration, cb)
    }
  })
}

Resumer.prototype.currentPostgresMigration = function currentPostgresMigration(positioner, cb){
  var sql = "select migration from orm_migrations order by created_at desc limit 1;";
  this.execute(sql, function(e,r){
    if (r.rowCount == 0){
      cb('', e);
    } else {
      positioner(r.rows[0].migration, cb)
    }
  })
}

Resumer.prototype.currentSqliteMigration = function currentSqliteMigration(positioner, cb){
  var sql = "select * from orm_migrations order by created_at desc limit 1;";

  this.execute(sql, function(e,r){
    if (r.length == 0){
      cb('', e);
    } else {
      positioner(r[0].migration, cb);
    }
  })
}

Recorder.prototype.record = function record(item, cb) {
  var direction = item.direction;
  var migration = migrationWithoutPath(item.migration.title);

  var sqlStr = "INSERT into orm_migrations(migration, direction, created_at) VALUES('" + migration + "'";
  sqlStr     += ", '" + direction + "'";
  sqlStr     += ", '" + new Date().toISOString() + "')";

  this.execute(sqlStr, cb);
}

Resumer.prototype.execute = Recorder.prototype.execute = function execute(sql, cb){
  switch (this.connection.dialect) {
    case 'sqlite':
      this.connection.db.all(sql, cb)
      break;
    default:
      this.connection.db.query(sql, cb)
      break;
  }
}

function migrationWithoutPath(migration){
  var migrationBits = migration.split("/"); //remove reference to MigrationTask.dir
  return migrationBits[migrationBits.length -1];
}

var orm2Migrations = {
  migration  : { type : "text", required: true },
  direction  : { type : "text", required: true },
  created_at : { type : "text", time: true, required: true }
}

Resumer.prototype.ensureMigrationsTable = function(cb) {
  var dsl = this.dsl;
  var self = this;

  var recallPositionFallback = function(err, result){
    if (err){ //orm_migrations already exists, so we need to load the previous position
      self.findPosition(cb)
    }
    else {
      cb();
    }
  }

  dsl.createTable('orm_migrations', orm2Migrations, recallPositionFallback);
}


//----- patch around node-migrate libs
module.exports = function(connection, task){
  var dsl = new MigrationDSL(connection);
  var recorder = new Recorder(connection, dsl);
  var resumer  = new Resumer(connection, dsl, task);
  var migratePatch = require("./migrate-patch")(dsl, recorder, resumer);
  migratePatch.dsl = dsl;
  return migratePatch;
}

//---- WIP below. Need to discuss how to handle column modifications
//    (renaming, altering data type, removing or adding constraints) with @dresende

//exports.modifyColumn = function(collectionName, options, connection, cb){
//  fnWithConfiguration.call(null, collectionName, options, connection, modifyColumnInCollection, cb)
//}

//var modifyColumnInCollection = function(collection, db, Dialect, cb){
//  columnName = collection.properties.name
//  columnDefinition = createColumn(collection.name, columnName, collection.properties.modification, Dialect);
//  Dialect.modifyCollectionColumn(db, collection.name, columnName, columnDefinition.value, cb);
//};
