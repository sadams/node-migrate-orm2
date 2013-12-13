module.exports = function (dsl, recorder) {
  var Set = require('migrate/lib/set')
    , _ = require('lodash');

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
      migrationPos = this.migrations.length;
    } else if ((migrationPos = positionOfMigration(this.migrations, migrationName)) == -1) {
      console.error("Could not find migration: " + migrationName);
      return;
    } else {
      this.pos = positionOfMigration(this.migrations, migrationName);
    }

    switch (direction) {
      case 'up':
        migrations = this.migrations.slice(this.pos, migrationPos + 1);
        this.pos += migrations.length;
        break;
      case 'down':
        //note - this is a departure from how node-migrate thinks about migrations
        if (this.pos > 0) {
          migrations = this.migrations.slice(0, this.pos).reverse();
        }
        else {
          migrations = this.migrations.slice(this.pos, migrationPos + 1).reverse();
        }
        this.pos -= migrations.length;
        break;
    }

    function next(err, migration) {
      // error from previous migration
      if (err) throw(err);
      // done
      if (!migration) {
        self.emit('complete');
        self.save(fn);
        return;
      }

      self.emit('migration', migration, direction);

      migration[direction].call(dsl, function(err){
        recorder.record({migration: migration, direction: direction}, function (err) {
          next(err, migrations.shift());
        })
      });
    }

    next(null, migrations.shift());
  };

  return require('migrate');
}