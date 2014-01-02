// To test, rename this file to config.js and update
// the following configuration
//
// To run a single driver, go to root folder and do (mysql example):
// ORM_PROTOCOL=mysql node test/run
//
// To run all drivers:
// node test/run

exports.mysql = {
  protocol : 'mysql',
  user     : "root",
  password : "",
  query    : {},
  database : 'test',
  host     : '127.0.0.1',
  port     : 3306
};

exports.postgresql = {
  protocol : 'postgresql',
  user     : "postgres",
  password : "",
  query    : {},
  database : 'test',
  host     : '127.0.0.1',
  port     : 5432
};
