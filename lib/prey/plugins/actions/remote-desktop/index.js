//////////////////////////////////////////
// Prey JS Desktop Plugin
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		logger = common.logger,
		util = require('util'),
		spawn = require('child_process').spawn,
		Tunnel = require('./../../../tunnel'),
		Emitter = require('events').EventEmitter,
		os_functions = require('./platform/' + common.os_name);

var RemoteDesktop = function(options){

	// ActionModule.call(this);
	var self = this;

	this.vnc_opts = {
		port: options.vnc_port || 5900,
		pass: options.vnc_pass || 'secret',
		desktop_scale: options.desktop_scale || 2,
		view_only: options.view_only || true
	}

	this.tunnel_host = options.tunnel_host || 'localhost';
	this.tunnel_port = options.tunnel_port || 9999;

	// open: first we open the tunnel, then we run the command
	// close: first we close the tunnel, then we kill the command

	this.start = function(callback){

		this.tunnel = new Tunnel(this.vnc_opts.port, this.tunnel_host, this.tunnel_port);

		this.tunnel.on('opened', function(){

			logger.info("Tunnel for remote desktop is open!");
			
			os_functions.vnc_server_running(function(running){
				if(!running) self.start_vnc_server();
			})

			callback();

		});

		this.tunnel.on('closed', function(err){
			logger.info("Tunnel closed!");
			self.stop(err);
		});

	};

	this.start_vnc_server = function(){

		this.vnc_server_started = true;

		console.log("Starting VNC server...");
		var vnc_cmd = os_functions.vnc_command(self.vnc_opts);
		var split = vnc_cmd.split(' ');
		self.child = spawn(split.shift(), split);

		self.child.stderr.on('data', function(data){
			console.log(data.toString());
		})

		self.child.on('exit', function(code){
			logger.info("VNC server terminated.");
			self.stop();
		});

	};
	
	this.stop_vnc_server = function(){
		
		if(!this.vnc_server_started) return;

		console.log("Stopping VNC server...")
		
		if(this.child)
			this.child.kill();

		this.vnc_server_started = false;

	}

	this.stop = function(err){

		if(this.tunnel.is_open())
			this.tunnel.close(); // will trigger remote desktop command to stop
		
		if(this.vnc_server_started)
			this.stop_vnc_server();

			this.emit('end', err);

	}

};

util.inherits(RemoteDesktop, Emitter);

exports.start = function(options, callback){

	var desktop = this.desktop = new RemoteDesktop(options);
	desktop.start(callback);
	return desktop;

}

exports.stop = function(){
	this.desktop.stop();
}
