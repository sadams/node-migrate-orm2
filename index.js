var join    = require('path').join
  , fs      = require('fs')
  , mkdirp  = require('mkdirp')
  , async   = require('async');


function MigrationTask(connection, dir){
  this.connection = connection;
  this.dir = (dir || 'migrations');
  this.migrate = require('./lib/migration-dsl')(connection);
  this.writeQueue = [];
}

MigrationTask.prototype.run = function(done) {
  var self = this;
  mkdirp(this.dir, 0774, function (err) {
    self.createMigrationsTable(function (err) {
      done(null);
    })
  });
}

/**
 * Load migrations.
 */

MigrationTask.prototype.migrations = function() {
  self = this;
  return fs.readdirSync(this.dir).filter(function(file){
    return file.match(/^\d+.*\.js$/);
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

var template = [
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

var orm2Migrations = {
  migration  : { type : "text", required: true },
  direction  : { type : "text", required: true },
  created_at : { type : "date", required: true }
}

MigrationTask.prototype.createMigrationsTable = function (cb) {
  var dsl = this.migrate.dsl;
  var self = this;
  dsl.createTable('ORM2_MIGRATIONS', orm2Migrations, cb);
}

record = function(item, cb) {
  var connection = item.connection;
  var migration = item.migration;
  var direction = item.direction;

  migration = migration.split('/')[1]; //remove reference to MigrationTask.dir

  var sqlStr = "INSERT into ORM2_MIGRATIONS(migration, direction, created_at) VALUES('" + migration + "'";
  sqlStr     += ", '" + direction + "'";
  sqlStr     += ", '" + new Date() + "')";

  //a hack until we can call a dialects module for orm2
  switch (connection.dialect) {
    case 'sqlite':
      connection.db.all(sqlStr, cb)
      break;
    default:
      connection.db.query(sqlStr, cb)
  }
}

/**
 * Create a migration with the given `name`.
 *
 * @param {String} name
 */

function generate(name) {
  var path = name + '.js';
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
  self = this;
  this.migrations().forEach(function(path){
    console.log(path)
    var mod = require(process.cwd() + '/' + path);
    self.migrate(path, mod.up, mod.down);
  });

  var set = this.migrate();

  set.on('migration', function(migration, direction){
    log(direction, migration.title);
    self.writeQueue.push({direction: direction, migration: migration.title, connection: self.connection});
  });

  set.on('save', function(){
    log('migration', 'complete');
    async.eachSeries(self.writeQueue, record, function(err){
      self.writeQueue = [];
      cb(err);
    })
  });

  var migrationPath = migrationName
    ? join('migrations', migrationName)
    : migrationName;

  set[direction](null, migrationPath);
}

/**
 * up [name]
 */

MigrationTask.prototype.up = function(migrationName, cb){
  var self = this;
  this.run(function(){
//    if (!migrationName){
//      migrationName = this.getLastMigration()
//    }

    self.performMigration('up', migrationName, cb);
  })
}

/**
 * down [name]
 */

MigrationTask.prototype.down =  function(migrationName, cb){
  var self = this;
  this.run(function(){
    self.performMigration('down', migrationName, cb);
  })
}

/**
 * create [title]
 */

MigrationTask.prototype.generate = function(title, cb){
  var self = this;
  this.run(function(){
    var migrations = fs.readdirSync(self.dir).filter(function(file){
      return file.match(/^\d+/);
    }).map(function(file){
        return parseInt(file.match(/^(\d+)/)[1], 10);
      }).sort(function(a, b){
        return a - b;
      });

    var curr = pad((migrations.pop() || 0) + 1);
    title = title ? curr + '-' + title : curr;
    generate(self.dir + '/' + title);
    cb(null, title);
  })
}

module.exports = MigrationTask;

