// To test, copy this file to test/config.js and update the configuration.
//
// To run a single driver, go to root folder and:
// ORM_PROTOCOL=mysql node test/run
//
// To run all drivers:
// node test/run OR npm test

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
