var Migrator(conn) {
  this.connection = conn;
}
Migrator.prototype.createTable = function () {}

exports.run = function(connection){
  var migrator = new Migrator(connection);

  migrator.run();
}
