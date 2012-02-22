//////////////////////////////////////////
// Prey Request Class
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		config = common.config,
		logger = common.logger,
		util = require('util'),
		emitter = require('events').EventEmitter,
		http_client = require('needle'),
		System = require('./../../providers/system'),
		Network = require('./../../providers/network');

function Request(urls, callback){

	var self = this;
	this.callback = callback;
	this.uris = urls;

	this.attempts = 0;

	this.log = function(str){
		logger.info("[request] " + str);
	}

	this.start = function(){

		var options = { 
			parse: false, 
			headers: { 
				'User-Agent': common.user_agent,
				'X-Encrypt-Response': 'aes-128-cbc'
			}
		}

		if (config && config.extended_headers) {

			this.extend_headers(options.headers, function(ext_headers){
				options.headers = ext_headers;
				self.fetch(self.uris[0], options, self.callback)
			});

		} else {

			this.fetch(this.uris[0], options, this.callback)

		}

	}

	// other types of information that may be useful to know:
	// cpu usage, ram usage, hdd usage, total running programs ?
	this.extend_headers = function(headers, callback){

		var async_headers = 3;

		headers['X-Logged-User'] = process.env.LOGGED_USER; // logged_user

		self.on('ext_header', function(key){
			--async_headers || callback(headers);
		});

		System.get('current_uptime', function(err, seconds){
			headers['X-Current-Uptime'] = seconds;
			self.emit('ext_header', 'current_uptime');
		});

		System.get('remaining_battery', function(err, percentage){
			headers['X-Remaining-Battery'] = percentage; // 80
			self.emit('ext_header', 'remaining_battery');
		});

		Network.get('active_access_point', function(err, essid_name){
			headers['X-Active-Access-Point'] = essid_name || 'None';
			self.emit('ext_header', 'active_access_point');
		});

	},

	this.log_response_time = function(){
		var now = new Date();
		var seconds = (now - this.start_time)/1000;
		this.log("Request took " + seconds.toString() + " seconds.");
	};

	this.valid_status_code = function(code){
		return code == 200 || code == 404;
	};

	this.fetch = function(url, options, callback){

		if(typeof url == 'undefined') return false;

		this.start_time = new Date();
		var host = url.replace(/.*\/\/([^\/]+).*/, "$1");
		this.log("Fetching URI from " + host + "...");

		// TODO: fix this
		if(config && config.proxy && config.proxy.enabled){
			this.log("Connecting through proxy " + config.proxy_host + " at port " + config.proxy_port);
			options.proxy = 'http://' + config.proxy.host + ':' + config.proxy.port;
		}

		http_client.get(url, options, function(err, response, body){

			self.log_response_time();

			if(err){

				logger.error(err);
				self.fetch(self.uris[++self.attempts], options, callback);

			} else if(!self.valid_status_code(response.statusCode)){

				logger.error("Got unexpected status code: " + response.statusCode);
				self.fetch(self.uris[++self.attempts], options, callback);

			} else {

				self.log('Got status code: ' + response.statusCode);
				self.attempts = 0; // reset back to zero
				callback(body, response);

			}

		});

	}

	this.start();

}

util.inherits(Request, emitter);
module.exports = Request;
