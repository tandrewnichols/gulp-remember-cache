const gutil = require('gulp-util');
const through = require('through2');
const fs = require('fs-extra');
const path = require('path');
const async = require('async');

const encoding = { encoding: 'utf8' };
const cacheFile = '.gulp-remember-cache.json';
const missing = 'ENOENT';
const pretty = 2;
const defaults = { dest: __dirname, cacheName: 'cache' };

let manifest = {};

try {
  manifest = require(path.resolve(cacheFile));
} catch (err) {
  // Ignore error . . . manifest is already set above
}

const remember = ({ dest, cacheName } = defaults) => {
  manifest[cacheName] = manifest[cacheName] || {};
  let cache = manifest[cacheName];
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
    async.eachOf(cache, (filename, key, next) => {
      if (seen[key]) {
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

remember.forget = (cacheName, file) => {
  if (!cacheName || !file) {
    return;
  }

  delete manifest[cacheName][file];
  fs.outputFileSync(cacheFile, JSON.stringify(manifest, null, pretty), encoding);
};

remember.reset = (cacheName = defaults.cacheName) => {
  delete manifest[cacheName];
  fs.outputFileSync(cacheFile, JSON.stringify(manifest, null, pretty), encoding);
};

remember.resetAll = () => {
  for (let key in manifest) {
    delete manifest[key];
  }
  fs.outputFileSync(cacheFile, JSON.stringify(manifest, null, pretty), encoding);
};

remember.manifest = manifest;

module.exports = remember;
