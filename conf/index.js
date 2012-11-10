
"use strict";

/**
 * Assumptions:
 * 1. This is run under root.
 * 2. The install directory provided to --configure is the final resting place of the installation.
 * 3. Registering a user is not an interactive Q&A, but rather the correct details are passed on the CLI.
 * 
 * This module should:
 *   writes new key/vals from opts to config, if any
 *   sets current version
 *   verify account credentials, create user account or device
 *   sets crontab/system service for execution
 *   return code 0 if all was good
 *
 * Notes:
 *   Need to update hooks.js for other platforms, add etc_dir
 **/

var
  util = require('util'),
  inspect = util.inspect,
  gpath = require('path'),
  commander = require('commander'),
  exec = require('child_process').exec,
  async = require('async'),
  fs = require('fs'),
  platform = require('os').platform().replace('darwin', 'mac').replace('win32', 'windows'),
  hooks = require('./'+platform), // os specific functions
  versions_file = 'versions.json',
  no_internet = false,
  log_file,   // set if --log <log_file> is specified on command line,
  installation_dir = "/usr/lib/prey";

  //crypto = require('crypto'),

var 
  read_versions; // these are plugged based on platform

/**
 * The keys are the parameters that may be passed from the command line, the function is applied
 * to the value passed by the user before saving with getset.
 *
 * A modifier function returning null will prevent the given value being saved, a null function is simply ignored.
 **/
var config_keys = {
  email:null,
//  user_password:function(val) { return crypto.createHash('md5').update(val).digest("hex"); },
  user_name:null,
  user_password:null,
  auto_connect:null ,
  extended_headers:null ,
  post_method:null ,
  api_key:null ,
  device_key:null ,
  check_url:null ,
  mail_to:null,
  proxy_url:null,
  smtp_server:null ,
  smtp_username:null ,
  smtp_password:null 
};

/**
 * I think this platform specific stuff needs to be here as I can't load os_hooks without knowing this
 * in advance. prey and prey.bat are symlinks to the current real installation 'executables'
 **/

var etc_dir = function() {
  if (platform === 'linux') return '/etc/prey';
  if (platform === 'windows') return '/Progra~1/Prey';
};

var prey_bin = function() {
  if (platform === 'linux') return '/usr/local/bin/prey';
  if (platform === 'windows') return '/Program Files/Prey/current/prey.bat';
};

var indent = '';
var _tr  = function(msg) {
  var m = msg.split(/^([0-9]):/);
  
  if (m.length === 1) {
    if (log_file)
      fs.appendFileSync(log_file,indent + ' -- '+m[0]+'\n');
    else
      console.log(indent + ' -- '+m[0]);
  }

  if (m.length === 3) {
    var lev = m[1];
    if (lev > 0 || lev !== indent.length) {
      indent = '';
      for (var i = 0; i < lev ; i++)
        indent += ' ';
    }

    var log_line = indent+m[2];
    if (log_file) 
      fs.appendFileSync(log_file,log_line+'\n');
    else 
      console.log(log_line);
  }
};

/**
 * Print msg and exit process with given code.
 **/
var exit_process = function(error,code) {
  _tr('EXIT_PROCESS ('+code+')');
  _tr(inspect(error));

  if (code) process.exit(code);
  process.exit(0);
};

/**
 * Used in debug_error for getting source file and line of error.
 **/
var whichFile = function() {
  var e = new Error('blah'); 

  var m = e
        .stack
        .split("\n")[3]
        .trim()
        .match(/at (\S+) (\(([A-Z]:)?[^:]+):([0-9]+)/);
  
  return (m) ? {func:m[1],file:m[2],line:m[4] } : null;
};

/**
 * Make sure the directory exists.
 **/
var ensure_dir = function(path,callback) {
  fs.exists(path,function(exists) {
    if (exists) return callback(null);
    
    fs.mkdir(path,function(err) {
      if (err) return callback(_error(err));

      callback(null);
    });
  });
};

/**
 * Print the full context of the error and where it was generated 
 * then bails.
 **/
var debug_error = function(err,context) {
  // check if first parameter is already an error object
  if (typeof  err === 'object') {
    if (err.error) return err; 
  }

  err = {error:err,context:context,location:whichFile()};
  exit_process(err,1);
};

/**
 * Create an error object - let top level functions handle printing/logging.
 **/
var standard_error = function(err,context) {
  if (typeof err === 'object') {
    if (err.error) return err;
  }
  return {error:err,context:context};
};

/**
 * Default to standard error handling add --debug on command line for debug error handler.
 **/
var _error = standard_error;

/**
 * Parameters that are specified in the gui (or whereever) are handled separately to the 
 * other command line options so they may be handled in bulk.
 **/
var make_parameters = function(commander) {
  Object.keys(config_keys).forEach(function(key) {
    commander.option('--'+key+' <'+key+'>','');
  });
} ;

/**
 * Get a command line parameter value, and apply it's modifier.
 **/
var get_parameter_value = function(key) {
  var val = commander[key];
  if (val) {
    if(config_keys[key]) {
      // have a value modifer ...
      val = (config_keys[key])(val);
    }
  }
  return val;
};

/**
 * The commander object should hold all of the options that have been set by the user.
 * The keys are config_keys.
 **/
var update_config = function(installDir,callback) {
  var config = _ns('common').config;
  Object.keys(config_keys).forEach(function(key) {
    var val = get_parameter_value(key);
    if (val) {
      // the modifier can set the param to null if it shouldn't be saved for 
       // some reason
       config.set(key,val,true); // force option setting
    }
  });

  config.save(function(err) {
    if (err) return callback(_error(err));

    _tr('saved config ...');
    callback(null);
  });
};


var cp = function(src, dst, callback) {
  var is = fs.createReadStream(src);
  var os = fs.createWriteStream(dst);
  is.on("end", callback);
  is.pipe(os);
};

var cp_r = function(src, dst, callback) {
  fs.stat(src, function(err, stat) {
    if (stat.isDirectory()) {
      fs.mkdir(dst, function(err) {
        fs.readdir(src, function(err, files) {
          async.forEach(files, function(file, cb) {
            cp_r(gpath.join(src, file), gpath.join(dst, file), cb);
          }, callback);
        });
      });
    } else {
      cp(src, dst, callback);
    }
  });
};

/**
 * I'm not using helpers cos this must be used prior to the loading of namesspaces.
 **/
var copy_file = function(src, dest, callback){
  var path = require('path'),
      util = require('util'),
      dest_file = path.resolve(dest),
      dest_path = path.dirname(dest);

  var pump = function(){
    var input = fs.createReadStream(path.resolve(src));
    var output = fs.createWriteStream(dest_file);

    util.pump(input, output, function(err){
      // console.log('Copied ' + path.basename(src)  + ' to ' + dest);
      input.destroy();
      output.destroy();
      callback(err);
    });
  };

  var check_path_existance = function(dir){
    fs.exists(dir, function(exists){
      if(exists) return pump();

      // console.log("Creating directory: " + dir);
      fs.mkdir(dir, function(err){
        if(err) return callback(_error(err));
        pump();
      });
    });
  };

  fs.exists(dest_file, function(exists){
    if(exists) return callback(new Error("Destination file exists: " + dest_file));
    check_path_existance(dest_path);
  });
};

/**
 * Make sure the prey.conf exists in the etc dir.
 **/
var check_config_file = function(callback) {
  var conf = etc_dir() + '/prey.conf';
  fs.exists(conf,function(exists) {
    if (!exists) {
      _tr('prey.conf not found, copying default ...');
      copy_file(etc_dir()+'/current/prey.conf.default',conf,function(err) {
        if (err) return callback(_error(err));

        _tr('default prey.conf copied');
        callback(null);
      });
    } else {
      callback(null);
    }
  });
};

/**
 * Write an array of all currently installed versions of prey into the /etc/prey/versions.json.
 **/
var write_versions = function(versions,callback) {
  var vf = etc_dir() + versions_file;
  fs.writeFile(vf,JSON.stringify(versions),function(err) {
    if (err) return callback(_error(err));

    callback(null);
  });
};

/**
 * Get an array of paths to installed versions of prey from /etc/prey/versions.json.
 **/
var nix_read_versions = function(callback) {
  ensure_dir(etc_dir(),function(err) {
    if (err) return callback(_error(err));
    
    var vf  = etc_dir() + versions_file;
    fs.readFile(vf,'utf8',function(err,content) {
      if (err) {
        if (err.code !== 'ENOENT') {
          // if the file does not exist, ignore the error, otherwise it's unexpected ...
          return callback(_error(err));
        } else {
          // if the file simply does not exist, then there are no installations
          return callback(null,[]);
        }
      } 
      // otherwise return the array of installations
      callback(null,JSON.parse(content));
    });  
  });
};

/**
 * Read the versions directory inside \Program Files\Prey\versions
 **/
var win_read_versions = function(callback) {
  // first check to see if versions dir exists, if not create it
  var versions = etc_dir() + '/versions';
  ensure_dir(versions,function(err) {
    if (err) return callback(_error(err));
    
    fs.readdir(versions,function(err,dirs) {
      if (err) return callback(_error(err));
    
      callback(null,dirs.map(function(d) {
        return versions + '/'+d;
      }));
    });
  });
};

var read_versions = (platform === 'windows') ? win_read_versions :  nix_read_versions ;

/**
 * Create the symlink to the current prey version.
 **/
var create_symlink = function(installDir,callback) {
  var current = etc_dir() + '/current';
  
  var make_link = function() {
    // junction only applicable on windows (ignored on other platforms)
    fs.symlink(installDir,current,'junction',function(err) {
      if (err) {
        if (err.code === 'EACCES') {
          _tr('You should be running under root.');
        } 
        return callback(_error(err));
      }

      callback(null);
    });
  };

  // first check for existence of link ...
  fs.lstat(current,function(err,stat) {
    if (err) {
      if (err.code === 'ENOENT') {
        // doesn't exist make it ...
        return make_link();
      } else {
        // unknown error ...
        return callback(_error(err));
      }
    }

    // otherwise the link exists, need to remove and recreate ...
    fs.unlink(current,function(err) {
      if (err) {
        if (err.code === 'EACCES') {
          _tr('You should be running under root.');
        } 
        return callback(_error(err));
      }

      make_link();
    });
  });
};

/**
 * Update the global prey symlink to point to the newly installed version, and
 * for nix plaforms only update the versions array. 
 **/
var create_new_version = function(installDir,callback) {
  create_symlink(installDir,function(err) {
    if (err) return callback(_error(err));

    if (platform === 'windows')
      return callback(null);

    _tr("reading nix versions ...");
    // for nix's update versions array ...
    read_versions(function(err,versions) {
      if (err) return callback(_error(err));
      
      // already have a note of this installation, don't add it again to the array
      if (versions.indexOf(installDir) !== -1) {
        _tr('Have reference to '+installDir + ' already');
        return callback(null);
      }
      
      // versions is always initialized to something in read_versions
      versions.push(installDir);

      write_versions(versions,function(err) {
        if (err) return callback(_error(err));

        callback(null);
      });
    });
  });
};

/**
 * Get path to version directory.
 **/
var get_current_version_path = function(callback) {
  var current = etc_dir() + '/current';
  fs.readlink(current,function(err,realDir) {
    if (err) return callback(_error(err));

    callback(null,realDir);
  });
};

/**
 * Get package info from a prey installation dir.
 **/
var read_package_info = function(path,callback) {
  try {
    var info = require(path + '/package.json');
    callback(null,info);
  } catch(e) {
    callback(_error(e,path));
  }
};

/**
 * Get the package data for the current prey.
 **/
var get_current_info = function(callback) {
  get_current_version_path(function(err,path) {
    if (err) return callback(_error(err));
    
    read_package_info(path,callback);
  });
};

/**
 * Validates that a given path is a path to a Prey installation dir, callsback the prey version if successful.
 **/
var check_prey_dir = function(path,callback) {
  fs.exists(path,function(exists) {
    if (!exists) return callback(_error(path +' does not exist'));
    
    fs.stat(path,function(err,stat) {
      if (err) return callback(_error(err));
      if (!stat.isDirectory()) return callback(_error(path +' is not a directory'));

      read_package_info(path,function(err,info) {
        if (err) return callback(_error(err));

        callback(null,path);
      });
    });
  });
};

/**
 * Have path to an installation, initialize it's namespaces and global vars
 **/
var initialize_installation = function(path,callback) {
  check_config_file(function(err) {
    if (err) return callback(_error(err));
    require(path+'/lib');
    _ns('common');
    callback(null,path);
  });
};

/**
 * Get identifying keys from config file.
 **/
var get_keys = function(callback) {
  var common = _ns('common'),
      conf = common.config;

  callback({device:conf.get('control-panel','device_key'),api:conf.get('control-panel','api_key')});
};

/**
 * Must be called after initialize_installation.
 **/
var check_keys = function(callback) {
  get_keys(function(keys) {

    if(!keys.device) {
      _tr("Device key not present.");
    }

    if(!keys.api)
      return callback(_error("No API key found."));

    callback(null,keys);
  });
};

/**
 * Select the current prey version, and initializes it's
 * namespaces.
 **/
var with_current_version = function(callback) {
  get_current_version_path(function(err,path) {
    if (err) return callback(_error(err)); 

    initialize_installation(path,function(err) {
      if (err) return callback(_error(err));
      callback(null,path);
    });
  });
};

/**
 * Iterate over versions
 **/
var each_version = function(callback) {
  with_current_version(function(err,path) {
    if (err) return callback(_error(err));

    read_versions(function(err,versions) {
     if (err) return callback(_error(err));
     
     versions.forEach(function(path) {
       read_package_info(path,function(err,info) {
         if (err) return callback(_error(err));

         callback(null,{pack:info,path:path});
       });
     });
   });
  });
};

/**
 * Make sure all parameters specified in array are available from command line
 * and have values.
 **/
var required = function(req) {
  var vals = [];
  var missing = [];
  req.forEach(function(p) {
    var val = get_parameter_value(p);
    if (!val) 
      missing.push(p);
    else
      vals.push(val);
  });
  if (missing.length > 0) return {values:null,missing:missing};
  return {values:vals};
};

/**
 * From command line params, email,user_password and name, register a user.
 * Make sure required params array are values are indexed in order. 
 **/
var signup = function(callback) {
  var register = _ns('register');
  _tr("Signing up user...");

  var req_params = required(['user_name','email','user_password']);
  
  if (!req_params.values) {
    return callback(_error('signup: The following fields are required:',inspect(req_params.missing)));
  }
  
  var prms = req_params.values,
      packet = {
        user: {
          name: prms[0],
          email: prms[1],
          password: prms[2],
          password_confirmation: prms[2]
        }
      };

  register.new_user(packet, function(err, data){
    if (err) return callback(_error(err));

    callback(null);
  });
};

/**
 * From command line params, email,user_password make sure we have a valid user.
 * Then saves the returned api_key to config.
 * Callsback the api_key.
 **/
var validate_user = function(callback) { 
  var register = _ns('register');

  _tr("Validating user...");

  var req_params = required(['email','user_password']);

  if (!req_params.values) {
    return callback(_error('validate_user: The following fields are required:',inspect(req_params.missing)));
  }
  
  var prms = req_params.values,
      packet = { username: prms[0] , password: prms[1] };
  
  register.validate(packet, function(err, data){
    if (err) return callback(_error(err));

    var api_key = data.api_key,
        config = _ns('common').config;

    var hash = {'control-panel': {}};
    hash['control-panel'].api_key = api_key;
    config.merge(hash, true);
    config.save(function(err) {
      if (err) return callback(_error(err));
      _tr('updated config with api_key');
      callback(null,api_key);     
    });
  });
};

var npm_update = function(path,callback) {
  process.chdir(path);
  _tr('doing npm update in '+path);
  exec('npm update',function(err,stdout) {
    if (err) return callback(_error(err));
    callback(null);
  });
};

/**
 * Take the path provided, usually by the installer gui, to the top level directory of a new
 * Prey installation.
 *
 * After validating the path is a Prey installation, initialize it's globals file, and common.js 
 * file to get valid paths to various system locations.
 *
 * Add the new installation 
 *   linux/mac: to an array of installation paths,
 *   windows: array implicit in windows versions dir
 *
 * Read any of the config_options from the command line, and save them using getset to the default
 * config file.
 *
 * Install os hooks, using installation's hook stuff. 
 **/
var configure = function(path,callback) {
  async.waterfall([
 
    function(cb) {
      _tr('1:Checking path ...');
      check_prey_dir(path,cb);
    },

    function(path,cb) {
      ensure_dir(etc_dir(),cb);
    },

    function(cb) {
      fs.exists(path+'/node_modules',function(exists) {
        if (exists) return cb(null);
        npm_update(path,cb);
      });
    },

    function(cb) {
      _tr('1:Creating new version for ' + path);
      create_new_version(path,cb);
    },

    function(cb) {
      _tr('1:Initializing installation ...');
      initialize_installation(path,cb);
    },

    function(path,cb) {
      _tr('1:Updating config ...');
      update_config(path,cb);
    },

    function(cb) {
      _tr('1:Post install ...');
      hooks.post_install(cb);
    }
    ],
    callback
    );
};

/**
 * Set the current version of Prey to run.
 * Always runs the os_hooks.post_install of the installation to make
 * sure that that versions init scripts are copied.
 **/
var set_version = function(wanted_version,callback) {
  each_version(function(err,ver) {
    if (err) return callback(_error(err));

    if (ver.pack.version === wanted_version) {
      create_symlink(ver.path,function(err) {
        if (err) return callback(_error(err));

        hooks.post_install(function(err) {
          if (err) exit_process(err,1);
          exit_process("Prey" + ver.path+' set',0);
        });
      });
    }
  });
};

/**
 * Register the current device with the Prey control panel.
 **/
var register_device = function(callback) {
  with_current_version(function(err) {
    if (err) callback(_error(err));

    get_keys(function(keys) {
      if (!keys.api) return callback(_error('You need to signup first'));
      if (keys.device) return callback(_error('Device key already registered'));
      
      var reg = _ns('register');
      _tr('registering device with '+keys.api);
      reg.new_device({api_key:keys.api},function(err) {
        if (err) return callback(_error(err));

        callback(null);
      });
    });
  });
};

var needle = function(url,to,callback) {
  var needle = require('needle');
  needle.get(url,to,function(err,resp,body) {
    if (err) return callback(_error(err));
    
    var fd = fs.openSync(to,'w');
    console.log('file size='+body.length);
    fs.writeSync(fd,body,0,body.length,0,0);
    callback(null);
  });
};

var curl = function(url,to,callback) {
  _tr('in curl')
  exec('curl -L '+url+' > '+to,function(err,stdout) {
    callback(err,'blah',stdout);
  });
};

var unzip = function(file,to,callback) {
  exec('unzip -d '+to+' '+file,function(err,stdout) {
    if (err) return callback(_error(err));
    callback(null);
  });
};

/**
 * Install a new version from a url. The url should point at a zip file containing a prey installation.
 **/
var fetch = function(url,callback) {
  var tmp = require('tmp');
  tmp.file(function(err, zipFile, fd) {
    if (err) return callback(_error(err));

    _tr('getting '+url);

    needle(url,zipFile,function(err) {
      if (err) return callback(_error(err));
      _tr('saving ...');

      tmp.dir(function(err,explodePath) {
        if (err) return callback(_error(err));
        unzip(zipFile,explodePath,function(err) {
          if (err) return callback(_error(err));

          var d = fs.readdirSync(explodePath);
          _tr('zip dir is '+inspect(d));
          var extracted = explodePath + '/' + d[0] ;
          _tr('extracted dir='+inspect(fs.readdirSync(extracted)));
          read_package_info(extracted,function(err,info) {
            if (err) return callback(_error(err));

            ensure_dir(installation_dir,function(err) {
              if (err) return callback(_error(err));

              var dest = installation_dir + '/versions/' + info.version;
              _tr('copying files from '+extracted+' to '+dest);
              cp_r(extracted,dest,function() {
                _tr('files copied, configuring ...')
                configure(dest,function(err) {
                  if (err) return callback(_error(err));
                  callback(null);
                });
              });
            });
          });
        });
      });
    });
  });  
};


var fails_on_no_internet = function(action) {
  if (no_internet)
    exit_process(action+' action needs an internet connection',1);
};

var actions = function() { 
  commander.parse(process.argv);

  if (commander.debug) {
    _error = debug_error;
  }

  if (commander.log) {
    log_file = commander.log;
    if(fs.existsSync(log_file)) fs.unlinkSync(log_file);
  }

  if (commander.configure) {
    configure(commander.configure,function(err) {
      if (err) exit_process(err,1);
      exit_process('Prey configured successfully.',0);
    });
  }

  if (commander.versions) {
    each_version(function(err,ver) {
      if (err) exit_process(err,1);

      console.log(ver.pack.version+':'+ver.path);
    });
  }

  if (commander.set) {
    set_version(commander.set,function(err) {
      if (err) exit_process(err,1);
      exit_process('version now '+commander.set,0);
    });
  }

  if (commander.current) {
    get_current_info(function(err,info) {
      if (err) exit_process(err,1);
      console.log(info.version);
    });
  }

  if(commander.run) {
    var spawn = require('child_process').spawn;
    get_current_info(function(err,info) {
      if (err) exit_process(err,1);

      var child = spawn('node', [prey_bin(),'-l',info.version+'.log'], {
        detached: true,stdio: 'ignore' 
      });

      child.unref();
    });
  }

  if (commander.list_options) {
    Object.keys(config_keys).forEach(function(key) {
      console.log('--'+key);
    });
  }

  if (commander.update) {
    with_current_version(function(err,path) {
      if (err) exit_process(err,1);

      update_config(path,function(err) {
        if (err) exit_process(err,1);

        exit_process('Options updated',0);
      });
    });
  }

  if (commander.check) {
    with_current_version(function(err,path) {
      if (err) exit_process(err,1);

      /* rather than checking for existence of file, just copy init script for this version */
      hooks.post_install(function(err) {
        if (err) exit_process(err,1);

        check_keys(function(err,keys) {
          if (err) exit_process(err,1);
          _tr('keys'+inspect(keys));
          exit_process('all good',0);
        });
      });
    });
  }

  // actions with internet requirement ...

  if (commander.signup) {
    fails_on_no_internet('signup');
    with_current_version(function(err) {
      if (err) exit_process(err,1);

      signup(function(err) {
        if (err) exit_process(err,1);

        exit_process('User registerd ok',0);
      });
    });
  }

  if (commander.validate) {
    fails_on_no_internet('validate');
    with_current_version(function(err) {
      if (err) exit_process(err,1);

      validate_user(function(err,api_key) {
        if (err) exit_process(err,1);

        console.log(inspect(api_key));
        exit_process('User validated ok',0);
      });
    });
  }

  if (commander.register) {
    fails_on_no_internet('register');
    register_device(function(err) {
      if (err) exit_process(err,1);

      exit_process('Device registered',0);
    });
  }

  if (commander.install) {
    fails_on_no_internet('install');
    var url = commander.install;
    fetch(url,function(err) {
      if (err) exit_process(err,1);
      exit_process('Downloaded',0);
    });
  }
};

/**
 * Finally, read the command line.
 **/
commander
  .option('--configure <from_path>', 'Configure installation.')
  .option('--versions','List installed versions')
  .option('--set <version>','Set current version')
  .option('--current','Return current version')
  .option('--run','Run currently set Prey installation')
  .option('--signup','Requires params user_name,email,user_password')
  .option('--validate','Requires params email, user_password')
  .option('--list_options','List options that be be used with --configure or --update')
  .option('--update','Update options for the current installation')
  .option('--check','Check for valid installation')
  .option('--install <url>','Fetch and configure a new version of Prey from the url.')
  .option('--register','Register the current device')
  .option('--log <log_file>','Log configurator output to log_file')
  .option('--debug');

make_parameters(commander);

require('dns').lookup('google.com',function(err) {
  if (err) {
    console.log("Looks like you don't have an internet connection.");
    no_internet = true;
  }
  console.log('doing actions')
  actions();
});


