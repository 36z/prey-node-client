var sys = require('sys'),
		emitter = require('events').EventEmitter;

var Transport = function(report, options) {

	var self = this;
	this.options = options;

	this.on('start', function(){
		this.began_at = new Date();
		console.log(" -- Report to " + this.destination + " began at " + this.began_at);
	});

	this.on('end', function(had_error){
		this.finished_at = new Date();
		var timediff = this.finished_at - this.began_at;
		if(had_error)
			console.log(" -- Report to " + this.destination + " failed.");
		else
			console.log(" -- Report to " + this.destination + " finished. Took " + timediff/1000 + " seconds.");
	});

}

sys.inherits(Transport, emitter);
module.exports = Transport;
