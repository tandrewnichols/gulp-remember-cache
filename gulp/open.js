const gulp = require('gulp');
const open = require('opn');

gulp.task('open', function() {
  return open('./coverage/lcov-report/index.html');
});

