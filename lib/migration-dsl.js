var _  = require("lodash");

//lets you attach further metadata to column definition
//e.g. 'references product(id) on delete cascade'
var getColumnMetadata = function(property){
  return _.has(property, 'addSQL') ? property.addSQL : "";
}

//duplicated from sql-ddl-sync Sync closure
var createColumn = function (collection, name, property, Dialect, driver) {
  var type =  Dialect.getType(collection, property, driver);

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

function MigrationDSL(driver) {
  this.driver           = driver;
  this.Dialect          = require("sql-ddl-sync").dialect(driver.dialect);
  this.Dialect.escapeId = driver.query.escapeId;
}

MigrationDSL.prototype = {
  //----- Migration DSL functions
  //duplicated and altered from sql-ddl-sync Sync closure
  createTable: function (collectionName, options, cb) {
    var columns = [];
    var keys = [];

    for (var k in options) {
      var col = createColumn(collectionName, k, options[k], this.Dialect, this.driver);

      if (col === false) {
        return cb(new Error("Unknown type for property '" + k + "'"));
      }

      // `primary` is deprecated in favour of `key`
      if (options[k].key || options[k].primary) {
        keys.push(k);
      }

      if (typeof this.Dialect.processKeys == "function") {
        keys = this.Dialect.processKeys(keys);
      }

      columns.push(col.value);
    }

    this.Dialect.createCollection(this.driver, collectionName, columns, keys, cb);
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

  hasTable: function(collectionName, cb) {
    this.Dialect.hasCollection(this.driver, collectionName, cb);
  },

  getColumns: function (collectionName, cb) {
    this.Dialect.getCollectionProperties(this.driver, collectionName, cb);
  },

  execQuery: function (query, args, cb) {
    this.driver.execQuery(query, args, cb);
  }

  // comment out for now
  // , renameTable: function(oldCollectionName, newCollectionName, cb){
  //   this.Dialect.renameTable(this.driver, oldCollectionName, newCollectionName, cb);
  // }
}

module.exports = MigrationDSL;
