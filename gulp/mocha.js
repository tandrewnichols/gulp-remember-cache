const gulp = require('gulp');
const config = require('./config');
const mocha = require('gulp-mocha');
const istanbul = require('gulp-istanbul');

const runTests = (withCoverage) => {
  return () => {
    let stream = gulp.src(config.tests, { read: false })
      .pipe(mocha({
        reporter: 'dot',
        require: ['should']
      }));

    if (withCoverage) {
      return stream.pipe(istanbul.writeReports());
    } else {
      return stream;
    }
  };
};

gulp.task('mocha', runTests());
gulp.task('mocha:cover', runTests(true));
