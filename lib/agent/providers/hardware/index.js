//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

"use strict";

var
 os      = require('os'),
 async   = require('async'),
 os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
 os_functions = require('./' + os_name),
 exp = module.exports;

var macs = [];

exports.mac_address_regex = /([0-9a-f]{2}[:-]){5}([0-9a-f]{2})/i;

exp.get_processor_info = function(callback) {
  var cpus = os.cpus();
  var cpu_info = {
    model: cpus[0].model,
    speed: cpus[0].speed,
    cores: cpus.length
  };
  callback(null,cpu_info);
};

/**
 * There are no parameters to create a memoized hash key on so supply "key" as default in
 * optional hasher function.
 **/
exp.get_firmware_info = async.memoize(function(callback){
  os_functions.get_firmware_info(function(err, data) {
    if (err) return callback(err);

    if (data.device_type)
      data.device_type = data.device_type.replace('Notebook','Laptop');

    callback(null,data);
  });
}, function() { return "key"; });

/**
 * There are no parameters to create a memoized hash key on so supply "key" as default in
 * optional hasher function.
 * Returns full list of network interfaces, including MAC and broadcast address
 **/
exp.get_network_interfaces_list = async.memoize(function(callback) {

  if (!os.networkInterfaces)
    return callback(new Error("os.networkInterfaces not present. Please update node."));

  var nics = os.networkInterfaces(),
      validNics = os_functions.validNics(Object.keys(nics)); // array of valid names

  if (validNics.length === 0)
    return callback(new Error("No valid nics"));

  async.parallel(validNics.map(function(name) {
    return function(ascb) {

      var ipv4nic = nics[name].filter(function(n) { return n.family === "IPv4"; });

      exp.mac_address(name, function(err, mac) {
        var obj = {};
        obj.mac = mac;
        obj.name = name;
        if (ipv4nic.length > 0) {
          obj.ip_address = ipv4nic[0].address;
        }

        ascb(null,obj);

      });
    };
  }),callback);

}, function() { return "key"; });

// even though these functions look like they belong in the network provider,
// we put them here because MAC addresses are part of the network interfaces,
// and are not subject to change (even though they can be spoofed)

exp.get_first_mac_address = function(callback){

	exp.get_network_interfaces_list(function(err, list){

		if (err)
			callback(err)
		else if (list && list[0])
			callback(null, list[0].mac_address);
		else
			callback(new Error("Couldn't get any MAC addresses!"));

	});

};


/**
 * Returns MAC address for NIC with given name (eth0, wlan0, etc)
 **/

exp.mac_address = async.memoize(function(nic_name, callback) {

  os_functions.mac_address(nic_name, function(err, mac) {
    if (err) return callback(err);

    if (!exports.mac_address_regex.test(mac))
      return callback(new Error('Malformed mac: ' + mac));

    callback(null, mac);
  });

});
