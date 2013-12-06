exports.up = function(next){
  this.addColumn('test_table2',  {
    newColumn   : { type : "number" }
  }, next);
};

exports.down = function(next){};
