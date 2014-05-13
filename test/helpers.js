var _      = require('lodash');
var fs     = require('fs');
var util   = require('util');
var path   = require('path');
var orm    = require('orm');
var rimraf = require('rimraf');
var common = module.exports;
var async  = require('async');


var aliases = {
  postgres: 'postgresql'
};

var travisConfig = {
  mysql: {
    protocol : 'mysql',
    user     : 'root',
    password : '',
    query    : { pool: true },
    database : 'migrate_orm2_test',
    host     : '127.0.0.1'
  },
  postgresql : {
    protocol : 'postgresql',
    user     : 'postgres',
    password : '',
    query    : { pool: true },
    database : 'migrate_orm2_test',
    host     : '127.0.0.1'
  }
};

module.exports = {
  isTravis: function () {
    return Boolean(process.env.CI);
  },

  config: function () {
    if (this.isTravis()) {
      return travisConfig;
    } else {
      return require('./config');
    }
  },

  protocol: function () {
    var pr = process.env.ORM_PROTOCOL;

    return aliases[pr] || pr
  },

  connect: function (cb) {
    var config = this.config();
    var protocol = this.protocol();

    if (!(protocol in config)) {
      var emsg = "";

      if (!protocol) {
        emsg = "No protocol specified. Specify using: ORM_PROTOCOL=mysql mocha test/integration"
      } else {
        emsg = "Protocol '" + protocol + "' missing in config.js"
      }

      return cb(new Error(emsg));
    }

    // leaving this here for debugging.
    // orm.settings.set("connection.debug", true);

    orm.connect(config[protocol], function (err, connection) {
      if (err) return cb(err);
      cb(null, connection.driver);
    });
  },

  writeMigration: function (task, name, code) {
    var filePath = util.format(
      "%s/%s/%s", path.normalize(path.join(__dirname, '..')), task.dir, name
    );

    // Because we have different migration files with the same path.
    delete require.cache[filePath];

    fs.writeFileSync(filePath, code);
  },

  cleanupDir: function (folder, cb) {
    rimraf(path.join(process.cwd() ,folder), cb);
  },

  cleanupDbAndDir: function (conn, folder, tables, cb) {
    rimraf(path.join(process.cwd(), folder), function(err, result) {
      if (err) return cb(err);

      tables.reverse();
      tables.push("orm_migrations");
      tables.reverse();

      var dropper = function(table, cb){
        conn.execQuery('DROP TABLE IF EXISTS ??', [table], cb);
      }

      async.eachSeries(tables, dropper, function(err, result){
        cb(err, result);
      })
    });
  }
};
