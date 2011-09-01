//////////////////////////////////////////
// Prey JS Webcam Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		ReportModule = require('../../core/report_module'),
		os_functions = require('./platform/' + os_name);

var Webcam = function(){

	ReportModule.call(this);
	var self = this;
	this.name = 'webcam';

	this.options = {
		picture_file: 'picture.jpg'
	}

	this.trace_methods = [
		'picture'
	]

	this.get_picture = function(){

		os_functions.run_picture_cmd(this.options.picture_file, function(file, extension){

			if(file)
				self.emit('picture', {path: file, type: extension});
			else
				self.emit('picture', false);

		});

	};

};

sys.inherits(Webcam, ReportModule);
module.exports = new Webcam();
