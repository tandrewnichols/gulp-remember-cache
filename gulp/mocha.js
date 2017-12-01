const gulp = require('gulp');
const config = require('./config');
const mocha = require('gulp-mocha');
const execa = require('execa');

gulp.task('mocha', () => {
  return gulp.src(config.tests, { read: false })
    .pipe(mocha({
      reporter: 'list',
      require: ['should']
    }));
});

gulp.task('cover', (done) => {
  execa('nyc',
    ['--reporter=lcov', '--reporter=html', '--reporter=text', 'mocha', 'test/**/*.js', '--colors', '--require=should', '--reporter=list'],
    { stdio: 'inherit' }
  ).then(() => done());
});
