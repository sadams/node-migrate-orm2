var _     = require("lodash");

//----- Migration DSL functions
exports.createTable = function(collectionName, options, connection, cb){
  fnWithConfiguration.call(null, createCollection, collectionName, options, connection,  cb)
}

exports.addColumn = function(collectionName, options, connection, cb){
  fnWithConfiguration.call(null, addColumnToCollection, collectionName, options, connection,  cb)
}

exports.dropColumn = function(collectionName, options, connection, cb){
  fnWithConfiguration.call(null, dropColumnFromCollection, collectionName, options, connection, cb)
}

exports.dropTable = function(collectionName, connection, cb){
  var Dialect     = require("sql-ddl-sync/lib/Dialects/" + connection.dialect);
  var db          = connection.db;

  collection = {
    name:       collectionName
  }

  Dialect.dropCollection(db, collection.name, cb);
}

var dsl = {
  createTable:    exports.createTable,
  dropTable:      exports.dropTable,
  addColumn:      exports.addColumn,
  dropColumn:     exports.dropColumn
}

//----- patch around node-migrate libs
exports.migratePatch = require("./lib/migrate-patch")(dsl)

//----- utility functions below
function fnWithConfiguration(fn, collectionName, options, connection,  cb){
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
