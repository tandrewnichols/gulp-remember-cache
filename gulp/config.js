const path = require('path');

module.exports = {
  tests: ['test/**/*.js', '!test/fixtures/**/*'],
  lib: ['lib/**/*.js'],
  root: path.resolve(__dirname, '..') + path.sep
};
