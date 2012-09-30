//////////////////////////////////////////
// Prey JS Hardware Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

"use strict";

var
  common = _ns("common"),
  os = require('os'),
  os_functions = require('./platform/' + common.os_name),
  async = require("async");

var Hardware = function() {

  // export some error messages for the platforms to use, this makes sure the
  // platforms return the same error msg in the same context.
  this.firmwareMsg = "Firmware error";
  this.nomacMsg = "No mac";
  
  var self = this;

  this.get_processor_info = function(callback) {
    var cpus = os.cpus();
    var cpu_info = {
      model: cpus[0].model,
      speed: cpus[0].speed,
      cores: cpus.length
    };
    callback(null,cpu_info);
  };

  this.get_firmware_info = function(callback){
    os_functions.get_firmware_info(callback);
  };

  this.get_first_mac_address = function(callback){
    os_functions.get_first_mac_address(callback);
  };

  this.get_broadcast_address = function(nic_name, callback) {
    os_functions.broadcast_address(nic_name,callback);
  };

  this.get_active_nic_names = function(callback) {
    os_functions.get_active_nic_names(callback);
  };
  
  this.get_network_interfaces_list = function(callback) {

    if (!os.networkInterfaces()) {
      callback(_error("No os interface"));
      return;
    }
    
    var
      nics = os.networkInterfaces(),
      validNics = os_functions.validNics(Object.keys(nics)); // array of valid names

    if (validNics.length === 0) {
      callback(_error("No valid nics"));
      return;
    }

    async.parallel(validNics.map(function(name) {
      return function(ascb) {
        var ipv4nic = nics[name].filter(function(n) { return n.family === "IPv4"; });
        self.get_mac_address(name,function(err, mac) {
          var obj = {};
          obj.mac = mac;
          obj.name = name;
          if (ipv4nic.length > 0) {
            obj.ip_address = ipv4nic[0].address;
          }
          
          self.get_broadcast_address(name,function(err,broadcast) {
            obj.broadcast_address = broadcast;
            ascb(null,obj);
          });
        });
      };
    }),callback);
  };

  this.get_mac_address = function(nic_name, callback) {
    os_functions.mac_address(nic_name,function(err, mac) {     
      var mac_address_regexp = /^([0-9a-f]{2}[:\-]){5}([0-9a-f]{2})$/i;

      if (!mac_address_regexp.test(mac)) {
        callback(_error('Malformed mac',mac));
        return;
      }
      
      callback(null,mac);
    });
  };

  
};

module.exports = new Hardware();

