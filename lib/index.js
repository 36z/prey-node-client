
Prey = exports;

Prey.common     = require('./prey/common');
Prey.agent      = require('./prey/agent');
Prey.hooks      = require('./prey/hooks');
Prey.dispatcher = require('./prey/dispatcher');
Prey.providers  = require('./prey/providers');
Prey.reports    = require('./prey/reports');

Prey.utils = {};
Prey.utils.managedCache = require('./prey/utils/managed_cache');
Prey.utils.helpers = require('./prey/helpers');

Prey.err = require('./prey/utils/err');

Prey.hardware = require("./prey/plugins/providers/hardware")

Prey.loader = require('./prey/loader');


//Prey.err.setLogger(Prey.common.logger);