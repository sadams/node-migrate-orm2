var _      = require('lodash');
var path   = require('path');
var orm    = require('orm');
var rimraf = require('rimraf');
var common = module.exports;


var aliases = {
  postgres: 'postgresql'
};

module.exports = {
  config: function () {
    return require('./config');
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

    orm.connect(config[protocol], function (err, connection) {
      if (err) return cb(err);
      cb(null, connection.driver);
    });
  },

  cleanupDir: function (folder, cb) {
    rimraf(path.join(process.cwd() ,folder), cb);
  },

  cleanupDbAndDir: function (conn, folder, cb) {
    rimraf(path.join(process.cwd(), folder), function(err, result) {
      try {
        conn.db.query('drop table orm_migrations', cb);
      }
      catch (err) {
        cb(err);
      };
    });
  }
};
