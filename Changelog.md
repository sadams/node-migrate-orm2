### v2.0.1
- Correctly load `sql-ddl-sync` dialect - fixes for npm 5

### v2.0.0
- Migrate to new `orm_migrations` table format
- Add `Task.ensureMigrationsTable` to allow a manual migration to v2
- Fix rollback issues
- `down` default behaviour is to rollback the last migration ( use to rollback every migrations )

### v1.2.14
- Add custom types support

### v1.2.13
- Add missing 'var' declarations (#18)

### v1.2.11 - 14 May 2014
- Fix sqlite create table duplicate primary key (#13, #14)
- Update examples

### v1.2.10 - 13 May 2014
- Fix Dialect.getType call (#14)
- Deprecate `.primary` in favour of `.key`
