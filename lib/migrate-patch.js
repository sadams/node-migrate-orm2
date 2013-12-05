var Set = require('migrate/lib/set');

//Override node-migrate's Set.prototype.save to write to the Migrations table instead.
Set.prototype.save = function(fn){
  var self = this
    , json = JSON.stringify(this);
  console.log(json, " <<<< ")
  self.emit('save');
  fn()
};

module.exports = require('migrate');
