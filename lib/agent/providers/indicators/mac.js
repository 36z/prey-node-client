var exec = require('child_process').exec;

// when battery is charging, time remaining is actually
// what remains until the battery is full.
exports.get_battery_info = function(callback){

  var cmd = 'pmset -g batt';

  exec(cmd, function(err, stdout, stderr){
    if (err) return callback(err);

    var output = stdout.toString();

    try {
      var percentage_remaining = output.match(/(\d+)%;/)[1];
      var st = output.match(/%;\s+(\w+)/)[1];
      var state;

      if (st == "charged") {
        state = "Connected";
      }
      else if (st == "charging") {
        state = "Charging";
      }
      else if (st == "discharging") {
        state = "Discharging";
      }
      else {
        state = "Critical";
      }

      if (time_value = output.match(/;\s+(\d+:\d+)/))
        var time_remaining = time_value[1];
    }
    catch (err) {
      percentage_remaining = 0;
      time_remaining = 0;
      state = "Not present";
    }

    var data = {
      percentage_remaining: percentage_remaining,
      time_remaining: time_remaining,
      state: state
    }

    callback(null, data);

  });


};
