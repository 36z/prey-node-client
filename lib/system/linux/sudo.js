var spawn          = require('child_process').spawn,
    sudo_bin       = '/usr/bin/sudo',
    pass_required  = 'a password is required',
    sudo_args      = ['-n'];


module.exports = function(bin, args, cb){

  var cmd = [bin].concat(args),
      all_args = sudo_args.concat(cmd),
      out = '',
      err = '',
      returned = false;

  var sudo_env = process.env;
  sudo_env.LANG = 'en'; // to avoid sudo i18n that breaks our out.match()

  var done = function(e) {
    if (returned) return;
    returned = true;
    cb(e, out, err);
  }

  var opts = { stdio: 'pipe', env: sudo_env };

  var child = spawn(sudo_bin, all_args, opts);

  child.stdout.on('data', function(data){
    out += data.toString();
  })

  child.stderr.on('data', function(data){
    if (data.toString().match(pass_required))
      return done(new Error('No sudo access for ' + bin));

    err += data.toString();
  })

  child.on('exit', function(code){
    process.nextTick(done);
  })

}
