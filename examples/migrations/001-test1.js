exports.up = function (next) {
  this.createTable('test_table', {
    id     : { type : "serial", key: true },
    name   : { type : "text", required: true }
  }, next);
};

exports.down = function (next){
  this.dropTable('test_table', next);
};
