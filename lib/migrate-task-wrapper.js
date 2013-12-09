var join = require('path').join
  , fs = require('fs');


function MigrationTaskWrapper(connection, dir){
  this.connection = connection;
  this.dir = (dir || 'migrations');
  this.migrate = require('../')(connection);

  try {
    fs.mkdirSync(this.dir, 0774);
  } catch (err) {
    // ignore
  }

  setupMigrationsTable = createMigrationsTable.bind(this)
  process.nextTick(setupMigrationsTable);
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

var migrationsTableSQL = "CREATE table ORM2_MIGRATIONS(migration varchar(255), direction varchar(5), created_at datetime);"

var createMigrationsTable = function(cb){
  try {
    this.connection.db.query(migrationsTableSQL, cb);
  } catch (err) {
    //ignore - assume that this is happening because the table already exists.
  }
}

//MigrationTaskWrapper.prototype.record = function(migration, direction, cb) {
//  var sqlStr = "INSERT into MIGRATIONS(migration, direction, created_at) VALUES(" + migration;
//  sqlStr     += ", " + direction;
//  sqlStr     += ", " + new Date();
//
//  this.connection.query(sqlStr, cb)
//}

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

MigrationTaskWrapper.prototype.performMigration = function(direction, migrationName) {
  this.migrate(this.dir + '/.migrate');
  migrations().forEach(function(path){
    var mod = require(process.cwd() + '/' + path);
    migrate(path, mod.up, mod.down);
  });

  var set = this.migrate();

  set.on('migration', function(migration, direction){
    log(direction, migration.title);
    record(direction, migration.title, cb);
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

MigrationTaskWrapper.prototype.up = function(migrationName, cb){
  performMigration('up', migrationName, cb);
}

/**
 * down [name]
 */

MigrationTaskWrapper.prototype.down =  function(migrationName, cb){
  performMigration('down', migrationName, cb);
}

/**
 * create [title]
 */

MigrationTaskWrapper.prototype.generate = function(){
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
  generate(this.dir + '/' + title);
}

module.exports = MigrationTaskWrapper;

