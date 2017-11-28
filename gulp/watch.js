var gulp = require('gulp');
var config = require('./config');

gulp.task('watch', function() {
  gulp.watch([...config.lib, ...config.tests], gulp.series('lint', 'mocha'));
});

gulp.task('watch:test', function() {
  gulp.watch([...config.lib, ...config.tests], gulp.series('test'));
});
