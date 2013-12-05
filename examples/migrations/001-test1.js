var createTable = require('./../..').createTable;
var dropTable = require('./../..').dropTable;
var mysql       = require('mysql');
var db          = mysql.createConnection("mysql://root:@localhost/test");

var connection = {dialect: 'mysql', db: db}

exports.up = function(next){
  createTable('test_table', {
    id     : { type : "number", primary: true, serial: true },
    name   : { type : "text", required: true }
  }, connection, next);
};

exports.down = function(next){
  dropTable('test_table', connection, next);
};
