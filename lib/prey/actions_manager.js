//////////////////////////////////////////
// Prey Actions Manager Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		util = require('util'),
		hooks = require('./hook_dispatcher'),
		emitter = require('events').EventEmitter;

var ActionsManager = function(){

	var self = this;
	this.running_actions = [];
	this.loaded_modules = {};

	this.registered_events = [];

	this.queued_count = 0;
	// this.returned_count = 0;
	this.waiting_to_return = 0;

	this.initialize = function(enabled_action_modules){

		this.running_actions.forEach(function(running_action){

			if(enabled_action_modules.indexOf(running_action) == -1){
				logger.notice("" + running_action.name + " action was turned off!")
				self.stop(running_action.name);
			}

		});

		enabled_action_modules.forEach(function(action_module, i){

			self.loaded_modules[action_module.name] = action_module;

			if(self.action_is_running(action_module)) {
				logger.warn(action_module.name + " is already running!")
			} else {
				if(self.queue(action_module)) self.queued_count++;
			}

		});

		// console.log(this.registered_events);
		hooks.unregister_if_missing(this.registered_events);

	};

	this.action_is_running = function(action_module){
		return (this.running_actions.indexOf(action_module) != -1) ? true : false;
	};

	this.queue = function(action_module){

		logger.info('Queueing action ' + action_module.name);
		this.initialize_module(action_module);

		this.once('start', function(){
			self.start_action(action_module);
		});

		return true;

	}

	this.initialize_module = function(action_module, options){

		this.register_events(action_module);
		this.load_hooks(action_module);

	};

	this.register_events = function(action_module){

		// register events if any
		if(action_module.events && action_module.events.length > 0){
			action_module.events.forEach(function(event_name){
				logger.info(action_module.name + " announced event: " + event_name);
				self.registered_events.push(event_name);
			});
		}

	};

	this.load_hooks = function(action_module){

		// register hooks as well
		if(action_module.hooks && Object.keys(action_module.hooks).length > 0){
			for(hook in action_module.hooks){
				hooks.register(hook, action_module.hooks[hook]);
			}
		}

	};

	this.add_event_listeners = function(action_module, emitter){
		
		logger.info("Attaching event listeners to " + action_module.name)

		if(action_module.events && action_module.events.length > 0){
			action_module.events.forEach(function(event_name){
				emitter.on(event_name, function(data){
					// hooks.trigger(event_name, data);
					self.emit('event_triggered', event_name, data);
				});
			});
		}

	};
	
	this.remove_event_listeners = function(action_module, emitter){
		
		logger.info("Removing event listeners from " + action_module.name);
		
		action_module.events.forEach(function(event_name){
			emitter.removeAllListeners(event_name);
		})
		
	};

	this.start_all = function(){
		logger.info("Starting " + this.queued_count + " queued actions!");
		this.emit('start');
	};

	this.start_action = function(action_module){

		if(action_module.start) {

			logger.info('Starting action ' + action_module.name);
			hooks.trigger(action_module.name + '_start');

			this.running_actions.push(action_module);
			this.waiting_to_return++;

			action_module.started_at = new Date();
			action_module.start(action_module.options || {}, function(object, data){
				self.action_returned(action_module, object, data);
			});

		}

	};

	this.stop_all = function(){
		
		if(this.running_actions.length <= 0) 
			return logger.info("No actions are running.");

		logger.info("Stopping all actions!");
		// console.log(this.running_actions);

		this.running_actions.forEach(function(action_module){
			logger.info("Stopping action " + action_module.name);
			self.stop(action_module.name);
		});

	};

	this.stop = function(action_module_name){

		var action_module = this.loaded_modules[action_module_name];

		// var action_module = this.running_actions[action_module_name];
		if(action_module && action_module.stop) action_module.stop();
		else logger.error(action_module_name + " action not running or not stoppable!");

	};

	this.action_returned = function(action_module, return_object, returned_data){

		var timediff = new Date() - action_module.started_at;
		var msg = action_module.name + ' module returned after ' + timediff/1000 + ' seconds. ';
		msg += return_object !== false ? "All good." : "No success.";
		logger.info(msg);

		hooks.trigger(action_module.name + '_end');
		this.emit('action_returned', action_module.name, return_object, returned_data);

		// if immediate action returned or long running action was unsuccesful,
		// then we mark it as ended
		if(typeof return_object == 'boolean')
			this.action_finished(action_module, return_object);
		
		this.waiting_to_return-- || this.emit('all_returned');

		// if return object is an emitter, then it's a long running/persistent
		// action, which means we need to listen for the 'end' event to know
		// when it really finishes

		if(return_object.emit){
			if(action_module.events) this.add_event_listeners(action_module, return_object);

			return_object.once('end', function(success, data){
				self.remove_event_listeners(action_module, return_object);
				self.action_finished(action_module, success, data);
			});
		}

	};

	this.action_finished = function(action_module, success, data){
		logger.info("Action finished: " + action_module.name);
		this.emit('action_finished', success, data)
		this.remove_from_running(action_module);
	};

	this.remove_from_running = function(action_module){
		var index = this.running_actions.indexOf(action_module);
		this.running_actions.splice(index, 1);
	};

}

util.inherits(ActionsManager, emitter);
module.exports = new ActionsManager(); // singleton