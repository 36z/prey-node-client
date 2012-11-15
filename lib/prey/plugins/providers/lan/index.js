"use strict";

//////////////////////////////////////////
// Prey LAN Info Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var 
  common = _ns('common'),
  os_functions = require("./platform/"+common.os_name),
  helpers = _ns('helpers'),
  exp = module.exports;


exp.get_active_nodes_list = helpers.report(function(callback) {
  os_functions.get_active_nodes_list(callback);
});

exp.get_ip_from_hostname = function(hostname, callback) {
  os_functions.get_ip_from_hostname(hostname,callback);
};

