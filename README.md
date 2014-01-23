# migrate-orm2

Migrations using [ORM2's](https://github.com/dresende/node-orm2) model DSL leveraging Visionmedia's node-migrate.

## Installation

```
npm install migrate-orm2
```

## Usage

The example below uses MySQL. Locomote uses migrate-orm2 with Postgres. Testing was also done with SQLite3, though some driver issues were encountered.

Build a connection & construct the migrate-orm2 Task object:

```js
var orm         = require('orm');
var MigrateTask = require('migrate-orm2');

orm.connect(connectionString, function (err, connection) {
  if (err) throw err;
  var task = new Task(connection.driver);
});
```

The Task constructor function can support options allowing for a custom migrations directory and/or coffeescript support (see 'Usage - opts' below).

A Task object offers three operations - *generate*, *up* and *down*.

## Usage - generate

```
> task.generate('create-users', function(err, result){});
>   create : /Users/nicholasf/code/locomote/node-migrate-orm2/migrations/001-create-users.js

```

The 'migrations' folder is the default but can be overridden in the opts argument (see 'Usage - opts' below).

A skeleton migration file now exists and can be populated with the [ORM2 DSL](https://github.com/dresende/node-sql-ddl-sync#example).

A simple example, taken from the tests:

```js
exports.up = function (next) {
  this.createTable('test_table', {
    id     : { type : "number", primary: true, serial: true },
    name   : { type : "text", required: true }
  }, next);
};

exports.down = function (next){
  this.dropTable('test_table', next);
};

```

Another example for adding or dropping a column:

```js
exports.up = function(next){
  this.addColumn('agency', preferredProviders: {type: "text", defaultValue: '1G', required: true}, next);
}

exports.down = function(next){
  this.dropColumn('agency', 'preferredProvider', next);
}
```

An example of adding an index:

```js
exports.up = function (next) {
  this.addIndex('agency_email_idx', {
    table: 'agency',
    columns: ['email'],
    unique: true
  }, next);
};
```

exports.down = function (next) {
  this.dropIndex('agency_email_idx', 'agency', next);
};


So, ```this``` supports the following operations:

* createTable
* dropTable
* addColumn
* dropColumn
* addIndex
* dropIndex

We would like to add modifyColumn functionality in the future.

## Usage - up and down

```
> task.up(function(e,r){});
>   up : migrations/001-create-users.js
  migration : complete
```

Alternatively, when there are many migrations, a filename can be specified:

```
> task.generate('create-servers', function(err, result){});
>   create : /Users/nicholasf/code/locomote/node-migrate-orm2/migrations/002-create-servers.js

> task.up('001-create-users.js', function(e,r){})
>   up : migrations/001-create-users.js
  migration : complete
```

This means 'run up to this migration then execute its up function, then stop.'

## Usage - the orm_migrations table

Migrate-orm2 maintains an internal orm_migrations table which allows it to run from previous state.

Proceeding from the example immediately above:

```
> task.down(function(e,r){});
>   down : migrations/001-create-users.js
  migration : complete
```

Although there are two migration files, the up function reads from orm_migrations to find its current point. It then works out to call the down function of 001-create-users.js instead of 002-create-servers.js.

The orm_migrations table can be used to represent the history of migrations.

```
mysql> select * from orm_migrations;
+---------------------+-----------+--------------------------+
| migration           | direction | created_at               |
+---------------------+-----------+--------------------------+
| 001-create-users.js | up        | 2013-12-15T23:07:09.911Z |
| 001-create-users.js | up        | 2013-12-15T23:09:01.263Z |
| 001-create-users.js | down      | 2013-12-15T23:10:04.023Z |
+---------------------+-----------+--------------------------+
3 rows in set (0.00 sec)

```

This reflects the history above.

## Usage - opts

The Task object can be modified to work from a different directory or to generate and cooperate with coffee-script migrations.

```
var task = new Task(connection, {dir: 'data/migrations', coffee: true});
```

## Usage - grunt

We handcraft grunt and our tasks looks this.

Firstly, we have a helper file which knows how to build the connection and opts and invoke the Task object:

```js
var MigrationTask = require('migrate-orm2');
var orm = require('orm');

exports.runMigration = function (operation, grunt, done) {
  orm.settings.set("connection.debug", true);
  orm.connect('mysql://root@localhost/ninja', function (err, connection) {
    if (err) throw(err);

    var migrationTask = new MigrationTask(
      connection.driver,
      { dir: 'data/migrations'}
    );
    migrationTask[operation](grunt.option('file'), done);
  });
};
```

Registering the Grunt tasks looks like this:

```js
grunt.registerTask('migrate:generate', '', function () {
  var done = this.async();
  require('./tasks/db').runMigration('generate', grunt, done);
});

grunt.registerTask('migrate:up', '', function () {
  var done = this.async();
  require('./tasks/db').runMigration('up', grunt, done);
});

grunt.registerTask('migrate:down', '', function () {
  var done = this.async();
  require('./tasks/db').runMigration('down', grunt, done);
});
```

To generate a migration file or to indicate a direction:

```js
grunt migrate:generate --file=create-users
grunt migrate:generate --file=create-servers
grunt migrate:up --file=001-create-users.js
```

## Running Tests

Create `test/config.js` (see `test/config.example.js` for instructions)

```bash
npm test
```
This will run the tests against all configurations inside `config.js`.
To run against a single config:
```bash
ORM_PROTOCOL=mysql node test/run
# OR
ORM_PROTOCOL=mysql mocha test/integration
```


## Contributors

Locomoters:
* nicholasf
* dxg
* vaskas
* benkitzelman
* sidorares

This work is a melding of two underlying libraries:

* [node-migrate](https://github.com/visionmedia/node-migrate) from @visionmedia (TJ)
* [node-sql-ddl-sync](https://github.com/dresende/node-sql-ddl-sync) from @dresende

