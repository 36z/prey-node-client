//////////////////////////////////////////
// Prey OnDemand Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		tls = require('tls'),
		path = require('path'),
		util = require('util'),
		base = require('./base'),
		logger = base.logger;

// to generate, run ./ssl/generate.sh
var private_key_file = 'ssl/ssl.key';
var certificate_file = 'ssl/ssl.cert';

var OnDemand = {

	stream: null,
	keys: null,
	connected: false,

	start: function(host, port, config, version, callback){

		this.get_keys(function(){
			OnDemand.connect(host, port, config, version, callback);
		});

		return this;

	},

	get_keys: function(callback){

		if(OnDemand.keys == null){

			if(!path.existsSync(private_key_file)){

				console.log(" !! Keys not found! Generating...");

				require('child_process').exec('ssl/generate.sh', function(error, stdout, error){
					logger.info(stdout);
					if(!error) OnDemand.read_keys(callback);
				});

			} else OnDemand.read_keys(callback);

		}

	},

	read_keys: function(callback){

		logger.info(" -- Reading TLS public/private keys...");

		this.keys = {
			key: fs.readFileSync(private_key_file).toString(),
			cert: fs.readFileSync(certificate_file).toString()
		};

		callback();

	},

	connect: function(host, port, config, version, callback){

		// create and encrypted connection using ssl
		var stream = tls.connect(port, host, this.keys, function(){

			logger.info(" -- Connection established.");
			if (stream.authorized)
				logger.info(" -- Credentials were valid!")
			else
				logger.info(" !! Credentials were NOT valid: " + stream.authorizationError);

			// stream.setEncoding('utf8');
			OnDemand.connected = true;
			OnDemand.register(config, version);

		});

		this.stream = stream;

		stream.on("data", function(data){
			logger.info(" -- Data received from On-Demand Hub: " + data);
			var msg = JSON.parse(data);
			if(msg.event == "ping")
				OnDemand.pong();
			else
				stream.emit('command', msg.event, msg.data);
		})

		stream.on("error", function(error){
			logger.info(error);
			stream.end();
		})

		stream.on("end", function(){
			logger.info(" -- On-Demand connection ended");
		})

		stream.on("close", function(had_error){
			logger.info(" -- On-Demand connection closed.");
			OnDemand.connected = false;
		});

		callback(stream);

	},

	register: function(config, version){
		logger.info(" -- Registering on On-Demand Hub...");
		var data = {
			client_version: version,
			key: config.device_key,
			group: config.api_key,
			protocol: 1
		}
		this.send('connect', data);
	},

	pong: function(){
		var data = {
			timestamp: Date.now().toString()
		}
		this.send('ping', data)
	},

	send: function(action, data){
		logger.info(" -- Sending action " + action);
		if(this.stream.writable) {
			// self.stream.write(JSON.stringify({ action: action, data: data }) + "\n", 'utf8');
			this.stream.write(JSON.stringify({ action: action, data: data }))
		} else {
			logger.info(" !! Stream not writable!");
			this.disconnect();
		}
	},

	disconnect: function(){
		if(!this.connected) return;
		logger.info(" -- Closing On-Demand connection upon request!");
		this.stream.destroy();
	}

}

exports.connect = function(host, port, config, version, callback){
	return OnDemand.start(host, port, config, version, callback);
}

exports.connected = OnDemand.connected;
exports.disconnect = OnDemand.disconnect;
