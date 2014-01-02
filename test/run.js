var Mocha   = require('mocha');
var fs      = require('fs');
var path    = require('path');
var helpers = require('./helpers');

var mocha      = new Mocha({ reporter: "spec" });
var location   = path.normalize(path.join(__dirname, 'integration'));
var configPath = path.normalize(path.join(__dirname, 'config.js'));

if (!fs.existsSync(configPath)) {
  console.error("test/config.js is missing. Take a look at test/config.example.js");
  process.exit(1);
}

function runTests(cb) {
  fs.readdirSync(location).filter(function (file) {
    return file.substr(-3) === '.js';
  }).forEach(function (file) {
    mocha.addFile(
      path.join(location, file)
    );
  });

  mocha.run(cb);
}

var protocol = helpers.protocol();
var protocols = [];

if (protocol) {
  protocols = [protocol];
} else {
  protocols = Object.keys(helpers.config());
}

function run (err) {
  var pr = protocols.shift();
  if (err) {
    console.log(protocol, "tests failed");
    return process.exit(err);
  }
  if (!pr) return process.exit(0);

  process.env.ORM_PROTOCOL = pr

  console.log(
    "\n\nRunning", pr, "tests",
    "\n------------------------"
  );

  runTests(run);
}

run();
