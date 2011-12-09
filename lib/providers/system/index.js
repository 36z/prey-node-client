//////////////////////////////////////////
// Prey JS System Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../common'),
		util = require('util'),
		os = require('os'),
		Command = require('command'),
		InfoModule = require('../../info_module');

var System = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'system';

	this.get_current_uptime = function(){
		self.emit('current_uptime', parseInt(os.uptime()));
	};

	this.get_remaining_battery = function(){
		self.emit('remaining_battery', 100);
	};

	this.get_cpu_load = function(){
		return os.loadavg()[0];
	};

	this.get_mem_usage = function(){
		return (os.freemem()/os.totalmem());
	};

	this.get_logged_user = function(){
		common.helpers.run_cmd(common.os.get_logged_user_cmd, function(user_name){
			if(user_name && user_name != '')
				self.emit('logged_user', user_name);
			else
				self.emit('logged_user', false, "No logged user found");
		});
	};

};

util.inherits(System, InfoModule);
module.exports = new System();
