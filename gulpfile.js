var gulp = require('gulp');
require('file-manifest').generate('./gulp', { match: '*.js' });

gulp.task('cover', gulp.series('clean', 'instrument', 'mocha:cover'));
gulp.task('travis', gulp.series(gulp.parallel('lint', 'cover'), 'codeclimate'));
gulp.task('default', gulp.series('lint', 'mocha'));
