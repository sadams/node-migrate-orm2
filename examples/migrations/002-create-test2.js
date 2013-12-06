exports.up = function(next){
  this.createTable('test_table2', {
    id     : { type : "number", primary: true, serial: true },
    int2   : { type : "number", size: 2 },
    int4   : { type : "number", size: 4 },
    int8   : { type : "number", size: 8 },
    float4 : { type : "number", rational: true, size: 4 },
    float8 : { type : "number", rational: true, size: 8 }
  }, next);
};

exports.down = function(next){
  this.dropTable('test_table2', next);
};
