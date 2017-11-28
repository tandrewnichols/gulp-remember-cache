const remember = require('../lib/gulp-remember-cache');
const through = require('through2');
const assert = require('stream-assert');
const gulp = require('gulp');
const fs = require('fs-extra');

describe('gulp-remember-cache', () => {
  describe('remember()', () => {
    context('using the library defaults', () => {
      afterEach(() => {
        return Promise.all([
          fs.remove('./lib/apple.js'),
          fs.remove('./lib/banana.js'),
          fs.remove('./.gulp-remember-cache.json')
        ]);
      });

      it('should write files to dest', (done) => {
        gulp.src(`${__dirname}/fixtures/**/*`)
          .pipe(remember())
          .pipe(assert.length(2))
          .pipe(assert.end(done))
      });
    });
  });
});
