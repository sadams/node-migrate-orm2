var mysql       = require('mysql');
var db          = mysql.createConnection("mysql://root:@localhost/test");
var connection = {dialect: 'mysql', db: db}

exports.up = function (next) {
  this.createTable('test_table', {
    id     : { type : "number", primary: true, serial: true },
    name   : { type : "text", required: true }
  }, connection, next);
};

exports.down = function (next){
  this.dropTable('test_table', connection, next);
};
