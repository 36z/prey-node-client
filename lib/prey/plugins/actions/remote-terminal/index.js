//////////////////////////////////////////
// Prey JS Terminal Module
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var common = require('./../../../common'),
		logger = common.logger,
		util = require('util'),
		spawn = require('child_process').spawn,
		Tunnel = require('./../../../tunnel'),
		Emitter = require('events').EventEmitter,
		os_functions = require('./platform/' + common.os_name);

var RemoteTerminal = function(options){

	var self = this;

	this.ssh_server_stated = false;

	this.ssh_port = options.ssh_port || 22;
	this.tunnel_host = options.tunnel_host || 'localhost',
	this.tunnel_port = options.tunnel_port || '9998';

	this.start = function(callback){

		this.tunnel = new Tunnel(this.ssh_port, this.tunnel_host, this.tunnel_port);

		this.tunnel.on('opened', function(){

			logger.info("Tunnel for remote terminal is open!");

			os_functions.ssh_server_running(function(running){
				if(!running) self.start_ssh_server(callback);
				else callback();
			});

		});

		this.tunnel.on('closed', function(){

			logger.info("Tunnel closed!");
			self.stop();

		});

	}

	this.start_ssh_server = function(callback){

		logger.info("Starting SSH server!");
		os_functions.start_ssh_server(function(err){
			if(err) {
				self.stop();
				return callback(new Error("Could not start SSH server."));
			}

			self.ssh_server_started = true;
			console.log("SSH server online!")
		})

	};

	this.stop_ssh_server = function(){

		if(!this.ssh_server_started) return;

		logger.info("Stopping SSH server!");
		os_functions.stop_ssh_server(function(err){
			if(err) console.log("Could not stop SSH server.");
			else console.log("SSH server offline.")
		})

		this.ssh_server_started = false;

	};

	this.stop = function(){

		if(this.tunnel.is_open())
			this.tunnel.close(); // will trigger remote desktop command to stop

		if(this.ssh_server_started)
			this.stop_ssh_server();

		this.emit('end');

	}

};

util.inherits(RemoteTerminal, Emitter);

exports.start = function(options, callback){

	var terminal = this.terminal = new RemoteTerminal(options);
	terminal.start(callback);
	return terminal;

}

exports.stop = function(){
	this.terminal.stop();
}
