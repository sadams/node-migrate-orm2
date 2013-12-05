var dropColumn = require('./../..').dropColumn;
var addColumn = require('./../..').addColumn;
var mysql       = require('mysql');
var db          = mysql.createConnection("mysql://root:@localhost/test");
var connection = {dialect: 'mysql', db: db}

exports.up = function(next){
  dropColumn('test_table2','newColumn', connection, next);
};

exports.down = function(next){
  addColumn('test_table2',  {
    newColumn   : { type : "number" }
  }, connection, next);
};
