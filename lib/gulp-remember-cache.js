const Vinyl = require('vinyl');
const PluginError = require('plugin-error');
const through = require('through2');
const fs = require('fs-extra');
const path = require('path');
const async = require('async');
const chalk = require('chalk');
const log = require('fancy-log');

const encoding = { encoding: 'utf8' };
const cacheFile = path.resolve(__dirname, '../.gulp-remember-cache.json');
const pretty = 2;
const defaults = { dest: path.resolve(__dirname, '../out/'), cacheName: 'cache' };

let manifest = {};
let memory = {};

try {
  manifest = require(cacheFile);
} catch (err) {
  // Ignore error . . . manifest is already set above
}

const stripExt = file => file.replace(path.extname(file), '');
const deprecate = (thing, ...msg) => log(`${chalk.cyan('gulp-remember-cache')}:`, chalk.red(thing), 'is deprecated.', ...msg);

const remember = (config = {}) => {
  let { dest, cacheName } = Object.assign({}, defaults, config);
  manifest[cacheName] = manifest[cacheName] || {};
  memory[cacheName] = memory[cacheName] || {};
  let cache = manifest[cacheName];
  cache.dest = dest;

  let mem = memory[cacheName];
  let streamHas = {};

  const cleanup = (fileobj, key, next) => {
    delete cache[key];
    delete mem[key];
    fs.remove(fileobj.cache, next);
  };

  if (config.preserveOrder) {
    deprecate('options.preserveOrder', 'Use', chalk.green('gulp-order'), 'after gulp-remember-cache instead.');
  }

  const transform = function(file, enc, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }

    if (file.isStream()) {
      return callback(new PluginError('gulp-remember-cache', 'Stream content is not supported'));
    }

    let ext = config.originalExtension;

    let relative = ext ? stripExt(file.relative) + ext : file.relative;
    streamHas[relative] = true;
    mem[relative] = file.clone();

    let orig = ext ? stripExt(file.path) + ext : file.path;
    cache[relative] = cache[relative] || { orig, cache: path.resolve(`${dest}/${file.relative}`) };

    if (config.generated) {
      cache[relative].generated = true;
    }

    let files = [{ name: cache[relative].cache, contents: file.contents }];

    if (file.sourceMap) {
      cache[relative].map = true;
      files.push({ name: `${cache[relative].cache}.map`, contents: JSON.stringify(file.sourceMap) });
    }

    async.each(files, (f, next) => {
      fs.outputFile(f.name, f.contents, encoding, next);
    }, (e) => callback(e, file));
  };

  const flush = function(cb) {
    let method = config.preserveOrder ? 'eachOfSeries' : 'eachOf';
    async[ method ](cache, (fileobj, key, next) => {
      if (key === 'dest') {
        return next();
      }

      if (!fs.existsSync(fileobj.orig) && !config.generated) {
        return cleanup(fileobj, key, next);
      } else if (streamHas[key]) {
        return next();
      } else if (mem[key]) {
        this.push(mem[key].clone());
        return next();
      }

      fs.readFile(fileobj.cache, (err, contents) => {
        if (err) {
          return next(err);
        }

        let file = new Vinyl({ contents, path: fileobj.cache });
        let done = () => {
          this.push(file);
          mem[key] = file.clone();
          next();
        };

        if (fileobj.map) {
          fs.readFile(`${fileobj.cache}.map`, (err, map) => {
            if (!err && map) {
              file.sourceMap = JSON.parse(map);
            }
            done();
          });
        } else {
          done();
        }
      });
    }, () => {
      streamHas = {};
      fs.outputFile(cacheFile, JSON.stringify(manifest, null, pretty), encoding, () => cb());
    });
  };

  return through.obj(transform, flush);
};

const removeFromManifest = (pathname, done) => {
  async.parallel([
    next => fs.remove(pathname, next),
    next => fs.outputFile(cacheFile, JSON.stringify(manifest, null, pretty), encoding, next)
  ], () => done());
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
  delete memory[cacheName][file];
  removeFromManifest(pathname, done);
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
  delete memory[cacheName];

  removeFromManifest(dest, done);
};

remember.resetAll = (done) => {
  async.eachOf(manifest, (val, key, next) => {
    let dest = manifest[key].dest;
    delete manifest[key];
    delete memory[key];
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
remember.cache = memory;

module.exports = remember;
