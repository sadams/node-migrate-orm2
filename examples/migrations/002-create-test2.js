exports.up = function(next){
  this.createTable('test_table2', {
    id        : { type : "serial", key: true },
    table1id  : { type : "integer" },
    int2      : { type : "integer", size: 2 },
    int4      : { type : "integer", size: 4 },
    int8      : { type : "integer", size: 8 },
    float4    : { type : "number",  size: 4 },
    float8    : { type : "number",  size: 8 }
  }, next);
};

exports.down = function(next){
  this.dropTable('test_table2', next);
};
