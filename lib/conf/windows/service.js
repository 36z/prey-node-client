var path = require('path'),
    exec = require('child_process').exec,
    system = require('./../../system'),
    service = {};

var current_path = system.paths.current;

service.key  = 'prey';
service.name = 'Cron Service';
service.bin  = 'cronsvc.exe';
service.path = path.join(current_path, 'bin', 'windows', service.bin);

/**
 * Callback a bool if the service is installed.
 * sc qc returns error 1060 if the service is not found, so just check for an err
 * to test for existence.
 **/
service.exists = function(callback) {
  exec('sc qc ' + service.key, function(err) {
    callback(null, !err);
  });
};

/**
 * Get the pid of the running service else null.
 **/
service.running = function(callback) {

  var cmd = 'tasklist /nh /fi "imagename eq ' + service.bin + '"';

  exec(cmd, function(err, stdout){
    if (err) return callback(err);

    if (stdout.toString().indexOf(service.bin) === -1) {
      return callback(); //service not running
    }

    var cols = stdout.split(/\s+/),
        pid  = cols[2];

    callback(null, parseInt(pid));
  });

};


/**
 * Kill the running service process, note this is not the same as service_delete.
 **/
service.kill = function(pid, callback) {
  exec('taskkill /f /pid ' + pid, function(err, stdout){
    if (err) return callback(err);

    callback(null, stdout.indexOf("SUCCESS") !== -1);
  });
};


/**
 * Delete the service from the service registry.
 **/
service.delete = function(callback) {
  exec('sc delete ' + service.key, callback);
};

/**
 * Create a service, by providing the path to the executable.
 **/
service.create = function(callback) {
  var cmd = 'sc create ' + service.key + ' binPath= '+ service.path;
  cmd += ' DisplayName= ' + service.name;

  exec(cmd, function(err, stdout) {
    if (err) return callback(err);

    callback(null, stdout.indexOf("SUCCESS") !== -1);
  });
};


/**
 * Callback the service PID if all is well, else null.
 **/
service.start = function(callback) {
  exec('sc start ' + service.key, function(err, stdout) {
    if (err) return callback(err);

    var match = stdout.match(/PID\s+?:\s([0-9]+)\s/);

    if (!match)
      return callback(new Error('Couldnt start service'));

    callback(null, match[1]);
  });
};

module.exports = service;
