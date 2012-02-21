var common = require('./../lib/prey/common').load_config();
var on_demand = require('./../lib/prey/plugins/drivers/on-demand');
var Prey = require('./../lib/prey/agent');

process.env.DEBUG = true;

var options = {
	host: 'localhost',
	port: 9000,
	key: 'xxx',
	group_key: '503030303'
}

Prey.load_action_hooks();
Prey.load_driver(process.argv[2]);
