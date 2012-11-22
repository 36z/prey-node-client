"use strict";

//////////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util    = require('util'),
		spawn   = require('child_process').spawn,
		Emitter = require('events').EventEmitter,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var lock_binary = __dirname + '/' + os_name + '/prey-lock',
		default_pass = 'e75f0173be748b6f68b3feb61255693c'; // "preyrocks", because it does. :)

var md5_digest = function(str){
	return require('crypto').createHash('md5').update(str).digest('hex');
};

var Lock = function(options){

	var self = this;
	this.options = options;
	this.password = options.password || options.unlock_pass || default_pass;

	if (this.password.length !== 32)
	  this.password = md5_digest(this.password);

	this.start = function(){

		this.child = spawn(lock_binary, [this.password]);

		this.child.stdout.on('data', function(data){
			if (data.toString().match(/invalid password/i))
				self.emit('failed_unlock_attempt');
		});

		this.child.once('exit', function(code, signal){

			// console.log("Lock exited with code " + code);
			if (code === 66)
				self.emit('end');
			else
				self.start();

		});

	};

	this.stop = function(){
		if (this.child)
			this.child.kill();
	};

	this.is_running = function(){
		try { process.kill(this.child.pid, 0); return true; }
		catch(e) { return false; }
	};

};

util.inherits(Lock, Emitter);
exports.events = ['failed_unlock_attempt'];

exports.start = function(options, callback){
  if (this.lock) return callback(_error('Lock already running!'));

	var lock = this.lock = new Lock(options);
	this.lock.start();

	setTimeout(function(){
		var e = lock.is_running() ? null : _error("Lock not running!");
		callback(e);
	}, 100);

	return this.lock;
};

exports.stop = function(){
	if (this.lock)
		this.lock.stop();

	this.lock = null;
};
