var bus    = require('../bus'),
    api    = require('./../api'),
    getter = api.devices.get.commands;

var hooks,
    logger,
    loaded;

var timer,
    emitter,
    current_delay,
    default_delay = 20 * 1000 * 60, // 20 min
    short_delay   = 0.5  * 1000 * 60; //  30 secs

var parse_cmd = function(str) {
  try {
    return JSON.parse(str);
  } catch(e) {
    //
  }
}

var request = function() {
  getter(function(err, resp) {
    if (err)
      return hooks.trigger('error', err, 'interval');
    else if (resp.statusCode != 200)
      return hooks.trigger('error', new Error('Invalid response received: ' + resp.statusCode));

    if (resp.body.length && resp.body.length > 0)
      logger.warn('Got ' + resp.body.length + ' commands.');

    resp.body.forEach(function(el) {
      var cmd = el.target ? el : parse_cmd(el);
      hooks.trigger('command', cmd);
    })
  })
}

var load_hooks = function() {
  // whenever we're woken or device connects, send a request
  hooks.on('woken', request);
  hooks.on('connected', request);

  // whenever reachable state changes, hasten or slowen
  bus.on('reachable', set_interval);
  bus.on('unreachable', set_faster_interval);

  loaded = true;
}

// set timer to check on intervals
var set_interval = function(delay) {
  if (!loaded) return;
  if (!delay) delay = default_delay;

  if (delay == current_delay) return;
  current_delay = delay;

  logger.info('Queueing check-ins every ' + delay/60000 + ' minutes.');
  if (timer) clearInterval(timer);
  timer = setInterval(request, delay);
}

var set_faster_interval = function() {
  set_interval(short_delay);
}

var unload = function(err) {
  if (err)
    logger.error('Failed, unloading: ' + err.message);

  hooks.remove('woken', request);
  hooks.remove('connected', request);
  if (timer) clearInterval(timer);

  loaded = false;
}

exports.load = function() {
  var common = this;
  hooks  = common.hooks;
  logger = common.logger;

  load_hooks();
  set_interval();
  // request();
}

exports.unload = function() {
  if (!hooks) return; // not loaded yet.
  unload();
}
