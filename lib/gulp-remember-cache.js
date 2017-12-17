const gutil = require('gulp-util');
const through = require('through2');
const fs = require('fs-extra');
const path = require('path');
const async = require('async');

const encoding = { encoding: 'utf8' };
const cacheFile = path.resolve(__dirname, '../.gulp-remember-cache.json');
const missing = 'ENOENT';
const pretty = 2;
const defaults = { dest: path.resolve(__dirname, '../out/'), cacheName: 'cache' };

let manifest = {};

try {
  manifest = require(cacheFile);
} catch (err) {
  // Ignore error . . . manifest is already set above
}

const remember = (config = {}) => {
  let { dest, cacheName } = Object.assign({}, defaults, config);
  manifest[cacheName] = manifest[cacheName] || {};
  let cache = manifest[cacheName];
  cache.dest = dest;
  let seen = {};

  const transform = function(file, enc, callback) {
    seen[file.relative] = true;
    cache[file.relative] = cache[file.relative] || path.resolve(`${dest}/${file.relative}`);

    if (!file.isNull()) {
      fs.outputFile(cache[file.relative], file.contents, encoding, (e) => callback(e, file));
    } else {
      callback(null, file);
    }
  };

  const flush = function(cb) {
    let method = config.preserveOrder ? 'eachOfSeries' : 'eachOf';
    async[ method ](cache, (filename, key, next) => {
      if (key === 'dest' || seen[key]) {
        return next();
      }

      fs.readFile(filename, (err, contents) => {
        // If something goes wrong and it's not that the cache
        // file doesn't exist yet, callback.
        if (err && err.code !== missing) {
          return next(err);
        }

        if (contents) {
          let file = new gutil.File({ contents, path: filename });
          this.push(file);
        }

        next();
      });
    }, () => {
      fs.outputFile(cacheFile, JSON.stringify(manifest, null, pretty), encoding, () => cb());
    });
  };

  return through.obj(transform, flush);
};

remember.forget = (cacheName, file, done) => {
  if (!done) {
    done = file;
    file = cacheName;
    cacheName = defaults.cacheName;
  }

  let pathname = manifest[cacheName][file];
  delete manifest[cacheName][file];
  async.parallel([
    next => fs.remove(pathname, next),
    next => fs.outputFile(cacheFile, JSON.stringify(manifest, null, pretty), encoding, next)
  ], done);
};

remember.reset = (cacheName, done) => {
  if (typeof cacheName === 'function') {
    done = cacheName;
    cacheName = defaults.cacheName;
  }

  if (!manifest[cacheName]) {
    return;
  }

  let dest = manifest[cacheName].dest;
  delete manifest[cacheName];

  async.parallel([
    next => fs.remove(dest, next),
    next => fs.outputFile(cacheFile, JSON.stringify(manifest, null, pretty), encoding, next)
  ], done);
};

remember.resetAll = (done) => {
  async.eachOf(manifest, (val, key, next) => {
    let dest = manifest[key].dest;
    delete manifest[key];
    fs.remove(dest, next);
  }, (err) => {
    if (err) {
      done(err);
    } else {
      fs.outputFile(cacheFile, JSON.stringify(manifest, null, pretty), encoding, done);
    }
  });
};

remember.manifest = manifest;

module.exports = remember;
