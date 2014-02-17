exports.up = function(next){
  this.createTable('table_primary_keys', {
    price  : { type : "number" },
  }, next);
};

exports.down = function(next){
  this.dropTable('table_primary_keys', next);
};


