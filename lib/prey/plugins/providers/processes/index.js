"use strict";

//////////////////////////////////////////
// Prey Process List Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var
    common = _ns('common'),
    os_functions = require("./platform/"+common.os_name),
    exp = module.exports;

exp.get_process_list = os_functions.get_process_list;

exp.get_parent_process_list = function(callback) {
	exp.get_process_list(function(err, list) {
		if (err) return callback(_error(err));

		var parents = [];

		list.forEach(function(p){
			if (p.ppid === 1)
    		//if(parents.indexOf(p.pid) == -1 && parents.indexOf(p.pid))
			parents.push(p);
		});

		// parents.forEach(function(p){
		// 	console.log(p.pid + " -> " + p.name);
		// 	console.log(p);
		// });

    callback(null, parents);
  
  });    
};
