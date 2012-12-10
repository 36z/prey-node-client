"use strict";

//////////////////////////////////////////
// Prey Node.js Windows Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../common'),
	path = require('path'),
	wmic = require('./wmic'),
    exec = require('child_process').exec;

exports.process_running = function(process_name, callback){
	var cmd = 'tasklist /fi "imagename eq ' + process_name + '"';
	exec(cmd, function(err, stdout){
		callback(stdout && stdout.toString().indexOf(process_name) !== -1);
	});
};

/**
 *
 **/
exports.get_os_version = function(callback){
  exec('ver', function(err, stdout){
    if (err) return callback(_error('!:ver',err));

    var out = stdout.toString().trim();
    if (out.indexOf('2000') !== -1)
      callback(null,'2000');
    else if(out.indexOf('XP') !== -1)
      callback(null,'XP');
    else if (out.indexOf('Vista') !== -1)
      callback(null,'Vista');
    else if (out.indexOf(' 7 ') !== -1)
      callback(null,'7');
  });
};

/**
 *
 **/
exports.get_logged_user = function(callback) {
  var cmd = "computersystem get username";
  wmic.run(cmd,function(err, stdout) {
    if (err) return callback(err);

    callback(null, stdout.toString().split("\n")[1]);
  });
};

/**
 *
 **/
exports.get_os_name = function(callback){
  callback(null,common.os_name);
};


exports.auto_connect = function(callback){
	var cmd_path = path.join(common.root_path, 'scripts', 'windows', 'autowc.exe');
	exec(cmd_path + ' -connect', callback);
};

exports.wmic = require("./wmic");
