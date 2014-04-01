var common       = require('./../../common'),
    hooks        = require('./../../hooks'),
    config       = common.config,
    logger       = common.logger.prefix('push'),
    push_api     = common.api.push,
    server       = require('./server'),
    entry        = require('entry'),
    mapper       = require('./mapper'),
    scrambler    = require('./../../../utils/scrambler'),
    createHash   = require('crypto').createHash,
    Emitter      = require('events').EventEmitter;

var secret,
    emitter,
    is_mapping,
    mapped_port,
    public_ip,
    last_nid,
    service_desc = 'Prey Anti-Theft',
    port_start   = 30300;

var ip_checker; // timer

var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

var random_string = function(length){
  return Math.random().toString(36).substr(2, length);
}

var map_port = function(port, cb){
  var opts = {
    starting : port,
    internal : port,
    name: service_desc
  }

  logger.info('Attempting to map external port ' + port);
  mapper.map(opts, cb);
};

var send_notification_id = function(str, cb) {

  var data = { notification_id: str };
  logger.info('Updating notification ID...');

  push_api.data(data, {}, function(err, resp, body) {
    var success = resp && resp.statusCode < 300;
    if (success) last_nid = str;

    logger.info('Notification ID update status: ' + success);
    cb && cb(success ? null : new Error('Unable to send notification ID.'));
  });

}

var update_notification_id = function(cb){

  mapper.public_ip(function(err, ip) {
    if (err) return cb(err);

    public_ip     = ip;
    secret        = random_string(12);
    var str       = ip + ':' + mapped_port + '-' + secret;
    var scrambled = scrambler.encrypt(str, config.get('api_key'));
    send_notification_id(scrambled, cb);
  });

};

var notify_pushable = function(cb) {
  update_notification_id(function(err) {
    if (err) return stop(err, cb);

    hooks.trigger('reachable');
    logger.info('Ready to receive push notifications.');
    cb && cb();
  });
}


var valid_secret = function(str) {
  if (!str || str == '')
    return;

  return str == secret;
  // return scrambler.decrypt(str, config.get('api_key')) == secret;
}

// called from load method once we have a mapped port
var mapped = function(port, cb) {

  mapped_port = port;
  logger.info('Port ' + port + ' mapped. Starting push handler.');

  server.listen(port, function(err, app) {
    if (err) return cb ? cb(err) : unload(err);

    app.on('request', function(headers, body) {
      if (!valid_secret(headers['x-secret']))
        return;

      logger.warn('Got valid push request!');

      if (body.command == 'run_once')
        hooks.trigger('woken');
      else
        emitter.emit('command', body);
    });

    // if notify fails, callback will not be called
    notify_pushable(function() {
      watch_public_ip();
      cb && cb();
    })

  });

};

var watch_public_ip = function() {

  ip_checker = setInterval(function() {
    mapper.public_ip(function(err, ip) {
      // console.log(err || ip);

      // if we couldnt get an IP (no UPNP)
      // or the IP changed, notify the server
      if (err || ip != public_ip)
        notify_pushable();
    })
  }, 5 * 60 * 1000); // check if public ip changed every 5 minutes

}

var find_mapping = function(cb) {
  logger.info('Checking for existing mappings...');

  var found;
  entry.mine(function(err, list) {

    if (err) {
      var e = err.message.match('Could not locate gateway') ? null : err;
      return cb(e);
    }

    list.forEach(function(mapping) {
      if (mapping.NewPortMappingDescription.match(service_desc))
        found = mapping;
    });

    cb(null, found);
  })
};

var check_mapping = function(cb) {

  if (mapped_port || is_mapping)
    return cb && cb();

  var done_with_error = function(err) {
    hooks.trigger('error', err);
    logger.error('Unable to map port: ' + err.message);
    return cb ? cb(err) : stop(err);
  }

  is_mapping = true;
  find_mapping(function(err, mapping) {
    is_mapping = false;
    if (err) return done_with_error(err);

    if (mapping) {

      logger.info('Found existing mapping! Using port ' + mapping.NewExternalPort);
      mapped(mapping.NewExternalPort, cb);

    } else { // not mapped or mapped to someone else

      var key  = config.get('device_key'),
          port = port_start + chars.split('').indexOf(key[0]);

      map_port(port, function(err, port) {
        if (err) return done_with_error(err);
        mapped(port, cb);
      })

    }

  });
}

var stop = function(){
  logger.warn('Turning off push notifications.')

  if (server)
    server.stop();

  if (ip_checker)
    clearTimeout(ip_checker);

  is_mapping = false;
  hooks.trigger('unreachable');

  if (!mapped_port)
    return;

  logger.info('Unmapping port ' + mapped_port + ' in router.');

  mapper.unmap(function(err) {
    logger.info(err && err.message || 'Succesfully unmapped.');
  });

  mapped_port = null;
}

var unload = function(err) {
  if (err)
    logger.error('Unloading due to error: ' + err.message);

  // reset notification id, if we were able to send it
  if (last_nid && last_nid != '')
    send_notification_id('');

  stop();

  hooks.remove('connected', check_mapping);
  hooks.remove('disconnected', stop);
  emitter.emit('unload', err);
};

exports.load = function(opts, cb){
  hooks.on('connected', check_mapping);
  hooks.on('disconnected', stop);

  emitter = new Emitter();
  cb(null, emitter);
}

exports.unload = function(cb) {
  unload();
  cb && cb();
}
