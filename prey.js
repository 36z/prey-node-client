#!/usr/local/bin/node
//////////////////////////////////////////
// Prey JS Client
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

// set globals that are needed for all descendants
GLOBAL.base_path = __dirname;
GLOBAL.script_path = __filename;
GLOBAL.modules_path = base_path + '/prey_modules';
GLOBAL.os_name = process.platform.replace("darwin", "mac").replace('win32', 'windows');
os = require(base_path + '/platform/' + os_name);

////////////////////////////////////////
// base requires
////////////////////////////////////////

// require.paths.unshift(__dirname);
require('core_extensions');
require('logger');

var path = require('path'),
		fs = require("fs"),
		util = require("util"),
		tcp = require("net"),
		sys = require("sys"),
		url = require('url'),
		emitter = require('events').EventEmitter,
		helpers = require('./core/helpers'),
		http_client = require('http_client'),
		Connection = require('./core/connection'),
		Request = require('./core/request'),
		ResponseParser = require('./core/response_parser'),
		Setup = require('./core/setup'),
		ModuleLoader = require('./core/module_loader'),
		ActionsManager = require('./core/actions_manager'),
		Report = require('./core/report'),
		OnDemand = require('./core/on_demand');

////////////////////////////////////////
// base initialization
////////////////////////////////////////

var pid_file = helpers.tempfile_path('prey.pid');
var version = fs.readFileSync(base_path + '/version').toString().replace("\n", '');

GLOBAL.config = require(base_path + '/config').main;
GLOBAL.args = require('./core/args').init(version);
GLOBAL.user_agent = "Prey/" + version + " (NodeJS, "  + os_name + ")";

helpers.get_logged_user();

////////////////////////////////////////
// models
////////////////////////////////////////

var Prey = {

	running: false,
	auto_connect_attempts: 0,
	traces: {},
	modules: { action: [], report: []},
	on_demand: null,

	run: function(){

		self = this;
		self.initialize(function(){

			self.check_connection();

		});

	},

	rerun: function(){
		this.clean_up();
		this.fetch();
	},

	initialize: function(callback){

		this.check_and_store_pid();

		this.running = true;
		this.started_at = new Date();

		log("\n  PREY " + version + " spreads its wings!");
		log("  " + self.started_at)
		log("  Running on a " + os_name + " system as " + process.env['USERNAME']);
		log("  NodeJS version: " + process.version + "\n");

		if(config.device_key == ""){
			log(" -- No device key found.")
			if(config.api_key == ""){
				log(" -- No API key found! Please set up Prey and try again.")
			} else {
				Setup.auto_register(callback);
			}
		} else {
			callback();
		}

	},

	check_and_store_pid: function(){

		if(path.existsSync(pid_file)){

			var pid = parseInt(fs.readFileSync(pid_file));
			if(!isNaN(pid)) {

				log("\n -- Prey seems to be running already! PID: " + pid.toString());

				try {
					process.kill(pid, 'SIGWINCH')
					process.exit(0);
				} catch(e) {
					log(" -- Not really! Pidfile was just lying around.");
				}

			}

		}

		helpers.save_file_contents(pid_file, process.pid.toString());

	},

	check: function(){
		Check.installation();
		if(config.post_methods.indexOf('http') != -1)
			Check.http_config();
		if(config.post_methods.indexOf('smtp') != -1)
			Check.smtp_config();
	},

	check_connection: function(){

		console.log(" -- Checking connection...");
		var conn = Connection.check();

		conn.on('found', function(){
			log(" -- Connection found!");
			args.get('check') ? self.check() : self.fetch()
		});

		conn.on('not_found', function(){

			log(" !! No connection found.");
			if(config.auto_connect && self.auto_connect_attempts < config.max_auto_connect_attempts){

				self.auto_connect_attempts++;
				log(" -- Trying to auto connect...");

				os.auto_connect(setTimeout(function(){
					self.check_connection();
					}, 5000)
				);

			} else {
				log(" -- Not trying any more.");
				self.no_connection();
			}

		});

	},

	no_connection: function(){

		if(path.existsSync(tempfile_path(config.last_response_file))){
			response_body = fs.readFileSync(config.last_response_file);
			this.process(response_body, true);
		}

		quit("No connection available.")
	},

	valid_status_code: function(){
		return self.response_status == 200 || self.response_status == 404;
	},

	fetch: function(){

		log(" -- Fetching instructions...")

		var req = new Request(function(response, body){

			self.response_status = response.statusCode;
			self.response_content_type = response.headers["content-type"];

			if(!self.valid_status_code())
				quit("Unexpected status code received.")

			if(self.response_content_type.indexOf('/xml') == -1)
				quit("No valid instructions received.")

			self.process(body, false);

		})

	},

	process: function(response_body, offline){

		ResponseParser.parse(response_body, function(parsed){

			self.requested = parsed;
			self.process_main_config();

			if(!self.requested.modules || Object.keys(self.requested.modules).length == 0) {
				log(" -- No report or actions requested.");
				return false;
			}

			if(offline == false && self.requested.configuration.offline_actions)
				save_file_contents(config.last_response_file, response_body);

			self.process_module_config(function(){

				// at this point all report modules have run (if any was selected)

				debug("Traces gathered:\n" + util.inspect(self.traces));

				if (self.missing && Object.keys(self.traces).length > 0)
					self.send_report();
				else
					log(" -- Nothing to send!")

				ActionsManager.start_all();

			});

		});

	},

	process_main_config: function(){

		log(" -- Processing main config...")
		debug(self.requested);

		if(typeof(config.auto_update) == 'boolean')
			self.auto_update = config.auto_update;
		else
			self.requested.configuration.auto_update || false;

		self.missing = (self.response_status == config.missing_status_code);

		var status_msg = self.missing ? "Device is missing!" : "Device not missing. Sweet.";
		log(" -- " + status_msg);

		self.process_delay();

		if(self.on_demand == null && self.requested.configuration.on_demand_mode) self.setup_on_demand();

	},

	process_delay: function(){

		var requested_delay = self.requested.configuration.delay;

		os.check_current_delay(script_path, function(current_delay){
			debug("Current delay: " + current_delay + ", requested delay: " + requested_delay);
			if(parseInt(current_delay) != parseInt(requested_delay)){
				log(" -- Setting new delay!")
				os.set_new_delay(requested_delay, script_path);
			}
		});

	},

	process_module_config: function(send_report_callback){

		var requested_modules = self.requested.modules.module.length;
		var modules_loaded = 0;
		log(" -- " + requested_modules + " modules enabled!")

		for(id in self.requested.modules.module){

			var module_config = self.requested.modules.module[id];
			if(typeof(module_config) !== "object") continue;

//			console.log(util.inspect(module_config));

			var module_data = module_config['@'] || module_config;
			if(!module_data) continue;

			log(" -- Got instructions for " + module_data.type + " module " + module_data.name);

			delete module_config['@'];

			var module_options = {
				config: module_config,
				upstream_version: module_data.version,
				update: self.auto_update
			}

			var report_modules = [], action_modules = [];
			var loader = new ModuleLoader(module_data.name, module_options);

			loader.once('failed', function(module_name, e){
				modules_loaded++;
			});

			loader.once('loaded', function(prey_module){

				modules_loaded++;
				if(prey_module.type == 'report') {
					report_modules.push(prey_module);
				} else {
					action_modules.push(prey_module);
				}

				// we assume at least this event will be emitted once,
				// if it doesnt then it means there are no available modules
				if(modules_loaded >= requested_modules) {
					console.log(' -- Modules loaded.')
					ActionsManager.queue_many(action_modules);

					if(report_modules.length > 0) {
						Prey.run_report_modules(report_modules, send_report_callback);
					} else {
						send_report_callback();
					}

				}

			});

		}

	},

	run_report_modules: function(report_modules, send_report_callback){

		var report_modules_count = report_modules.length;
		var modules_returned = 0;

		report_modules.forEach(function(prey_module){

			prey_module.on('end', function(){

				modules_returned++;
				var modules_to_go = report_modules_count - modules_returned;

				var traces_count = Object.keys(this.traces).length;
				log(" -- [" + this.name + "] module returned, " + traces_count + " traces gathered. " + modules_to_go.toString() + " to go!");

				if(traces_count > 0) self.traces[this.name] = this.traces;

				if(modules_to_go <= 0){
					log(" ++ All modules done! Packing report...");
					send_report_callback();
				}

			});

			prey_module.run();

		});

	},

	send_report: function(){

		log(" -- Packing report!");
		var report = new Report(self.traces, self.requested.configuration);
		report.send_to(config.destinations);

	},

	setup_on_demand: function(){

		log(' -- On Demand mode enabled! Trying to connect...');
		var on_demand_host = self.requested.configuration.on_demand_host;
		var on_demand_port = self.requested.configuration.on_demand_port;
		self.on_demand = OnDemand.connect(on_demand_host, on_demand_port, config, version, function(stream){

			stream.on('event', function(event, data){
				console.log(event);
				console.log(data.msg);
				if(data.msg == 'run_prey') Prey.rerun();
			});

		});

	},

	// helpers

	clean_up: function(){
		this.traces = {};
		if(!self.running) fs.unlink(pid_file);
		log(" -- Cleaning up!");
	}

}

// sys.inherits(Prey, emitter);

var Check = {
	installation: function(){
		log(" -- Verifying Prey installation...")
	},
	http_config: function(){
		log(" -- Verifying API and Device keys...")
	},
	smtp_config: function(){
		log(" -- Verifying SMTP settings...")
	}
}

/////////////////////////////////////////////////////////////
// event handlers
/////////////////////////////////////////////////////////////

process.on('exit', function () {
	Prey.running = false;
	Prey.clean_up();
	log(" -- Have a jolly good day sir.\n");
});

//process.on('uncaughtException', function (err) {
//  log('Caught exception: ' + err);
//});

/////////////////////////////////////////////////////////////
// signal handlers
/////////////////////////////////////////////////////////////

process.on('SIGINT', function () {
	log(' >> Got Ctrl-C!');
	process.exit(0);
});

process.on('SIGUSR1', function () {
	log(' >> Received run instruction!');
	Prey.rerun();
});

/////////////////////////////////////////////////////////////
// launcher
/////////////////////////////////////////////////////////////

Prey.run();
