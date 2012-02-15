//////////////////////////////////////////
// Prey Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		net = require('net'),
		util = require('util'),
		Emitter = require('events').EventEmitter;

var Connection = function(proxy_config){

	var self = this;
	this.established = false;
	this.timeout = 5 * 1000; // 5 seconds

	if(proxy_config.enabled){
		this.check_port = proxy_config.port;
		this.check_host = proxy_config.host;
	} else {
		this.check_port = 80;
		this.check_host = 'www.google.com';
	}

	this.done = function(status, err){
		this.emit(status, err);
		this.removeAllListeners();
		this.socket.destroy();
	};

	this.establish = function(){

		// create TCP stream to server
		var socket = this.socket = new net.Socket();
		socket.setTimeout(this.timeout);

		socket.connect(parseInt(this.check_port), this.check_host);

		socket.once('connect', function() {
			self.established = true;
			self.done('connect');
		});

		socket.once('timeout', function(e) {
			logger.error('Connection timeout!');
			self.done('error', e);
		});

		// listen for any errors
		socket.once('error', function(e) {
			logger.error(e);
			self.done('error', e);
		})

	};

}

util.inherits(Connection, Emitter);

exports.check = function(options, callback){
	var connection = new Connection(options || {});
	connection.once('connect', callback);
	connection.once('error', callback);
	connection.establish();
}