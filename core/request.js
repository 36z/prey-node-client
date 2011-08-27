var util = require('util'),
		sys = require('sys'),
		emitter = require('events').EventEmitter,
		http_client = require('http_client'),
		Geo = require(modules_path + '/geo'),
		Network = require(modules_path + '/network');

function Request(callback){

	var self = this;

	this.start = function(callback){

		var uri = config.check_url + '/devices/' + config.device_key + '.xml';

		var options = { headers: { "User-Agent": user_agent } }

		if (config.extended_headers) {

			this.get_extended_headers(options.headers, function(ext_headers){
				options.headers = ext_headers;
				self.get(uri, options, callback)
			});

		} else {

			this.get(uri, options, callback)

		}

	}

	this.get_extended_headers = function(headers, callback){

		var async_headers = 2;
		var headers_got = 0;

		headers['X-Logged-User'] = process.env['USERNAME'] // logged_user

		self.on('async_header', function(){

			headers_got++;
			if(headers_got >= async_headers){
				log(' -- All info in place!');
				callback(headers);
			}

		});

		Network.get('active_network', function(network){
			headers['X-Active-Network'] = network;
			self.emit('async_header');
		});

		Geo.get('coords_via_wifi', function(coords){
			headers['X-Current-Lat'] = coords.lat;
			headers['X-Current-Lng'] = coords.lat;
			self.emit('async_header');
		});

	},

	this.get = function(uri, options, callback){

		http_client.get(uri, options, function(response, body){
			log(' -- Got status code: ' + response.statusCode);
			// debug("Response headers:\n" + util.inspect(response.headers));
			// debug("Response body:\n" + body);
			callback(response, body);
		})

	}

	this.start(callback);

}

sys.inherits(Request, emitter);
module.exports = Request;
