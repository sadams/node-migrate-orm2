var migrate = require('../')(connection)
  , join = require('path').join
  , fs = require('fs');


function MigrationTaskWrapper(connection, dir){
  this.connection = connection;
  this.dir = (dir || 'migrations');

  try {
    fs.mkdirSync(this.dir, 0774);
  } catch (err) {
    // ignore
  }
}

/**
 * Load migrations.
 */

MigrationTaskWrapper.prototype.migrations = function() {
  return fs.readdirSync(this.dir).filter(function(file){
    return file.match(/^\d+.*\.js$/);
  }).sort().map(function(file){
      return 'migrations/' + file;
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

// create ./migrations

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

/**
 * Create a migration with the given `name`.
 *
 * @param {String} name
 */

function create(name) {
  var path = 'migrations/' + name + '.js';
  log('create', join(this.process.cwd(), path));
  fs.writeFileSync(path, template);
}

/**
 * Perform a migration in the given `direction`.
 *
 * @param {Number} direction
 */

function performMigration(direction, migrationName) {
  migrate('migrations/.migrate');
  migrations().forEach(function(path){
    var mod = require(process.cwd() + '/' + path);
    migrate(path, mod.up, mod.down);
  });

  var set = migrate();

  set.on('migration', function(migration, direction){
    log(direction, migration.title);
  });

  set.on('save', function(){
    log('migration', 'complete');
    process.exit();
  });

  var migrationPath = migrationName
    ? join('migrations', migrationName)
    : migrationName;

  set[direction](null, migrationPath);
}


/**
 * up [name]
 */

MigrationTaskWrapper.prototype.up = function(migrationName){
  performMigration('up', migrationName);
},

/**
 * down [name]
 */

MigrationTaskWrapper.prototype.down =  function(migrationName){
  performMigration('down', migrationName);
},

/**
 * create [title]
 */

MigrationTaskWrapper.prototype.create = function(){
  var migrations = fs.readdirSync(this.dir).filter(function(file){
    return file.match(/^\d+/);
  }).map(function(file){
      return parseInt(file.match(/^(\d+)/)[1], 10);
    }).sort(function(a, b){
      return a - b;
    });

  var curr = pad((migrations.pop() || 0) + 1)
    , title = slugify([].slice.call(arguments).join(' '));
  title = title ? curr + '-' + title : curr;
  create(title);
}

module.exports = MigrationTaskWrapper;

