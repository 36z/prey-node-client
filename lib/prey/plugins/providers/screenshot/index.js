//////////////////////////////////////////
// Prey JS Screenshot Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		util = require('util'),
		path = require('path'),
		GStreamer = require('node-gstreamer'),
		Provider = require('./../../../provider'),
		exec = require('child_process').exec,
		os_functions = require('./platform/' + common.os_name);

var Screenshot = function(){

	Provider.call(this);
	var self = this;
	this.name = 'screenshot';

	this.getters = [
		'screenshot'
	];

	this.get_screenshot = function(options){

		var screenshot_file = options.screenshot_file || 'screenshot.jpg';
		var cmd = common.os.run_as_logged_user_cmd(os_functions.screenshot_cmd) + ' ' + screenshot_file;
		
		exec(cmd, function(err, stdout, stderr){

			if(err) return self.emit('screenshot', err);

			path.exists(screenshot_file, function(exists){
				if(exists)
					self.emit('screenshot', null, {file: screenshot_file, content_type: 'image/jpeg'});
				else
					self.emit('screenshot', new Error("Unable to get screenshot."));
			})

		})

/*
		GStreamer.captureFrame('desktop', screenshot_file, function(file){

			if(file)
				self.emit('screenshot', {file: file, content_type: 'image/jpg'});
			else {
				fs.unlink(screenshot_file); // just in case
				self.emit('screenshot', false);
			}

		});
*/

	};

};

util.inherits(Screenshot, Provider);
module.exports = new Screenshot();
