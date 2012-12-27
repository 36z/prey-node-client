var dialog = require('dialog'),
    system = require('./../../common').system;

dialog.run = function(args, cb){
  var bin = args.shift();
  system.spawn_as_logged_user(bin, args, function(err, child){
    if (err) return;

    child.on('exit', function(code){
      // console.log(code);
    })
  });
}

exports.start = function(opts, cb){
  var opts = opts || {},
      message = opts.message;

  if (!message || message == '')
    return cb(new Error('Alert requires a message.'))

  dialog.info(message);
  cb();
}
