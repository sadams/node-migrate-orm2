module.exports = function (dsl) {
  var Set = require('migrate/lib/set');

//Override node-migrate's Set.prototype.save to write to the Migrations table instead.
  Set.prototype.save = function(fn){
    this.emit('save');
    fn && fn();
  };


  //copied from Set in node-migrate
  /**
   * Get index of given migration in list of migrations
   *
   * @api private
   */

  function positionOfMigration(migrations, filename) {
    for(var i=0; i < migrations.length; ++i) {
      if (migrations[i].title == filename) return i;
    }
    return -1;
  }

  Set.prototype._migrate = function(direction, fn, migrationName){
    var self = this
      , migrations
      , migrationPos;

    if (!migrationName) {
      migrationPos = direction == 'up' ? this.migrations.length : 0;
    } else if ((migrationPos = positionOfMigration(this.migrations, migrationName)) == -1) {
      console.error("Could not find migration: " + migrationName);
      process.exit(1);
    }

    switch (direction) {
      case 'up':
        migrations = this.migrations.slice(this.pos, migrationPos+1);
        this.pos += migrations.length;
        break;
      case 'down':
        migrations = this.migrations.slice(migrationPos, this.pos).reverse();
        this.pos -= migrations.length;
        break;
    }

    function next(err, migration) {
      // error from previous migration
      if (err) return fn(err);
      // done
      if (!migration) {
        self.emit('complete');
        self.save(fn);
        return;
      }

      self.emit('migration', migration, direction);

      //it executes here ..
      migration[direction].call(dsl, function(err){
        next(err, migrations.shift());
      });
    }

    next(null, migrations.shift());
  };

  return require('migrate');
}