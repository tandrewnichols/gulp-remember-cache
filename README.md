[![Build Status](https://travis-ci.org/tandrewnichols/gulp-remember-cache.png)](https://travis-ci.org/tandrewnichols/gulp-remember-cache) [![downloads](http://img.shields.io/npm/dm/gulp-remember-cache.svg)](https://npmjs.org/package/gulp-remember-cache) [![npm](http://img.shields.io/npm/v/gulp-remember-cache.svg)](https://npmjs.org/package/gulp-remember-cache) [![Maintainability](https://api.codeclimate.com/v1/badges/d18a80a39ce82ea10bbd/maintainability)](https://codeclimate.com/github/tandrewnichols/gulp-remember-cache/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/d18a80a39ce82ea10bbd/test_coverage)](https://codeclimate.com/github/tandrewnichols/gulp-remember-cache/test_coverage) [![dependencies](https://david-dm.org/tandrewnichols/gulp-remember-cache.png)](https://david-dm.org/tandrewnichols/gulp-remember-cache)

# gulp-remember-cache

A gulp-remember for on disk caching.

## Installation

`npm install --save gulp-remember-cache`

## Summary

I love the combination of `gulp-cached` and `gulp-remember`. These both use in-memory caching to speed up builds, but that means when you Ctrl-C your gulp process, you lose that cache, and the next time you start up gulp again, you have to pay the full cost of the build, even if some of your files haven't changed. There's a `gulp-file-cache` that does on-disk caching, but there's no analog to `gulp-remember` in that scenario, so I wrote this to fill that gap. You can pair it with `gulp-file-cache` the same way you can pair `gulp-cached` and `gulp-remember`. It also pairs well with `gulp-read` so you can skip the initial read, then read and process _only_ new/changed files, then pull in previously processed files without needing to recompile them.

## Usage

```javascript
const remember = require('gulp-remember-cache');
const gulp = require('gulp');

// Use deafults
gulp.src(['files/**']).pipe(remember());

// Or provide your own configuration
gulp.src(['files/**']).pipe(remember({ dest: 'out/', cacheName: 'scripts' }));
```

## API

### remember([options])

Remember the files in the current stream.

#### options.dest

In order to make disk caching work, `gulp-remember-cache` has to output the files it sees to an intermediate directory. The default is an `out/` directory in the root of the `gulp-remember-cache` module (e.g. `node_modules/gulp-remember-cache/out/`), but you can configure this with the `dest` option. Note that this is treated relative to `cwd` (the default for `fs.writeFile`).

#### options.cacheName

The name of the cache to write files to (default: "cache").

#### options.preserveOrder

If the order of the files in the stream is important, you can pass `preserveOrder: true` to `remember`. Without this flag, the order of the files added to the stream largely depends on how long it takes to read them from disk, as they happen in parallel. With this flag, file order is _more_ reliable. I won't say guaranted because the order of keys in an object is theoretically not guaranteed (even though they're often predictable). This flag simply uses `async.eachOfSeries` instead of `async.eachOf`, so each key will be read from the cache and processed completely before the next key. Which does, at least, take _some_ of the uncertainty out of it.

### remember.forget([cacheName], file, done)

Remove a file from a cache and delete the temporary file from disk.

#### cacheName

The cache in which the file is found (default: "cache")

#### file

The relative filename of the file to forget. I.e. if you're not using the `base` option to `gulp.src`, the part of the filename corresponding to a glob, or the path relative to the baes if you are. E.g.

#### done

A callback to call on completion.

```javascript
gulp.src('files/**/*.js'); // file name is relative to files/

gulp.src('files/foo/bar/**/*.js', { base: 'files/foo' }); // file name is relative to files/foo/
```

### remember.reset([cacheName], done)

Forget all files from `cacheName` and remove all temporary files in that cache from disk.

#### cacheName

The cache to reset (default: "cache")

#### done

A callback to call on completion.

### remember.resetAll(done)

Reset the all caches and delete all temporary files associated with all caches.

#### done

A callback to call on completion.

## Example

As an example of how you could use this, here's the use case for which I created this plugin:

```javascript
const gulp = require('gulp');
const FileCache = require('gulp-file-cache');
const cache = new FileCache();
const read = require('gulp-read');
const babel = require('gulp-babel');
const header = require('gulp-header');
const footer = require('gulp-footer');
const remember = require('gulp-remember-cache');
const concat = require('gulp-concat');

gulp.task('build', () => {
  // Source some files but don't actually read them
  return gulp.src('some/files/**/*.js', { read: false })
    // Filter out ones that haven't changed since the last build
    .pipe(cache.filter())
    // Read in the ones that HAVE
    .pipe(read())
    // Compile them with babel
    .pipe(babel({ presets: [['env', { modules: false }], 'stage-3' ] }))
    // and wrap them with a header and footer
    .pipe(header(';(function() {\n'))
    .pipe(footer('\n})();'))
    // Update the cache
    .pipe(cache.cache())
    // Now remember any missing files from the compiled directory
    // (and write any newly processed ones there)
    .pipe(remember({ dest: 'generated/js/compiled/', cacheName: 'js' }))
    // Concat the final result
    .pipe(concat('app.js'));
});
```

## Questions

#### Isn't it expensive to read the compiled files?

Not any more expensive than reading the original source files. Theoretically it's the same number of files to read either way, but with `gulp-remember-cache`, you don't have to run compilation on things that haven't changed.

#### But isn't it expensive to write the compiled files to disk?

There is a _slight_ overhead to writing the files to disk the first time, but this is more than paid back by not recompiling all your files over and over.

#### Doesn't it need to read the compiled files from disk every time, even when the process is still running?

Yes, but you _should_ be able to pair this plugin with the in-memory `gulp-remember` to get the best of both worlds. This is untested, but I expect that putting `gulp-remember` in the flow just before `gulp-remember-cache` should be sufficient to skip the read of compiled files when the process is long running.

#### Isn't writing intermediate files more of a grunt thing?

Yeah, typically, but besides speeding up rebuilds, I also appreciate that this gives me a way to _look at_ the compiled source if necessary.

## Contributing

Please see [the contribution guidelines](CONTRIBUTING.md).
