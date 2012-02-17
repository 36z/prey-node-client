//////////////////////////////////////////
// Prey Data Dispatcher
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		config = common.config,
		user_agent = common.user_agent,
		logger = common.logger,
		util = require('util'),
		emitter = require('events').EventEmitter,
		plugins = require('./plugin_loader');

var Dispatcher = function(){

	var self = this;

	this.log = function(str){
		logger.info("[notifier] " + str);
	};
	
	this.send = function(endpoint_name, data, options, callback){
		
		plugins.load_transport(endpoint_name, function(err, transport){
			
			if(err) return callback(err);

			transport.send(data, options, function(err, response){
				callback(err, response);
			});
	
		})

	}

}

util.inherits(Dispatcher, emitter);
module.exports = new Dispatcher();
