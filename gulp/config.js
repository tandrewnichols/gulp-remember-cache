const path = require('path');

module.exports = {
  
  tests: {
    unit: ['test/unit/**/*.js', '!test/unit/helpers/**/*.{js,coffee}'],
    integration: ['test/integration/**/*.js']
  },
  helpers: ['test/unit/helpers/**/*.{js,coffee}'],
  lib: ['lib/**/*.js'],
  root: path.resolve(__dirname, '..') + path.sep
};
