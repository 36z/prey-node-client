#!/usr/bin/env node
//////////////////////////////////////////
// Prey JS Client
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var path = require('path'), opts = require('opts');
process.env.ROOT_PATH = root_path = path.resolve(__dirname); // base.root_path;

////////////////////////////////////////
// base initialization
////////////////////////////////////////

try {
	var config = require(root_path + '/config');
} catch(e) {
	console.log("No config file found! Running setup!\n");
	return require(root_path + '/bin/setup');
}

var common = require(root_path + '/lib/prey/common'),
		logger = common.logger,
		pid_file = common.helpers.tempfile_path('prey.pid'),
		args = require(root_path + '/lib/prey/args').parse(common.version),
		Prey = require(root_path + '/lib/prey');

/////////////////////////////////////////////////////////////
// event, signal handlers
/////////////////////////////////////////////////////////////

process.on('exit', function(code) {
	Prey.shutdown();
	if(code != 10) common.helpers.clean_up(pid_file);
	logger.info('Have a jolly good day sir.\n');
});

process.on('SIGINT', function() {
	logger.warn('Got Ctrl-C!');
	process.exit(0);
});

process.on('SIGUSR1', function() {
	logger.notice('Got SIGUSR1 signal!');
	Prey.unleash();
});

/*

process.on('uncaughtException', function (err) {
	console.log('Caught exception: ' + err);
	if(config.send_crash_reports) require(root_path + '/lib/crash_notifier').send(err);
});

*/

/////////////////////////////////////////////////////////////
// launcher
/////////////////////////////////////////////////////////////

common.helpers.check_and_store_pid(pid_file, function(running_pid){

	if(running_pid){
		// process.kill(running_pid, 'SIGUSR1');
		Prey.poke('localhost', function(){
			process.exit(10);
		});
	} else {
		Prey.run(config, args);
	}

});
