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
const merge = require('merge2');
const ext = require('gulp-ext-replace');

const utf8 = { encoding: 'utf8' };

describe('gulp-remember-cache', () => {
  const remember = require('../lib/gulp-remember-cache');

  const getManifest = () => JSON.parse(fs.readFileSync(`${root}/.gulp-remember-cache.json`));

  const tryRead = (file) => {
    try {
      fs.readFileSync(file, utf8);
      return null;
    } catch (e) {
      return e;
    }
  };

  describe('remember()', () => {
    context('on the first pass', () => {
      context('using the library defaults', () => {
        afterEach((done) => {
          fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
            remember.resetAll(done);
          });
        })

        beforeEach((done) => {
          gulp.src(`${__dirname}/fixtures/**/*.js`)
            .pipe(header(';(function() { '))
            .pipe(footer(' })();'))
            .pipe(remember())
            .pipe(assert.length(2))
            .pipe(assert.end(done));
        })

        it('should write files to dest', () => {
          let manifest = getManifest();
          let apple = fs.readFileSync(`${root}/out/apple.js`, utf8);
          let banana = fs.readFileSync(`${root}/out/banana.js`, utf8);

          apple.should.eql(';(function() { let apple;\n })();');
          banana.should.eql(';(function() { let banana;\n })();');
          manifest.cache['apple.js'].should.eql({
            cache: `${root}/out/apple.js`,
            orig: path.resolve('test/fixtures/apple.js')
          });
          manifest.cache['banana.js'].should.eql({
            cache: `${root}/out/banana.js`,
            orig: path.resolve('test/fixtures/banana.js')
          });
        })
      })

      context('passing in options', () => {
        afterEach((done) => {
          fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
            remember.resetAll(done);
          });
        })

        beforeEach((done) => {
          gulp.src(`${__dirname}/fixtures/**/*.js`)
            .pipe(header(';(function() { '))
            .pipe(footer(' })();'))
            .pipe(remember({ dest: 'test/out/', cacheName: 'fruits' }))
            .pipe(assert.length(2))
            .pipe(assert.end(done));
        })

        it('should write files to dest', () => {
          let manifest = getManifest();
          let apple = fs.readFileSync('./test/out/apple.js', utf8);
          let banana = fs.readFileSync('./test/out/banana.js', utf8);

          apple.should.eql(';(function() { let apple;\n })();');
          banana.should.eql(';(function() { let banana;\n })();');
          manifest.fruits['apple.js'].should.eql({
            cache: path.resolve('test/out/apple.js'),
            orig: path.resolve('test/fixtures/apple.js')
          });
          manifest.fruits['banana.js'].should.eql({
            cache: path.resolve('test/out/banana.js'),
            orig: path.resolve('test/fixtures/banana.js')
          });
        })
      })
    })

    context('on second passes', () => {
      afterEach((done) => {
        Promise.all([
          fs.remove(`${root}/.gulp-remember-cache.json`),
          fs.remove('./.gulp-cache')
        ]).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        let run = (count) => {
          return gulp.src(`${__dirname}/fixtures/**/*.js`, { read: false })
            .pipe(cache.filter())
            .pipe(assert.length(count))
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
      })

      it('should write files to dest', () => {
        let manifest = getManifest();
        let apple = fs.readFileSync('./test/out/apple.js', utf8);
        let banana = fs.readFileSync('./test/out/banana.js', utf8);

        apple.should.eql(';(function() { let apple;\n })();');
        banana.should.eql(';(function() { let banana;\n })();');
        manifest.fruits['apple.js'].should.eql({
          cache: path.resolve('test/out/apple.js'),
          orig: path.resolve('test/fixtures/apple.js')
        });
        manifest.fruits['banana.js'].should.eql({
          cache: path.resolve('test/out/banana.js'),
          orig: path.resolve('test/fixtures/banana.js')
        });
      })
    })

    context('with preserveOrder', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      it('should preserve the order of the files', (done) => {
        let run = () => {
          return gulp.src(`${__dirname}/fixtures/**/*.js`)
            .pipe(header(';(function() { '))
            .pipe(footer(' })();'))
            .pipe(ext('.js'))
            .pipe(remember({ preserveOrder: true }))
            .pipe(assert.length(2));
        };

        let stream = run();
        touch(`${__dirname}/fixtures/apple.js`, () => {
          stream.resume();
          stream.on('end', () => {
            stream = run()
              .pipe(assert.first((file) => file.relative === 'apple.js'))
              .pipe(assert.second((file) => file.relative === 'banana.js'))

            touch(`${__dirname}/fixtures/banana.js`, () => {
              stream.resume();
              stream.on('end', () => {
                run()
                  .pipe(assert.first((file) => file.relative === 'apple.js'))
                  .pipe(assert.second((file) => file.relative === 'banana.js'))
                  .pipe(assert.end(done))
              });
            });
          });
        });
      })
    })

    context('preserving original extension', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        let run = (f) => {
          return gulp.src(`${__dirname}/fixtures/**/*.ts`)
            .pipe(header(';(function() { '))
            .pipe(footer(f))
            .pipe(ext('.js'))
            .pipe(remember({ originalExtension: '.ts' }))
            .pipe(assert.length(1));
        };

        let stream = run(' })();');
        touch(`${__dirname}/fixtures/kiwi.ts`, () => {
          stream.resume();
          stream.on('end', () => {
            run(' })(undefined);').pipe(assert.end(done));
          });
        });
      })

      it('should write files to dest', () => {
        let manifest = getManifest();
        let kiwi = fs.readFileSync(`${root}/out/kiwi.js`, utf8);

        kiwi.should.eql(';(function() { let kiwi;\n })(undefined);');
        manifest.cache['kiwi.ts'].should.eql({
          cache: path.resolve(`${root}/out/kiwi.js`),
          orig: path.resolve('test/fixtures/kiwi.ts')
        });
      })
    })

    context('when the file is deleted', () => {
      let kiwi;

      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(() => {
            fs.outputFile(`${__dirname}/fixtures/kiwi.ts`, kiwi, utf8, () => done());
          })
        });
      })

      beforeEach(() => {
        kiwi = fs.readFileSync(`${__dirname}/fixtures/kiwi.ts`, utf8);
      })

      const run = (count) => {
        return gulp.src(`${__dirname}/fixtures/**/*.ts`)
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(ext('.js'))
          .pipe(remember({ originalExtension: '.ts' }))
          .pipe(assert.length(count))
      };

      beforeEach((done) => {
        run(1).pipe(assert.end(done));
      })

      beforeEach((done) => {
        fs.remove(`${__dirname}/fixtures/kiwi.ts`, () => {
          run(0).pipe(assert.end(done));
        });
      })

      it('should clean up the deleted file', () => {
        let manifest = getManifest();

        tryRead(`${__dirname}/fixtures/kiwi.ts`).message.should.match(/ENOENT/);
        tryRead(`${root}/out/kiwi.js`).message.should.match(/ENOENT/);

        (manifest.cache['kiwi.ts'] === undefined).should.be.true()
      })
    })

    context('when the file has no contents', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        gulp.src(`${__dirname}/fixtures/**/*.js`, { read: false })
          .pipe(remember())
          .pipe(assert.length(2))
          .pipe(assert.end(done));
      })

      it('should pass the files on without doing anything', () => {
        let manifest = getManifest();
        manifest.cache.should.eql({
          dest: `${root}/out`,
          'banana.js': {
            cache: `${root}/out/banana.js`,
            orig: path.resolve('test/fixtures/banana.js')
          },
         'apple.js': {
            cache: `${root}/out/apple.js`,
            orig: path.resolve('test/fixtures/apple.js')
          }
        });

        tryRead(`${root}/out/apple.js`).message.should.match(/ENOENT/);
        tryRead(`${root}/out/banana.js`).message.should.match(/ENOENT/);
      })
    })
  })

  describe('remember.forget()', () => {
    context('with the default cacheName', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        gulp.src(`${__dirname}/fixtures/**/*.js`)
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(remember())
          .pipe(assert.end(done));
      })

      beforeEach((done) => {
        remember.forget('apple.js', done);
      })

      it('should remove the file from the manifest', () => {
        let manifest = getManifest();
        (manifest.cache['apple.js'] === undefined).should.be.true();
      })

      it('should remove the file from disk', () => {
        tryRead(`${root}/out/apple.js`).message.should.match(/ENOENT/);
      })
    })

    context('with a named cache', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        gulp.src(`${__dirname}/fixtures/**/*.js`)
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(remember({ cacheName: 'fruits' }))
          .pipe(assert.end(done));
      })

      beforeEach((done) => {
        remember.forget('fruits', 'apple.js', done);
      })

      it('should remove the file from the manifest', () => {
        let manifest = getManifest();
        (manifest.fruits['apple.js'] === undefined).should.be.true();
      })

      it('should remove the file from disk', () => {
        tryRead(`${root}/out/apple.js`).message.should.match(/ENOENT/);
      })
    })

    context('with a named cache that does not exist', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        gulp.src(`${__dirname}/fixtures/**/*.js`)
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(remember({ cacheName: 'fruits' }))
          .pipe(assert.end(done));
      })

      beforeEach((done) => {
        remember.forget('fruit', 'apple.js', done);
      })

      it('should call done immediately', () => {
        let manifest = getManifest();
        manifest.should.eql({
          fruits: {
            dest: `${root}/out`,
            'apple.js': {
              cache: `${root}/out/apple.js`,
              orig: path.resolve('test/fixtures/apple.js')
            },
            'banana.js': {
              cache: `${root}/out/banana.js`,
              orig: path.resolve('test/fixtures/banana.js')
            }
          }
        });
      })
    })

    context('with a different extension', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        gulp.src(`${__dirname}/fixtures/**/*.ts`)
          .pipe(ext('.js'))
          .pipe(remember({ originalExtension: '.ts' }))
          .pipe(assert.end(done));
      })

      beforeEach((done) => {
        remember.forget('kiwi.ts', done);
      })

      it('should remove the file from the manifest', () => {
        let manifest = getManifest();
        (manifest.cache['kiwi.ts'] === undefined).should.be.true();
      })

      it('should remove the file from disk', () => {
        tryRead(`${root}/out/kiwi.js`).message.should.match(/ENOENT/);
      })
    })
  })

  describe('remember.reset()', () => {
    context('with the default cache', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        gulp.src(`${__dirname}/fixtures/**/*.js`)
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(remember())
          .pipe(assert.end(done));
      })

      beforeEach((done) => {
        remember.reset(done);
      })

      it('should remove the cache from the manifest', () => {
        let manifest = getManifest();
        manifest.should.eql({});
      })

      it('should remove the files in the cache from disk', () => {
        tryRead(`${root}/out/`).message.should.match(/ENOENT/);
      })
    })

    context('with a named cache', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        gulp.src(`${__dirname}/fixtures/**/*.js`)
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(remember({ cacheName: 'fruits' }))
          .pipe(assert.end(done));
      })

      beforeEach((done) => {
        remember.reset('fruits', done);
      })

      it('should remove the cache from the manifest', () => {
        let manifest = getManifest();
        manifest.should.eql({});
      })

      it('should remove the files in the cache from disk', () => {
        tryRead(`${root}/out/`).message.should.match(/ENOENT/);
      })
    })

    context('with a named cache that does not exist', () => {
      afterEach((done) => {
        fs.remove(`${root}/.gulp-remember-cache.json`).then(() => {
          remember.resetAll(done);
        });
      })

      beforeEach((done) => {
        gulp.src(`${__dirname}/fixtures/**/*.js`)
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(remember({ cacheName: 'fruits' }))
          .pipe(assert.end(done));
      })

      beforeEach((done) => {
        remember.reset('fruit', done);
      })

      it('should call done immediately', () => {
        let manifest = getManifest();
        manifest.should.eql({
          fruits: {
            dest: `${root}/out`,
            'apple.js': {
              cache: `${root}/out/apple.js`,
              orig: path.resolve('test/fixtures/apple.js')
            },
            'banana.js': {
              cache: `${root}/out/banana.js`,
              orig: path.resolve('test/fixtures/banana.js')
            }
          }
        });
      })
    })
  })

  describe('remember.resetAll()', () => {
    afterEach(() => {
      return fs.remove(`${root}/.gulp-remember-cache.json`);
    })

    beforeEach((done) => {
      merge(
        gulp.src(`${__dirname}/fixtures/**/*.js`)
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(remember({ cacheName: 'fruits', dest: `${root}/fruits/` })),
        gulp.src(`${__dirname}/fixtures/**/*.js`)
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(remember({ cacheName: 'vegetables', dest: `${root}/vegetables/` }))
      ).pipe(assert.end(done));
    })

    beforeEach((done) => {
      remember.resetAll(done);
    })

    it('should remove the cache from the manifest', () => {
      let manifest = getManifest();
      manifest.should.eql({});
    })

    it('should remove the files in the cache from disk', () => {
      tryRead(`${root}/fruits/`).message.should.match(/ENOENT/);
      tryRead(`${root}/vegetables/`).message.should.match(/ENOENT/);
    })
  })
})
