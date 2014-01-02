var join         = require('path').join
  , fs           = require('fs')
  , mkdirp       = require('mkdirp')
  , async        = require('async')
  , _            = require('lodash')
  , migrationDsl = require('./lib/migration-dsl');


function MigrationTask(connection, opts){
  opts                  = (opts || {})
  this.connection       = connection;
  this.dir              = (opts.dir || 'migrations');
  this.coffee           = (opts.coffee || false);
  this.migrate          = migrationDsl(connection, this);
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

