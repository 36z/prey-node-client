//////////////////////////////////////////
// Prey Provider Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		util = require('util'),
		Emitter = require('events').EventEmitter;

function Provider(){

	var self = this;
	// this.trace_expiration = 30 * 1000; // 30 seconds

	this.log = function(str){
		logger.info(" ++ [" + this.name + "] " + str);
	};

	this.reset = function(){
		if(self.name && process.env.LOOP)
			self.log("Resetting! Current loop: " + process.env.LOOP);

		this.traces = {};
		this.traces_requested = [];
	}

	// this methods lets us do:
	// Network.get('public_ip', function(result){ /* bla bla */ });
	// or, in case the method expects an argument:
	// Network.get('mac_address', 'eth0', function(result){ /* bla bla */ });

	this.get = function(trace, opts, callback){
		if(typeof callback == 'undefined') callback = opts;

		if(typeof this.traces[trace] !== 'undefined') {
			callback(null, this.traces[trace]);
		} else {
			this.get_trace(trace, opts, callback);
		}
	};

	this.get_trace = function(trace, opts, callback){

		if(typeof callback == 'undefined') callback = (typeof opts == 'undefined') ? null : opts;
		var method = 'get_' + trace;

		self.once(trace, function(err, val){
			this.store_trace(trace, val);
			if(callback) callback(err, val);
		});

		if(self.traces_requested.indexOf(trace) == -1) {
			logger.debug('Requesting ' + method);
			self.traces_requested.push(trace);
			self[method](opts);
		}
	};

	this.store_trace = function(key, val){
		this.traces[key] = val;
	}

	this.reset();

};

util.inherits(Provider, Emitter);
module.exports = Provider;
