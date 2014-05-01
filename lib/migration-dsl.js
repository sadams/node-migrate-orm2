var _  = require("lodash");
var fs = require('fs');
var util = require('util');


//lets you attach further metadata to column definition
//e.g. 'references product(id) on delete cascade'
var getColumnMetadata = function(property){
  return _.has(property, 'addSQL') ? property.addSQL : "";
}

//duplicated from sql-ddl-sync Sync closure
var createColumn = function (collection, name, property, Dialect, driver) {
  var type =  Dialect.getType(collection, name, property, driver);

  if (type === false) {
    return false;
  }
  if (typeof type == "string") {
    type = { value : type };
  }

  var meta = getColumnMetadata(property);

  return {
    value  : Dialect.escapeId(name) + " " + type.value + " " + meta,
    before : type.before
  };
};

function MigrationDSL(driver, task) {
  this.driver           = driver;
  this.Dialect          = require("sql-ddl-sync/lib/Dialects/" + driver.config.protocol.replace(":",""));
  this.task             = task;
  this.Dialect.escapeId = driver.query.escapeId;
}

MigrationDSL.prototype = {
  //----- Migration DSL functions
  //duplicated and altered from sql-ddl-sync Sync closure
  createTable: function (collectionName, options, cb) {
    var columns = [];
    var primary = [];

    for (var k in options) {
      var col = createColumn(collectionName, k, options[k], this.Dialect, this.driver);

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

    this.Dialect.createCollection(this.driver, collectionName, columns, primary, cb);
  },

  addColumn: function (collectionName, options, cb) {
    var columnName = _.keys(options)[0]
    var column = createColumn(collectionName, columnName, options[columnName], this.Dialect, this.driver);
    this.Dialect.addCollectionColumn(this.driver, collectionName, column.value, null, cb);
  },

  renameColumn: function (collectionName, oldName, newName, cb) {
    this.Dialect.renameCollectionColumn(this.driver, collectionName, oldName, newName, cb);
  },

  addIndex: function (indexName, options, cb) {
    this.Dialect.addIndex(this.driver, indexName, options.unique, options.table, options.columns, cb);
  },

  dropIndex: function (collectionName, indexName, cb) {
    this.Dialect.removeIndex(this.driver, indexName, collectionName, cb);
  },

  dropColumn: function (collectionName, columnName, cb) {
    this.Dialect.dropCollectionColumn(this.driver, collectionName, columnName, cb);
  },

  dropTable: function (collectionName, cb) {
    this.Dialect.dropCollection(this.driver, collectionName, cb);
  },

  addPrimaryKey: function (collectionName, columnName, cb) {
    this.Dialect.addPrimaryKey(this.driver, collectionName, columnName, cb);
  },

  dropPrimaryKey: function (collectionName, columnName, cb) {
    this.Dialect.dropPrimaryKey(this.driver, collectionName, columnName, cb);
  },

  addForeignKey: function (collectionName, options, cb) {
    this.Dialect.addForeignKey(this.driver, collectionName, options, cb);
  },

  dropForeignKey: function (collectionName, columnName, cb) {
    this.Dialect.dropForeignKey(this.driver, collectionName, columnName, cb);
  },

  execQuery: function (query, args, cb) {
    this.driver.execQuery(query, args, cb);
  }

  // comment out for now
  // , renameTable: function(oldCollectionName, newCollectionName, cb){
  //   this.Dialect.renameTable(this.driver, oldCollectionName, newCollectionName, cb);
  // }
}


//Resumer  - object in charge of resuming the last point of migration
//Recorder - object in charge of updating orm_migrations table after executing a migration's direction
var Recorder = Resumer = function(driver, dsl, task){
  this.driver     = driver;
  this.dsl        = dsl;
  this.task       = task;
}

Resumer.prototype.cursor =  function cursor(cb){
  var resumer = this;
  this.ensureMigrationsTable(function(e, r){
    resumer.findPosition(cb);
  })
}

Resumer.prototype.findPosition = function findPosition (cb) {
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

  this.currentMigration(positioner, cb);
}

Resumer.prototype.currentMigration = function currentMigration(positioner, cb){
  var sql = "SELECT migration FROM orm_migrations ORDER BY created_at DESC LIMIT 1;";
  this.execute(sql, function(e,r){
    if (r.length == 0){
      cb('', e);
    } else {
      positioner(r[0].migration, cb)
    }
  })
}

Recorder.prototype.record = function record(item, cb) {
  var direction = item.direction;
  var migration = migrationWithoutPath(item.migration.title);

  this.execute(
    "INSERT INTO orm_migrations(migration, direction, created_at) VALUES(?, ?, ?);",
    [migration, direction, new Date().toISOString()],
    cb
  );
}

Resumer.prototype.execute = Recorder.prototype.execute = function execute () {
  this.driver.execQuery.apply(this.driver, arguments);
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
module.exports = function(driver, task){
  var dsl = new MigrationDSL(driver);
  var recorder = new Recorder(driver, dsl);
  var resumer  = new Resumer(driver, dsl, task);
  var migratePatch = require("./migrate-patch")(dsl, recorder, resumer);
  migratePatch.dsl = dsl;
  return migratePatch;
}
