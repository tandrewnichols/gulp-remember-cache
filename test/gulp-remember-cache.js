const assert = require('stream-assert');
const gulp = require('gulp');
const header = require('./helpers/header');
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
const concat = require('gulp-concat');
const sourcemaps = require('gulp-sourcemaps');
const async = require('async');
const through = require('through2');

const utf8 = { encoding: 'utf8' };

describe('gulp-remember-cache', () => {
  const remember = require('../lib/gulp-remember-cache');

  // Some helper methods
  const cleanup = () => Object.keys(remember.cache).forEach((k) => delete remember.cache[k]);
  const getManifest = () => JSON.parse(fs.readFileSync(`${root}/.gulp-remember-cache.json`));
  const tryRead = (file) => {
    try {
      fs.readFileSync(file, utf8);
      return null;
    } catch (e) {
      return e;
    }
  };

  afterEach((done) => {
    cache.clear();
    remember.resetAll(() => {
      async.each([`${root}/.gulp-remember-cache.json`, `${root}/.gulp-cache`], fs.remove, () => done());
    });
  })

  describe('remember()', () => {
    context('on the first pass', () => {
      context('using the library defaults', () => {
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

      beforeEach((done) => {
        run(2).pipe(assert.end(done));
      });

      beforeEach((done) => {
        cleanup();
        touch(`${__dirname}/fixtures/apple.js`, () => {
          run(1).pipe(assert.end(done));
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
      it('should preserve the order of the files', (done) => {
        let run = () => {
          return gulp.src(`${__dirname}/fixtures/**/*.js`)
            .pipe(cache.filter())
            .pipe(header(';(function() { '))
            .pipe(footer(' })();'))
            .pipe(ext('.js'))
            .pipe(cache.cache())
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
      let run = (f) => {
        return gulp.src(`${__dirname}/fixtures/**/*.ts`)
          .pipe(cache.filter())
          .pipe(header(';(function() { '))
          .pipe(footer(f))
          .pipe(ext('.js'))
          .pipe(cache.cache())
          .pipe(remember({ originalExtension: '.ts' }))
          .pipe(assert.length(1));
      };

      beforeEach((done) => {
        run(' })();').pipe(assert.end(done));
      })

      beforeEach((done) => {
        cleanup();
        touch(`${__dirname}/fixtures/kiwi.ts`, () => {
          run(' })(undefined);').pipe(assert.end(done));
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

      afterEach(() => {
        return fs.outputFile(`${__dirname}/fixtures/kiwi.ts`, kiwi, utf8);
      })

      beforeEach(() => {
        kiwi = fs.readFileSync(`${__dirname}/fixtures/kiwi.ts`, utf8);
      })

      let run = (count) => {
        return gulp.src(`${__dirname}/fixtures/**/*.ts`)
          .pipe(cache.filter())
          .pipe(header(';(function() { '))
          .pipe(footer(' })();'))
          .pipe(ext('.js'))
          .pipe(cache.cache())
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
      beforeEach((done) => {
        gulp.src(`${__dirname}/fixtures/**/*.js`, { read: false })
          .pipe(remember())
          .pipe(assert.length(2))
          .pipe(assert.end(done));
      })

      it('should pass the files on without doing anything', () => {
        let manifest = getManifest();
        manifest.cache.should.eql({ dest: `${root}/out` });

        tryRead(`${root}/out/apple.js`).message.should.match(/ENOENT/);
        tryRead(`${root}/out/banana.js`).message.should.match(/ENOENT/);
      })
    })

    context('with sourcemaps', () => {
      afterEach(() => {
        return fs.remove(`${__dirname}/dest/`);
      })

      let run = (count) => {
        return gulp.src(`${__dirname}/fixtures/**/*.js`)
          .pipe(cache.filter())
          .pipe(sourcemaps.init())
          .pipe(cache.cache())
          .pipe(remember())
          .pipe(assert.first((file) => {
            return file.sourceMap.sources === ['apple.js'];
          }))
          .pipe(assert.second((file) => {
            return file.sourceMap.sources === ['banana.js'];
          }))
          .pipe(concat('fruits.js'))
          .pipe(sourcemaps.write('./'))
          .pipe(gulp.dest('test/dest/'))
      };

      beforeEach((done) => {
        run().pipe(assert.end(done));
      })

      beforeEach((done) => {
        cleanup();
        touch(`${__dirname}/fixtures/apple.js`, () => {
          run().pipe(assert.end(done));
        });
      })

      it('should correctly write sourcemaps', () => {
        let fruits = fs.readFileSync(`${__dirname}/dest/fruits.js`, utf8);
        fruits.should.match(/sourceMappingURL=fruits\.js\.map/);

        let map = JSON.parse(fs.readFileSync(`${__dirname}/dest/fruits.js.map`, utf8));
        map.sources.should.eql(['apple.js', 'banana.js']);
      })
    })

    context('with a file stream', () => {
      it('should throw an error', (done) => {
        gulp.src(`${__dirname}/fixtures/**/*.js`, { buffer: false })
          .pipe(remember())
          .on('error', (e) => {
            e.plugin.should.eql('gulp-remember-cache');
            e.message.should.eql('Stream content is not supported');
            done();
          })
      })
    })
  })

  describe('remember.forget()', () => {
    context('with the default cacheName', () => {
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
