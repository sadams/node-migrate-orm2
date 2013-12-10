var _     = require("lodash");

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

function MigrationDSL(connection) {
  this.connection = connection;
  this.Dialect =    require("sql-ddl-sync/lib/Dialects/" + connection.dialect);
  this.db =         connection.db;
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

//----- patch around node-migrate libs
module.exports = function(connection){
  var dsl = new MigrationDSL(connection);
  var migratePatch = require("./migrate-patch")(dsl);
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
