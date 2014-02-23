//note - this is an example only. Table2

exports.up = function(next){
  this.addForeignKey('test_table2',
    { name:       'table1id',
      references: { table: 'table1', column: 'id' }
    }, next);
};

exports.down = function(next){
  this.dropForeignKey('test_table2', 'table1id', next);
};
