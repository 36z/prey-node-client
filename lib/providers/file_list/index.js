//////////////////////////////////////////
// Prey File List Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../../base'),
		util = require('util'),
		InfoModule = require('../../info_module'),
		finder = require('./lib/finder');

var Filelist = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'file_list';

	this.recently_modified = function(options, callback){

		var path = options.path || '~';
		var one_week_ago = new Date() - (60 * 60 * 24 * 7 * 1000);
		var modified_since = options.modified_since || one_week_ago;

		var criteria = function(file, stat){
			return stat.mtime.getTime() > modified_since;
		};

		this.get_list({path: path, criteria: criteria}, function(files){
			self.emit('modified_files', files);
		};

	};

	this.get_matching = function(options){

		var search_string = options.search_string;
		var extensions = options.extensions;

		var regex = new RegExp(search_string + "\." + extensions);

		var criteria = function(file, stat){
			return regex.test(file);
		};

		this.get_list({path: path, criteria: criteria}, function(files){
			self.emit('matching_files', files);
		};

	};

	this.get_list = function(options, callback){

		this.path = options.path || '~';
		var files = [];
		var matches_criteria = options.criteria;

		finder.eachFileOrDirectory(path, function(err, file, stat) {

			// if we get a hidden file or error, skip to next
			if (err || /\/\./.test(file)) return;

			if(!stat.isDirectory() && matches_criteria(file, stat)) {
				console.log("File matches criteria:" + file)
				files.push(file);
			}

		}, function(err, files, stats){

			callback(files);

		});


	};

}

util.inherits(Filelist, InfoModule);
module.exports = new Filelist();
