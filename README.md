node-migrate-orm2
=================

A library providing migrations using ORM2's model DSL leveraging Visionmedia's node-migrate


var mysql       = require('mysql');
var db          = mysql.createConnection("mysql://root:@localhost/test");
var connection = {dialect: 'mysql', db: db}
