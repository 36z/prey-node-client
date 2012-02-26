//////////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		os = require('os'),
		http = require('http'),
		exec = require('child_process').exec,
		Provider = require('./../../../provider'),
		Hardware = require('./../hardware'),
		os_functions = require('./platform/' + common.os_name);

var Network = function(){

	Provider.call(this);
	var self = this;
	// this.name = 'network';

	this.getters = [
		'public_ip',
		'private_ip',
		'first_mac_address',
		'active_network_interface',
		'access_points_list',
		'active_access_point'
	];

	this.is_ip_address = function(str){
		var regexp = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})$/;
		return regexp.test(str);
	}

	this.get_public_ip = function(callback){

		var regex = /Current IP Address: (\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/;
		var host = 'checkip.dyndns.org';

		var req = http.get({host: host, path: '/'}, function(res){

				var html = '';

				res.on('data', function(chunk) {
					html += chunk;
				});

				res.on('end', function() {
					var ip = html.match(regex)[1];
					callback(null, ip);
				});

		});
		
		req.on('error', function(err){
			return callback(err);
		})
		
	};

	this.get_private_ip = function(callback){

		Hardware.get('network_interfaces_list', function(err, list){

			if(err) return callback(err);

			list.forEach(function(nic){
				if(self.is_ip_address(nic.ip_address))
					return callback(null, nic.ip_address);
			})

			return callback(new Error("No private IP found in any of the " + list.length + " interfaces."));

		});

	};

	this.get_broadcast_address = function(nic_name, callback){

		exec(os_functions.broadcast_address_cmd(nic_name), function(err, stdout, stderr){

			if(err) return callback(err);

			var output = stdout.toString();
			var broadcast = (output != '') ? output.replace('Bcast:', '').split("\n")[0] : null;
			callback(null, broadcast);

		});

	};

	this.get_first_mac_address = function(callback){

		Hardware.get('network_interfaces_list', function(err, list){
			
			if(err)
				callback(err)
			else if(list && list[0])
				callback(null, list[0].mac_address);
			else
				callback(new Error("Couldn't get any MAC addresses!"));

		});

	};

/*

	this.get_mac_addresses_list = function(){

		var macs = [];

		Hardware.get('network_interfaces_list', function(list){
			
			if(!list)
				return callback('first_mac_address', null, "Couldn't get any MAC addresses!");
			
			list.forEach(function(nic){
				if(nic.mac_address) macs.push(nic.mac_address);
			})
			
			callback('mac_addresses_list', macs);

		});

	};

*/
	
	this.get_nic_by_name = function(name, callback) {

		Hardware.get('network_interfaces_list', function(err, list){
			
			if(!list) return callback(err);
			
			list.forEach(function(nic){
				if(nic.name == name) return callback(null, nic);
			})
			
			callback(new Error("Couldn't find NIC named " + name));
			
		})
	}

	this.get_active_network_interface = function(callback){

		// works for Linux and Mac (at least on Lion)
		var cmd = "netstat -rn | grep UG | awk '{print $NF}'";

		exec(cmd, function(err, stdout, stderr){

			if(err) return callback(err);

			var nic_name = stdout.toString().trim().split('\n');
			
			if(nic_name.length == 0 || nic_name == ['']){

				callback(new Error("Couldn't find an active network interface."));
				
			} else {

				self.get('nic_by_name', nic_name, function(err, nic){
					self.get('broadcast_address', nic_name, function(err, bc_address){
						nic.broadcast_address = bc_address;
						callback(null, nic)
					})
				})
				
			}

		});

	};

	this.get_first_wireless_interface = function(callback){

		this.get('wireless_interface_names', function(err, list){

			if(err)
				callback(err);
			else if(list && list[0])
				callback(null, list[0]);
			else
				callback(new Error('No wifi network interfaces found.'));

		});

	};

	// returns array of names of wireless interfaces 
	this.get_wireless_interface_names = function(callback){

		exec(os_functions.wireless_devices_list_cmd, function(err, stdout, stderr){

			if(err) return callback(err);
			
			var list = stdout.toString().trim().split('\n');
			callback(null, list);

		});

	};

	this.get_active_access_point = function(callback){

		exec(os_functions.active_access_point_cmd, function(err, stdout, stderr){

			if(err) return callback(err);
			
			if(stdout.toString() == '')
				callback(new Error("No active access point found"));
			else
				callback(null, stdout.toString().trim());

		});

	};

	this.get_access_points_list = function(callback){

		this.get('first_wireless_interface', function(err, wifi_nic_name){

			if(err) return callback(err);

			os_functions.get_access_points_list(wifi_nic_name, function(err, result){

				if(err)
					return callback('access_points_list', err);
				else if(result instanceof Object)
					return callback('access_points_list', null, result);

				// this is in case the list is JSON.stringified
				try {
					callback('access_points_list', null, JSON.parse(result));
				} catch(e) {
					console.log(e);
					callback('access_points_list', new Error("Wifi hotspots list was returned in invalid format."));
				}

			});

		});

	}

	this.get_open_access_points_list = function(){
		
		this.get('access_points_list', function(err, list){

			if(err) return callback('open_access_points_list', err);
			var open_aps = [];

			list.forEach(function(ap){
				if(ap.security == 'NONE')
					open_aps.push(ap);
			})

			if(open_aps.length == 0)
				return callback('open_access_points_list', new Error("No open access points found. Try moving around a bit."))

			// sort them from the nearest to the farthest
			open_aps.sort(function(a, b){ 
				return a.signal_strength > b.signal_strength; 
				// return parseInt(a.signal_strength) > parseInt(b.signal_strength) 
			});
			
			callback('open_access_points_list', null, open_aps);

		})
		
	}


};

util.inherits(Network, Provider);
module.exports = new Network();
