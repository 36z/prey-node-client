"use strict";

//////////////////////////////////////////
// Prey JS Network Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec   = require('child_process').exec,
    system = require('./../../common').system,
    sudo   = system.sudo;

var get_first_wireless_interface = function(callback){
  exports.get_wireless_interfaces_list(function(err, list) {
    if (err || !list[0])
      return callback(err || new Error('No wireless interfaces found.'));

    callback(null, list[0]);
  });
};

/**
 * Returns a list of wireless interface names (wlan0, wlan1, etc). It may be empty.
 **/
exports.get_wireless_interfaces_list = function(callback) {
  var cmd = "iwconfig 2>&1 | grep -v 'no wireless' | cut -f1 -d' ' | sed '/^$/d'";
  exec(cmd, function(err, stdout){
    if(err) return callback(err);

    var list = stdout.toString().trim();

    if (list == '')
      return callback(new Error('No wireless interfaces found.'))

    callback(null, list.split('\n'));
  });
};

/**
 * Returns the MAC address of the active access point.
 **/
exports.get_active_access_point_mac = function(callback) {
  var cmd = "iwconfig 2>&1 | grep 'Access Point' | awk '{print $6}'";
  exec(cmd, function(err, stdout){
    if (err) return callback(err);

    var raw = stdout.toString().trim();

    if (raw === '' || raw === 'dBm' || raw === "Not-Associated")
      return callback(new Error('No active access point found.'));

    callback(null, raw);
  });
};

/////////////////////////////////////////////////////////////////
// access points list fetcher and parser
/////////////////////////////////////////////////////////////////

/**
 * Gets access points list using iwlist (requires wireless-tools package).
 * @param {String} wifi_device
 **/
exports.get_access_points_list = function(callback, attempt) {

  get_first_wireless_interface(function(err, wifi_device) {
    if (err || !wifi_device)
      return callback(new Error(err || 'No wireless adapter found.'));

    sudo('/sbin/iwlist', [wifi_device, 'scan'], function(err, stdout, stderr) {
      if (!attempt || attempt < 5 && (stderr && stderr.match('resource busy'))) {
        return setTimeout(function() {
          exports.get_access_points_list(callback, (attempt || 1)+1);
        }, 3000);
      } else if (err || stdout === '') {
        return callback(err);
      }

      var list = exports.parse_access_points_list(stdout.toString());

      if (list && list.length > 0)
        callback(null, list)
      else
        callback(new Error('No access points detected.'));
    });

  });

};

exports.parse_access_points_list = function(output){
  return output.trim()
        .split(/Cell \d\d - /)
        .splice(1)
        .map(function(block) {
          return block.split(/\n/)
          .filter(function(line) { return line.trim().length > 0; })
          .reduce(function(o, line) {
            var m = line.match(/^\s*(.+?)[:|=](.*)$/);
            if (!m) {
              // logger.warn('Parser not recognising wifi output');
              return o;
            }
            switch (m[1]) {
              case "ESSID":
                o.ssid = m[2].slice(1, -1).replace(/[^\w :'-]/, ''); // remove "" and weird chars
                break;
              case "Address":
                o.mac_address = m[2].trim();
                break;
              case "Encryption key":
                o.security = (m[2].trim() === "on") ? true : false;
                break;
              case "Quality":
                o.quality = m[2].substr(0, 5);
                var signal = m[2].match(/Signal level.([0-9\/\-]*) ?dBm([^"{]*)/);
                o.signal_strength = (signal) ? parseInt(signal[1]) : null;
                // var noise = m[2].match(/Noise level.([0-9\/\-]*) ?dBm([^"{]*)/);
                // o.noise_level = (noise) ? noise[1] : null;
                break;
              case "IE":
                if (o.security === true && m[2].indexOf('Unknown') === -1) {
                  o.security = m[2].replace('IEEE 802.11i/', '').trim();
                }
                break;
            }
            return o;
          }, { security: false });
        });
};
