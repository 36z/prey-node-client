//////////////////////////////////////////
// Prey Actions Manager Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		emitter = require('events').EventEmitter;

var ActionsManager = function(){

	var self = this;
	this.running_actions = [];

	this.start_all = function(){
		console.log(' -- Starting all actions!')
		this.emit('start');
	};

	this.action_finished = function(action_module){
		console.log(' -- Action module ' + action_module.name + ' finished.');

		var index = this.running_actions.indexOf(action_module);
		delete this.running_actions[index];
	};

	this.action_is_running = function(action_module){
		return (this.running_actions.indexOf(action_module) != -1) ? true : false;
	}

	this.initialize = function(enabled_action_modules){

		this.running_actions.forEach(function(action_name){

			if(enabled_action_modules.indexOf(running_action) == -1){
				console.log(" -- " + running_action.name + " action was turned off!")
				self.stop(name);
			}

		});

		enabled_action_modules.forEach(function(action_module){

			if(self.action_is_running(action_module)) {
				console.log(" -- " + action_module.name + " is already running!")
			} else {
				self.queue(action_module);
			}

		});

	}

	this.queue = function(action_module){

		console.log(' -- Queueing action ' + action_module.name);

		self.once('start', function(){
			console.log(' -- Running action ' + action_module.name);

			// self.running_actions[action_module.name] = action_module;
			self.running_actions.push(action_module);

			action_module.once('end', function(){
				self.action_finished(action_module);
			});

			action_module.run();

		});

	}

	this.stop_all = function(){

		console.log(" -- Stopping all actions!");

		this.running_actions.forEach(function(action_module){
			self.stop(action_module);
		});

	};

	this.stop = function(action_module){

		// var action_module = this.running_actions[action_module_name];
		action_module.stop();

	};

}

util.inherits(ActionsManager, emitter);
module.exports = new ActionsManager(); // singleton
