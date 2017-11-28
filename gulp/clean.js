const gulp = require('gulp');
const rimraf = require('rimraf');

gulp.task('clean', function(cb) {
  rimraf('./coverage', cb);
});

