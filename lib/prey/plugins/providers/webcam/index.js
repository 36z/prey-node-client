//////////////////////////////////////////
// Prey JS Webcam Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		tempfile_path = common.helpers.tempfile_path,
		util = require('util'),
		path = require('path'),
//		GStreamer = require('spaghetti'),
		Provider = require('./../../../provider');
		os_functions = require('./platform/' + common.os_name);

var Webcam = function(){

	Provider.call(this);
	var self = this;
	this.name = 'webcam';

	this.getters = [
		'picture'
	];

	this.get_picture = function(options, callback){

		var file_path = options.picture_file || tempfile_path('picture.' + process.pid + '.jpg');

		os_functions.get_picture_cmd(file_path, function(err, file_type){

			if(err) callback(err);

			if(path.existsSync(file_path))
				callback(null, {file: file_path, content_type: file_type});
			else
				callback(new Error("Couldn't grab a picture using the webcam."));

		});

	};

};

util.inherits(Webcam, Provider);
module.exports = new Webcam();
