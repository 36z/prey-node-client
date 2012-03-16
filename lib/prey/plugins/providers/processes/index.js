//////////////////////////////////////////
// Prey Process List Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		exec = require('child_process').exec,
		Getters = require('./../../../getters');

var Processes = function(){

	Getters.call(this);
	var self = this;
	// this.name = 'process_list';

	this.getters = [
		'process_list',
		'parent_process_list'
	];

	this.get_process_list = function(callback){

		var processes = [];

		var child = exec('ps axo stat,user,ppid,pid,pcpu,pmem,time,comm | egrep -v " ps|grep"', function(err, stdout, stderr){

			if(err) return callback(err);
			// if(err) return callback(err);

			stdout.toString().split("\n").forEach(function(line){

				var columns = line.trim().split(/\s+/);
				if (columns[0] != '' && columns[columns.length] != '<defunct>'){

					var process = {
						status: columns[0],
						user:   columns[1],
						ppid:   parseInt(columns[2]),
						pid:    parseInt(columns[3]),
						cpu:    columns[4],
						mem:    columns[5],
						time:   columns[6],
						name:   columns[7]
					}

					if(process.pid != child.pid)
						processes.push(process);

				}

			});

			processes.sort(function(a,b){
				return(a.pid > b.pid);
			});

			// callback(null, processes);
			callback(null, processes);

		});

	};

	this.get_parent_process_list = function(callback){

		this.get('process_list', function(err, list){

			if(err) return callback(err);

			var parents = [];

			list.forEach(function(p){
				if(p.ppid == 1)
				// if(parents.indexOf(p.pid) == -1 && parents.indexOf(p.pid))
					parents.push(p);
			});

			parents.forEach(function(p){
				// console.log(p.pid + " -> " + p.name);
				// console.log(p);
			});

			// if(callback) callback(parents);
			callback(null, parents);

		});

	};

}

util.inherits(Processes, Getters);
module.exports = new Processes();
