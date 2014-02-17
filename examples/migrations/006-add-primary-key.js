exports.up = function(next){
this.addPrimaryKey('table_primary_keys', 'price', next);
};

exports.down = function(next){
  this.dropPrimaryKey('table_primary_keys', 'price', next);
};
