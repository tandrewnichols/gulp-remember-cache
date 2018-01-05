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

const stripExt = file => file.replace(path.extname(file), '');

const remember = (config = {}) => {
  let { dest, cacheName } = Object.assign({}, defaults, config);
  manifest[cacheName] = manifest[cacheName] || {};
  let cache = manifest[cacheName];
  cache.dest = dest;
  let seen = {};

  const transform = function(file, enc, callback) {
    let ext = config.originalExtension;

    let relative = ext ? stripExt(file.relative) + ext : file.relative;
    seen[relative] = true;

    let orig = ext ? stripExt(file.path) + ext : file.path;
    cache[relative] = cache[relative] || { orig, cache: path.resolve(`${dest}/${file.relative}`) };

    if (!file.isNull()) {
      fs.outputFile(cache[relative].cache, file.contents, encoding, (e) => callback(e, file));
    } else {
      callback(null, file);
    }
  };

  const flush = function(cb) {
    let method = config.preserveOrder ? 'eachOfSeries' : 'eachOf';
    async[ method ](cache, (fileobj, key, next) => {
      if (key === 'dest' || seen[key]) {
        return next();
      }

      if (fs.existsSync(fileobj.orig)) {
        fs.readFile(fileobj.cache, (err, contents) => {
          // If something goes wrong and it's not that the cache
          // file doesn't exist yet, callback.
          if (err && err.code !== missing) {
            return next(err);
          }

          let file = new gutil.File({ contents, path: fileobj.cache });
          this.push(file);
          next();
        });
      } else {
        delete cache[key];
        fs.remove(fileobj.cache, next);
      }
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

  if (!manifest[cacheName]) {
    done();
  }

  let pathname = manifest[cacheName][file].cache;
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
    done();
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
