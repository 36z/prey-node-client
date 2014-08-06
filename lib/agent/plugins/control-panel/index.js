var setup    = require('./setup'),
    sender   = require('./sender'),
    api      = require('./api'),
    prompt   = require('./prompt'),
    bus      = require('./bus');

var adapters = {
    interval : require('./interval'),
    push     : require('./push')
}

var common,
    hooks,
    logger,
    config,
    commands;

var init_api = function(opts, cb) {
  api.use({
    host     : opts.host,
    protocol : opts.protocol
  })

  if (!cb) return;

  // if a callback was passed, then the called
  // expects the keys to be set as well.
  api.keys.set({
    api: opts.api_key,
    device: opts.device_key
  }, cb);
}

var wait_for_config = function() {
  logger.warn('Not configured. Waiting for user input...');
  var attempts = 0;

  var timer = setInterval(function() {
    logger.info('Reloading config...');
    config.reload();

    if (config.get('api_key')) {
      clearInterval(timer);
      boot()
    } else if (++attempts > 12) { // two mins total
      throw new Error('Not configured. Stopping.');
    }
  }, 10000); // 10 seconds
}

function boot(cb) {
  load_hooks();
  sync();
  load_adapter('interval');
  load_adapter('push', function(err) {
    if (err) hooks.trigger('error', err);
    cb && cb();
  })
}

function load_hooks() {
  // main agent hooks
  hooks.on('action',   sender.notify_action)
  hooks.on('event',    sender.notify_event)
  hooks.on('data',     sender.send_data)
  hooks.on('report',   sender.send_report)

  // this is triggered from this own plugin's sender module
  bus.on('response', handle_response)
}

function handle_response(what, err, resp) {
  if (what == 'report' && resp.statusCode > 300)
    found();
  else if (resp.headers['X-Prey-Commands'])
    commands.process(resp.body);
}

function sync() {
  api.devices.get.status(function(err, result) {
    if (!result || (result && result.statusCode > 300))
      return;

    if (err)
      return setTimeout(sync, 10000);

    if (result.settings)
      config.update(result.settings)

    if (result.status == 'missing')
      missing()
  })
}

function load_adapter(name, cb) {
  adapters[name].load.call(common, function(err, emitter){
    cb && cb(err);

    if (!emitter) return;
    emitter.on('woken', adapters.interval.check);
    emitter.on('command', commands.perform);
  });
}

function missing(interval) {
  logger.info('Holy mother of satan! Device seems to be missing!');
  var interval = interval || 20;
  commands.perform(commands.build('report', 'stolen', { interval: interval }));
}

function found() {
  logger.info('Device no longer missing.');
  commands.perform(commands.build('cancel', 'stolen'))
}

/////// exports

exports.setup = function(cb) {
  // we need to comment this out, as it prevents the 'config account setup --force'
  // option to work. normally this plugin will not be enabled via 'config plugins enable foo'
  // so let's just leave it out for now. plugin fiddlers can manage. :)

  // if (this.config.get('api_key'))
  // return cb();

  init_api(this.config.all());
  prompt.start(function(err, key) {
    if (err) return cb(err);

    cb(null, { api_key: key });
  })
}

// called from conf module after plugin is setup
// calls setup to ensure device is linked.
exports.enabled = function(cb) {
  init_api(this.config.all());
  setup.start(this, cb);
}

// called when plugin is disabled, either via the plugin manager
// or when the running the pre_uninstall hooks.
exports.disabled = function(cb) {
  var config = this.config;

  init_api(this.config.all(), function(err) {
    if (err) return cb(); // keys are missing, so just return

    api.devices.unlink(function(err) {
      // only return if we had a non-key related error
      var failed = err && (err.code != 'MISSING_KEY' && err.code != 'INVALID_CREDENTIALS');
      if (failed)
        return cb(err);

      // ok, so device was unlinked. let's clear the device key but NOT 
      // the API key. that way, if we're upgrading via a package manager 
      // (e.g. apt-get) we don't lose scope of the user's account API key. 
      // so whenever the post_install hooks are called and the agent is 
      // called, it will automatically relink the device to the account.

      // config.set('api_key', '');
      config.set('device_key', '');
      config.save(cb);
    });
  });
}

exports.load = function(cb) {
  common   = this;
  hooks    = common.hooks;
  logger   = common.logger;
  config   = common.config;
  commands = common.commands;

  if (!config)
    return cb && cb(new Error('No config object.'))

  init_api(common.config.all());
  sender.init(common);

  setup.start(common, function(err) {
    if (!err)
      return boot(cb);

    if (!common.helpers.running_on_background())
      cb && cb(err); // throw err;
    else
      wait_for_config();
  })
}

exports.unload = function(cb) {
  adapters.interval.unload.call(common);
  adapters.push.unload.call(common, cb);
}

// export API for conf module
exports.load_api = function(opts) {
  init_api(opts);
  return api;
};
