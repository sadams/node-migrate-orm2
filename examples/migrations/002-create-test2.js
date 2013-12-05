var createTable = require('./../..').createTable;
var dropTable = require('./../..').dropTable;
var mysql       = require('mysql');
var db          = mysql.createConnection("mysql://root:@localhost/test");
var connection = {dialect: 'mysql', db: db}

exports.up = function(next){
  createTable('test_table2', {
    id     : { type : "number", primary: true, serial: true },
    int2   : { type : "number", size: 2 },
    int4   : { type : "number", size: 4 },
    int8   : { type : "number", size: 8 },
    float4 : { type : "number", rational: true, size: 4 },
    float8 : { type : "number", rational: true, size: 8 }
  }, connection, next);
};

exports.down = function(next){
  dropTable('test_table2', connection, next);
};
