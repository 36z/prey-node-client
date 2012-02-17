//////////////////////////////////////////
// Prey On-Demand Driver
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		tls = require('tls'),
		path = require('path'),
		util = require('util'),
		crypto = require('crypto'),
		common = require('./../../../common'),
		config = common.config,
		logger = common.logger,
		Emitter = require('events').EventEmitter;

var OnDemandDriver = function(){

	var self = this;
	this.stream = null;
	this.keys = null;
	this.connected = false;
	this.protocol_version = 2;

	this.log = function(str){
		logger.info('[on-demand] ' + str);
	};

	this.load = function(options){

		this.config = options;
		this.host = this.config.host;
		this.port = parseInt(this.config.port);
		this.device_key = this.config.device_key;
		this.group_key = this.config.group_key || '(invalid)';
		
		if(!this.host || !this.port) return this.unload(new Error("No host or port given. Cannot connect."))

		this.read_keys(function(err){
			
			if(err) return self.unload(err);
			self.connect();

		});

	};
	
	this.unload = function(err){
		if(err) logger.error(err);
		if(this.stream) this.stream.destroy();
	}

	this.read_keys = function(callback){

		this.log("Reading TLS public/private keys...");

		try {

			this.keys = {
				key: fs.readFileSync(common.private_key_path).toString(),
				cert: fs.readFileSync(common.certificate_path).toString()
			};
			
			callback();
		
		} catch(e) {
			
			callback(e);
			
		}

	};

	this.connect = function(){

		var self = this;
		this.log("Connecting to " + this.host + " at port " + this.port);

		// create and encrypted connection using ssl
		var stream = this.stream = tls.connect(this.port, this.host, this.keys, function(){

			self.log("Connection established.");
			if (stream.authorized)
				self.log("Credentials were valid!")
			else
				self.log("Credentials were NOT valid: " + stream.authorizationError);

			// stream.setEncoding('utf8');
			self.connected = true;
			self.register();

		});

		stream.on("data", function(data){
			self.log("Data received from On-Demand Hub: " + data);
			self.process(data);
		})

		stream.on("error", function(error){
			self.log("On-Demand error: " + error.code);
			stream.end();
		})

		stream.on("end", function(){
			self.log("On-Demand connection ended");
		})

		stream.on("close", function(had_error){
			// console.log(had_error);
			self.log("On-Demand connection closed.");
			self.connected = false;
		});

	};
	
	this.process = function(data){

		try{
			var msg = JSON.parse(data);	
		} catch(e){
			console.log("Syntax error -- non JSON message.");
			return false;
		}

		if(msg.event == "ping")
			this.pong();
		else
			this.stream.emit('command', msg.command, msg.data);

	};

	this.register = function(){

		this.log("Sending credentials to On-Demand Hub...");
		var group_key = crypto.createHash('sha1').update(this.group_key).digest('hex');

		var data = {
			client_version: common.version,
			key: this.device_key,
			group: group_key,
			protocol: this.protocol_version
		}

		this.send('connect', data);
	
	};

	this.pong = function(){
		var data = {
			timestamp: Date.now().toString()
		}
		this.send('ping', data)
	};

	this.send = function(action, data){
		this.log("Sending action " + action);
		if(this.stream.writable) {
			// self.stream.write(JSON.stringify({ action: action, data: data }) + "\n", 'utf8');
			this.stream.write(JSON.stringify({ action: action, data: data }))
		} else {
			logger.info(" !! Stream not writable!");
			this.disconnect();
		}
	};

	this.disconnect = function(){
		if(!this.connected) return;
		this.log("Closing On-Demand connection upon request!");
		this.stream.destroy();
	}

}

util.inherits(OnDemandDriver, Emitter);

exports.load = function(options){
	instance = new OnDemandDriver(options);
	instance.load();
	return instance; 
}

exports.unload = function(){
	instance.unload();
}