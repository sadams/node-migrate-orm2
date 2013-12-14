module.exports = function (dsl, record, resume) {
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
      , migrationPos =  positionOfMigration(this.migrations, migrationName);

    resume.cursor(function(err, priorPosition){
      self.pos = (priorPosition || 0)

      if (!migrationName) {
        migrationPos = ((direction == 'up') ? self.migrations.length : 0);
      } else if (migrationPos == -1) {
        console.error("Could not find migration: " + migrationName);
        return;
      } else {
        self.pos = migrationPos;
      }

      switch (direction) {
        case 'up':
          migrations = self.migrations.slice(self.pos, migrationPos + 1);
          self.pos += migrations.length;
          break;
        case 'down':
          //note - this is a departure from how node-migrate thinks about migrations
          if (priorPosition > 0) {
            migrations = self.migrations.slice(migrationPos, priorPosition).reverse();
          }
          else {
            migrations = self.migrations.slice(self.pos, migrationPos + 1).reverse();
          }
          self.pos -= migrations.length;
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
          record.record({migration: migration, direction: direction}, function (err) {
            next(err, migrations.shift());
          })
        });
      }

      next(null, migrations.shift());
    })
  };

  return require('migrate');
}