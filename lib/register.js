//////////////////////////////////////////
// Prey Register Module
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		config = common.config,
		logger = common.logger,
		fs = require('fs'),
		http_client = require('restler'),
		stringify = require('qs').stringify,
		Response = require('./response_parser'),
		System = require('./providers/system');

var config_file_path = common.root_path + '/config.js'

var Register = {

	store_config_value: function(key_name, value){
		var pattern = new RegExp("\t+" + key_name + ":.*");
		var new_value = "\t" + key_name + ': "' + value + '",';
		common.helpers.replace_in_file(config_file_path, pattern, new_value);
	},

	identify: function(options, callback){

		var url = 'https://control.preyproject.com/profile.xml';

		http_client.get(url, options)
		.on('error', function(body, response){
			callback(false);
		})
		.on('complete', function(body, response){
			console.log(body);
			console.log(response);
			callback(true);
		});

	},

	user: function(data, callback){

		var url = 'https://control.preyproject.com/register.json';

		self.send_request(url, data, function(body, response){

			console.log(body);
			console.log(response);
			callback(response.statusCode == 201);

		});

	},

	device: function(callback){

		var self = this;
		var url = options.url || config.check_urls[0] + '/devices.xml';

		this.get_system_data(function(data){

			self.send_request(url, data, function(body, response){

				if(response.statusCode == 201){

					logger.info("Device succesfully created.");
					Response.parse_xml(body, function(result){

						if(result.key){

							logger.info("Got device key: " + result.key + ". Storing in configuration...")
							config.device_key = result.key;

							self.store_config_value('device_key', result.key);
							callback(result.key)

						} else {

							throw("No device key found! Cannot continue.");

						}

					})

				}

			});

		});

	},

	get_system_data: function(callback){

		var data = {
			device: {
				title: 'My device',
				device_type: 'Portable',
				os: 'Ubuntu',
				os_version: '11.04'
			}
		}

		callback(data);

	},

	send_request: function(url, data, callback){

		var options = {
			headers : { "User-Agent": common.user_agent }
		}

		options.data = stringify(data);

		if(config.api_key){
			options.username = config.api_key;
			options.password = "x";
		}

		http_client.post(url, options)
		.on('error', function(body, response){

			logger.info("Response body: " + body);

		})
		.on('complete', function(body, response){

			// logger.debug("Response body: " + body);
			logger.info('Got status code: ' + response.statusCode);
			callback(body, response);

		})

	}

}

exports.identify = Register.identify;
exports.new_user = Register.user;
exports.new_device = Register.device;
