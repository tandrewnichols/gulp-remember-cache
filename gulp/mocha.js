const gulp = require('gulp');
const config = require('./config');
const mocha = require('gulp-mocha');
const execa = require('execa');

gulp.task('mocha', () => {
  return gulp.src(config.tests, { read: false })
    .pipe(mocha({
      reporter: 'list',
      timeout: 4000,
      require: ['should']
    }));
});

gulp.task('cover', (done) => {
  execa('nyc',
    ['--reporter=lcov', '--reporter=html', '--reporter=text', 'mocha', 'test/**/*.js', '--colors', '--require=should', '--reporter=list', '--timeout=4000'],
    { stdio: 'inherit' }
  )
    .then(() => done())
    .catch((e) => {
      console.log(e);
      done();
    });
});
