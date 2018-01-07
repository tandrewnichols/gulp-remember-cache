const through = require('through2');

module.exports = (tmpl) => {
  return through.obj((file, enc, callback) => {
    if (file.isNull()) {
      callback(null, file);
    } else {
      file.contents = Buffer.concat([new Buffer(tmpl), file.contents]);
      callback(null, file);
    }
  });
};
