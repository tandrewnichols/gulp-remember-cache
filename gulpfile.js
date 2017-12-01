var gulp = require('gulp');
require('file-manifest').generate('./gulp', { match: '*.js' });

gulp.task('travis', gulp.series(gulp.parallel('lint', 'cover'), 'codeclimate'));
gulp.task('default', gulp.series('lint', 'mocha'));
