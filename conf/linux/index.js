"use strict";

var fs = require('fs'),
    path = require('path'),
    exec = require('child_process').exec,
    base = require('../base'),
    _tr = base._tr;

var get_os_name = function(callback){
  var cmd = 'lsb_release -i';
  exec(cmd, function(err, stdout){
    if(err) return callback(_error("!:" + cmd,err));
    
    callback(null,stdout.toString().split(":")[1].trim());  
  });
};

var prey_bin = exports.prey_bin = '/usr/local/bin/prey';
var etc_dir = exports.etc_dir = '/etc/prey';

var init_script_name = 'prey-trigger',
    common_initd_path = '/etc/init.d';

var weird_initd_paths = {
  redhat: '/etc/rc.d/init.d',
  arch: '/etc/rc.d'
};

var initd_commands = {
  debian: {
    load: 'update-rc.d $1 defaults',
    unload: 'update-rc.d -f $1 remove'
  },
  redhat: {
    load: 'chkconfig $1 on',
    unload: 'chkconfig $1 off'
  },
  suse: {
    load: 'chkconfig --add $1',
    unload: 'chkconfig --del $1'
  }
};

initd_commands.ubuntu = initd_commands.debian;
initd_commands.linuxmint = initd_commands.debian;
initd_commands.fedora = initd_commands.redhat;

/////////////////////////////////////////////////
// helpers
/////////////////////////////////////////////////

var get_init_script_path = function(distro){
  var initd_path = weird_initd_paths[distro] || common_initd_path;
  return path.join(initd_path, init_script_name);
};

var copy_init_script = function(distro, callback){
  var full_path = get_init_script_path(distro);

  fs.exists(full_path, function(exists){
    if (exists) { 
      _tr('unlinking '+full_path);
      fs.unlink(full_path);
    }


    var template = fs.readFileSync(path.resolve(__dirname + "/" + init_script_name));
    var data = template.toString().replace('{{prey_bin}}', prey_bin);

    if(data === template.toString())
      return callback(new Error("Unable to replace template variables!"));

    _tr('copying to '+full_path);
    fs.writeFile(full_path, data, callback);

  });
};

var remove_init_script = function(distro, callback){
  var file = get_init_script_path(distro);
  fs.unlink(file, callback);
};

var load_init_script = function(distro, callback){
  _tr('distro is = '+distro);
  var command = initd_commands[distro].load.replace('$1', init_script_name);
  _tr('command is '+command);
  exec(command, callback);
};

var unload_init_script = function(distro, callback){
  var command = initd_commands[distro].unload.replace('$1', init_script_name);
  exec(command, callback);
};

/////////////////////////////////////////////////
// hooks
/////////////////////////////////////////////////

exports.post_install = function(callback) {
  get_os_name(function(err, name) {
    var distro = name.toLowerCase();
    copy_init_script(distro, function(err){
      if(err) return callback(err);
      
      load_init_script(distro, callback);
    });
  });
};

exports.pre_uninstall = function(callback){
  get_os_name(function(err, name){
    var distro = name.toLowerCase();
    unload_init_script(distro, function(err){
      if(err) return callback(err);
      
      remove_init_script(distro, function(err){
        if(!err || err.code === 'ENOENT') callback();
        
        else callback(err);
      });
    });
  });
};

