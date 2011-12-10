var opts = require('opts');

function parse(version){

	var options = [
			{ short       : 'v'
			, long        : 'version'
			, description : 'Show version and exit'
			, callback    : function() { console.log(version); process.exit(1); }
			},
			{ short       : 'c'
			, long        : 'check'
			, description : 'Run Prey in check mode'
			},
			{ short       : 'd'
			, long        : 'debug'
			, description : 'Output debugging info'
			, callback    : function() { process.env.DEBUG = true; }
			},
		];

	opts.parse(options, true);
	return opts;

}

exports.parse = parse;
