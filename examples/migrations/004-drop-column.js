exports.up = function(next){
  this.dropColumn('test_table2','newColumn', next);
};

exports.down = function(next){
  this.addColumn('test_table2',  {
    newColumn   : { type : "number" }
  }, next);
};