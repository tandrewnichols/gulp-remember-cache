const gulp = require('gulp');
const codeclimate = require('gulp-codeclimate-reporter');

gulp.task('codeclimate', function() {
  if (process.version.indexOf('v8') > -1) {
    return gulp.src('coverage/lcov.info', { read: false })
      .pipe(codeclimate({
        token: 'e7d897b341e458ed1c6fde47d4c1f314a237d9f83d7fa990dff7ba1c14147cea'
      }));
  }
});

