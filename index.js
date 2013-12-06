var _     = require("lodash");

//----- utility functions below
function getConfiguration(collectionName, options, connection){
  var Dialect     = require("sql-ddl-sync/lib/Dialects/" + connection.dialect);
  var db          = connection.db;

  collection = {
    name:       collectionName,
    properties: options
  }

  fn(collection, db, Dialect, cb)
}

//abstracted and altered from sql-ddl-sync Sync closure
var createCollection = function(collection, db, Dialect, cb) {
  var columns = [];
  var primary = [];

  for (var k in collection.properties) {
    var col = createColumn(collection.name, k, collection.properties[k], Dialect);

    if (col === false) {
      return cb(new Error("Unknown type for property '" + k + "'"));
    }

    if (collection.properties[k].primary) {
      primary.push(k);
    }

    columns.push(col.value);
  }

  if (typeof Dialect.checkPrimary == "function") {
    primary = Dialect.checkPrimary(primary);
  }

  Dialect.createCollection(db, collection.name, columns, primary, cb);
}

//abstracted from Sync closure
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

var addColumnToCollection = function(collection, db, Dialect, cb){
  columnName = _.keys(collection.properties)[0]
  column = createColumn(collection.name, columnName, collection.properties[columnName], Dialect);
  Dialect.addCollectionColumn(db, collection.name, column.value, null, cb);
};

var dropColumnFromCollection = function(collection, db, Dialect, cb){
  columnName = collection.properties
  Dialect.dropCollectionColumn(db, collection.name, columnName, cb);
};


function MigrationDSL(connection) {
  this.config = {
    connection: connection,
    Dialect:    require("sql-ddl-sync/lib/Dialects/" + connection.dialect),
    db:         connection.db,

    collection: {
      name:       collectionName,
      properties: options
    }
  }
}

MigrationDSL.prototype = {
  //----- Migration DSL functions
  createTable: function(collectionName, options, cb){
    createCollection(this.config, cb)
  }

  , addColumn: function(collectionName, options, cb){
      addColumnToCollection(this.config, cb)
  }

  , dropColumn: function(collectionName, options, cb){
    dropColumnFromCollection(this.config, cb)
  }

  , dropTable: function(collectionName, cb){
    Dialect.dropCollection(db, this.config.collection.name, cb);
  }
}

//----- patch around node-migrate libs
module.exports = function(connection){
  var dsl = new MigrationDSL(connection)
  return require("./lib/migrate-patch")(dsl)
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
