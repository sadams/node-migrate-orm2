var _      = require("lodash");
var fs     = require('fs');
var path   = require('path');
var util   = require('util');
var async  = require('async');
var mkdirp = require('mkdirp');

var Migration    = require('./migration');
var MigrationDsl = require('./migration-dsl');

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
  , 'exports.up = (next) ->'
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
  var template = ((extension === "js") ? jsTemplate : coffeeTemplate);
  var filePath = name + '.' + extension;
  log('create', path.join(this.process.cwd(), filePath));
  fs.writeFileSync(filePath, template);
}

function withoutPath(file) {
  var migrationBits = migration.split('/'); //remove reference to MigrationTask.dir
  return migrationBits[migrationBits.length -1];
}

function Migrator(driver, opts) {
  opts                  = (opts || {})
  this.driver           = driver;
  this.dir              = (opts.dir || 'migrations');
  this.coffee           = (opts.coffee || false);
  this.dsl              = new MigrationDsl(driver);
  this.migration        = new Migration(this.dsl, log);
}

/**
 * Create the migration directory and storage table.
 */

Migrator.prototype.setup = function(done) {
  this.mkdir(this.ensureMigrationsTable.bind(this, done));
}

/**
 * Create the migration directory
 */

Migrator.prototype.mkdir = function(done) {
  mkdirp(this.dir, 0774, function() {
    done();
  });
}

/**
 * Load migrations modules from the file system.
 */

Migrator.prototype.loadModules = function() {
  var self = this;
  return fs.readdirSync(this.dir).filter(function(file) {
    if (self.coffee) {
      return file.match(/^\d+.*\.coffee$/);
    }
    else {
      return file.match(/^\d+.*\.js$/);
    }
  }).sort().map(function(file) {
    var mod = require(path.join(process.cwd(), self.dir, file));
    return { file: file, up: mod.up, down: mod.down };
  });
}

/**
 * Perform a migration in the given `direction`.
 *
 * @param {Number} direction
 */

Migrator.prototype.performMigration = function(direction, migrationName, cb) {
  var self = this;

  if(typeof migrationName === 'function') {
    cb = migrationName;
    migrationName = '';
  }

  this.migration.all(function(err, appliedMigrations) {
    if(err) return cb(err);

    var migrationModules = self.loadModules();

    if(direction === 'down') migrationModules.reverse();

    // determine cut off point for a given migrationName
    var cutOff = _.findIndex(migrationModules, { file: migrationName });
    if(cutOff > -1) {
      migrationModules = migrationModules.slice(0, cutOff + 1);
    }

    // is a migration module applied ?
    var isApplied = function(mod) {
      return _.includes(appliedMigrations, mod.file);
    }
    if(direction === 'up') { // up -> reject the applied migrations
      migrationModules = _.reject(migrationModules, isApplied);
    } else {                 // down -> we only do the applied one
      migrationModules = _.filter(migrationModules, isApplied);
      // down migration without parameter -> rollback only the first one
      if(_.isEmpty(migrationName)) migrationModules = [ _.head(migrationModules) ];
    }

    var migrationCalls = _.map(migrationModules, function(mod) {
      return function(done) {
        log(direction, mod.file);
        // call the up/down function, using dsl as 'this'
        mod[direction].call(self.dsl, function(err) {
          if(err) return done(err);
          if(direction === 'up') {
            self.migration.save(mod.file, done);
          } else {
            self.migration.delete(mod.file, done);
          }
        });
      };
    });

    async.series(migrationCalls, function(err) {
      if(err) return cb(err);
      log('migration', 'complete');
      cb();
    });
  })
}

/**
 * up [name]
 */

Migrator.prototype.up = function(migrationName, cb) {
  var self = this;
  this.setup(function(err) {
    if (err) return cb(err);
    self.performMigration('up', migrationName, cb);
  });
}

/**
 * down [name]
 */

Migrator.prototype.down =  function(migrationName, cb) {
  var self = this;
  this.setup(function(err) {
    if(err) return cb(err);
    self.performMigration('down', migrationName, cb);
  });
}

/**
 * create [title]
 */

Migrator.prototype.generate = function(title, cb){
  var self = this;
  this.mkdir(function(){
    var migrations = fs.readdirSync(self.dir).filter(function(file) {
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

/**
 * ensure the migration table is created ( and is v2 compliant )
 */
Migrator.prototype.ensureMigrationsTable = function(cb) {
  this.migration.ensureMigrationsTable(cb);
}


module.exports = Migrator;
