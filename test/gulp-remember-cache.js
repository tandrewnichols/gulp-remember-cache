const assert = require('stream-assert');
const gulp = require('gulp');
const header = require('gulp-header');
const footer = require('gulp-footer');
const fs = require('fs-extra');
const path = require('path');
const root = path.resolve(__dirname, '..');
const FileCache = require('gulp-file-cache');
const cache = new FileCache()
const read = require('gulp-read');
const touch = require('touch');

describe('gulp-remember-cache', () => {
  const remember = require('../lib/gulp-remember-cache');

  const getManifest = () => JSON.parse(fs.readFileSync(`${root}/.gulp-remember-cache.json`));

  describe('remember()', () => {
    context('on the first pass', () => {
      context('using the library defaults', () => {
        afterEach(() => {
          remember.resetAll();
          return Promise.all([
            fs.remove(`${root}/out`),
            fs.remove(`${root}/.gulp-remember-cache.json`)
          ]);
        });

        beforeEach(function(done) {
          gulp.src(`${__dirname}/fixtures/**/*`)
            .pipe(header(';(function() { '))
            .pipe(footer(' })();'))
            .pipe(remember())
            .pipe(assert.length(2))
            .pipe(assert.end(done));
        });

        it('should write files to dest', () => {
          let manifest = getManifest();
          let apple = fs.readFileSync(`${root}/out/apple.js`, { encoding: 'utf8' });
          let banana = fs.readFileSync(`${root}/out/banana.js`, { encoding: 'utf8' });

          apple.should.eql(';(function() { let apple;\n })();');
          banana.should.eql(';(function() { let banana;\n })();');
          manifest.cache['apple.js'].should.eql(`${root}/out/apple.js`);
          manifest.cache['banana.js'].should.eql(`${root}/out/banana.js`);
        });
      });

      context('passing in options', () => {
        afterEach(() => {
          remember.resetAll();
          return Promise.all([
            fs.remove('./test/out'),
            fs.remove(`${root}/.gulp-remember-cache.json`)
          ]);
        });

        beforeEach(function(done) {
          gulp.src(`${__dirname}/fixtures/**/*`)
            .pipe(header(';(function() { '))
            .pipe(footer(' })();'))
            .pipe(remember({ dest: 'test/out/', cacheName: 'fruits' }))
            .pipe(assert.length(2))
            .pipe(assert.end(done));
        });

        it('should write files to dest', () => {
          let manifest = getManifest();
          let apple = fs.readFileSync('./test/out/apple.js', { encoding: 'utf8' });
          let banana = fs.readFileSync('./test/out/banana.js', { encoding: 'utf8' });

          apple.should.eql(';(function() { let apple;\n })();');
          banana.should.eql(';(function() { let banana;\n })();');
          manifest.fruits['apple.js'].should.eql(path.resolve('test/out/apple.js'));
          manifest.fruits['banana.js'].should.eql(path.resolve('test/out/banana.js'));
        });
      });
    });

    context('on second passes', () => {
      afterEach(() => {
        remember.resetAll();
        return Promise.all([
          fs.remove('./test/out'),
          fs.remove(`${root}/.gulp-remember-cache.json`),
          fs.remove('./.gulp-cache')
        ]);
      });

      beforeEach(function(done) {
        let run = (expectedFiles) => {
          return gulp.src(`${__dirname}/fixtures/**/*`, { read: false })
            .pipe(cache.filter())
            .pipe(assert.length(expectedFiles))
            .pipe(read())
            .pipe(header(';(function() { '))
            .pipe(footer(' })();'))
            .pipe(cache.cache())
            .pipe(remember({ dest: 'test/out/', cacheName: 'fruits' }))
            .pipe(assert.length(2))
            .pipe(assert.second((file) => {
              file.contents.toString().should.eql(';(function() { let banana;\n })();');
            }));
        };
        let stream = run(2);
        touch(`${__dirname}/fixtures/apple.js`, () => {
          stream.resume();
          stream.on('end', () => {
            run(1).pipe(assert.end(done));
          });
        });
      });

      it('should write files to dest', () => {
        let manifest = getManifest();
        let apple = fs.readFileSync('./test/out/apple.js', { encoding: 'utf8' });
        let banana = fs.readFileSync('./test/out/banana.js', { encoding: 'utf8' });

        apple.should.eql(';(function() { let apple;\n })();');
        banana.should.eql(';(function() { let banana;\n })();');
        manifest.fruits['apple.js'].should.eql(path.resolve('test/out/apple.js'));
        manifest.fruits['banana.js'].should.eql(path.resolve('test/out/banana.js'));
      });
    })
  });
});
