var join    = require('path').join
  , fs      = require('fs')
  , mkdirp  = require('mkdirp')
  , async   = require('async')
  , _       = require('lodash');


function MigrationTask(connection, opts){
  this.connection       = connection;
  opts                  = (opts || {})
  this.dir              = (opts.dir || 'migrations');
  this.coffee           = (opts.coffee || false);
  this.migrate          = require('./lib/migration-dsl')(connection, this);
  this.resumptionPoint  = 0;
}

MigrationTask.prototype.mkdir = function(done) {
  var self = this;
  mkdirp(this.dir, 0774, function (err) {
    done(null);
  });
}

/**
 * Load migrations.
 */

MigrationTask.prototype.migrations = function() {
  self = this;
  return fs.readdirSync(this.dir).filter(function(file){
    if (self.coffee) {
      return file.match(/^\d+.*\.coffee$/);
    }
    else {
      return file.match(/^\d+.*\.js$/);
    }
  }).sort().map(function(file){
      return self.dir + '/' + file;
    });
}

/**
 * Log a keyed message.
 */

function log(key, msg) {
  console.log('  \033[90m%s :\033[0m \033[36m%s\033[0m', key, msg);
}

/**
 * Slugify the given `str`.
 */

function slugify(str) {
  return str.replace(/\s+/g, '-');
}

/**
 * Pad the given number.
 *
 * @param {Number} n
 * @return {String}
 */

function pad(n) {
  return Array(4 - n.toString().length).join('0') + n;
}

var jsTemplate = [
  ''
  , 'exports.up = function(next){'
  , '  next();'
  , '};'
  , ''
  , 'exports.down = function(next){'
  , '  next();'
  , '};'
  , ''
].join('\n');

var coffeeTemplate = [
  ''
  , 'exports.up = (next) -> '
  , '  next()'
  , ''
  , 'exports.down = (next) ->'
  , '  next()'
  , ''
].join('\n');

//var orm2Migrations = {
//  migration  : { type : "text", required: true },
//  direction  : { type : "text", required: true },
//  created_at : { type : "text", time: true, required: true }
//}
//
//MigrationTask.prototype.ensureMigrationsTable = function(cb) {
//  var dsl = this.migrate.dsl;
//  var self = this;
//
//  var recallPositionFallback = function(err, result){
//    if (err){ //orm_migrations already exists, so we need to load the previous position
//      self.position(cb)
//    }
//    else {
//      cb();
//    }
//  }
//
//  dsl.createTable('orm_migrations', orm2Migrations, recallPositionFallback);
//}
//
//MigrationTask.prototype.position =  function(cb){
//  self = this;
//
//  var positioner = function(migrationName, cb){
//    var migrations = _.map(self.migrations(), function(migrationPath){ return migrationWithoutPath(migrationPath) })
//    var idx = _.indexOf(migrations, migrationName, true);
//    if (idx >= 0) {
//      self.resumptionPoint = idx + 1;
//    }
//    cb();
//  }
//
//  switch(this.connection.dialect){
//    case 'sqlite':
//      currentSqliteMigration(this.connection, positioner, cb)
//      break;
//    case 'postgresql':
//      currentPostgresMigration(this.connection, positioner, cb)
//      break;
//    case 'mysql':
//      currentMySQLMigration(this.connection, positioner, cb)
//      break;
//  }
//}
//
//function currentMySQLMigration(connection, positioner, cb){
//  var sql = "select migration from orm_migrations order by created_at desc limit 1;";
//  execute(connection, sql, function(e,r){
//    if (r.length == 0){
//      cb('', e);
//    } else {
//      positioner(r[0].migration, cb)
//    }
//  })
//}
//
//function currentPostgresMigration(connection, positioner, cb){
//  var sql = "select migration from orm_migrations order by created_at desc limit 1;";
//  execute(connection, sql, function(e,r){
//    if (r.rowCount == 0){
//      cb('', e);
//    } else {
//      positioner(r.rows[0].migration, cb)
//    }
//  })
//}
//
//function currentSqliteMigration(connection, positioner, cb){
////  var sql = "select migration from \"orm_migrations\" order by created_at desc limit 1;";
//  var sql = "select * from orm_migrations order by created_at desc limit 1;";
//
//  execute(connection, sql, function(e,r){
//    if (r.length == 0){
//      cb('', e);
//    } else {
//      positioner(r[0].migration, cb);
//    }
//  })
//}
//
//function execute(connection, sql, cb){
//  switch (connection.dialect) {
//    case 'sqlite':
//      connection.db.all(sql, cb)
//      break;
//    default:
//      connection.db.query(sql, cb)
//      break;
//  }
//}
//
//function migrationWithoutPath(migration){
//  var migrationBits = migration.split("/"); //remove reference to MigrationTask.dir
//  return migrationBits[migrationBits.length -1];
//}
//
//function record(item, cb) {
//  var connection = item.connection;
//  var direction = item.direction;
//  var migration = migrationWithoutPath(item.migration);
//
//  var sqlStr = "INSERT into \"orm_migrations\"(migration, direction, created_at) VALUES('" + migration + "'";
//  sqlStr     += ", '" + direction + "'";
//  sqlStr     += ", '" + new Date().toISOString() + "')";
//
//  execute(connection, sqlStr, cb);
//}
//
/**
 * Create a migration with the given `name`.
 *
 * @param {String} name
 */

function generate(name, extension, templateName) {
  template = ((extension === "js") ? jsTemplate : coffeeTemplate);
  var path = name + '.' + extension;
  log('create', join(this.process.cwd(), path));
  fs.writeFileSync(path, template);
}

/**
 * Perform a migration in the given `direction`.
 *
 * @param {Number} direction
 */

MigrationTask.prototype.performMigration = function(direction, migrationName, cb) {
  this.migrate(this.dir + '/.migrate');

  if (this.resumptionPoint > 0){
    this.migrate.set.pos = this.resumptionPoint;
  }

  var self = this;
  this.migrations().forEach(function(path){
    var mod = require(process.cwd() + '/' + path);
    self.migrate(path, mod.up, mod.down);
  });

  var set = this.migrate();

  set.on('migration', function(migration, direction){
    log(direction, migration.title);
  });

  set.on('save', function(){
    log('migration', 'complete');
    cb();
  });


  var migrationPath = migrationName
    ? join(this.dir, migrationName)
    : migrationName;

  set[direction](null, migrationPath);
}

/**
 * up [name]
 */

MigrationTask.prototype.up = function(migrationName, cb){
  if (typeof migrationName === 'function'){
    cb = migrationName;
    migrationName = '';
  }

  var self = this;
  this.mkdir(function(){
    self.performMigration('up', migrationName, cb);
  })
}

/**
 * down [name]
 */

MigrationTask.prototype.down =  function(migrationName, cb){
  if (typeof migrationName === 'function'){
    cb = migrationName;
    migrationName = '';
  }

  var self = this;
  this.mkdir(function(){
    self.performMigration('down', migrationName, cb);
  })
}

  /**
 * create [title]
 */

MigrationTask.prototype.generate = function(title, cb){
  var self = this;
  this.mkdir(function(){
    var migrations = fs.readdirSync(self.dir).filter(function(file){
      return file.match(/^\d+/);
    }).map(function(file){
        return parseInt(file.match(/^(\d+)/)[1], 10);
      }).sort(function(a, b){
        return a - b;
      });

    var curr = pad((migrations.pop() || 0) + 1);
    title = title ? curr + '-' + title : curr;
    var extension = (self.coffee ? 'coffee' : 'js')
    generate(self.dir + '/' + title, extension);
    cb(null, title);
  })
}

module.exports = MigrationTask;

