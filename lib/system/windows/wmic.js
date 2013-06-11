"use strict";

/*
  wmic calls must always be serialised in windows, hence the use of async.queue
*/

var spawn = require('child_process').spawn,
    async = require('async'),
    fs    = require('fs');

var removeTmpFile = function() {
  var tmp = 'TempWmicBatchFile.bat';
  if (fs.existsSync(tmp)) {
    fs.unlinkSync(tmp);
  }
};


/**
 * Need to split a command line string taking into account strings - that is, don't
 * split spaces within a string. So that 'P1 P2 "Other Param" P4' is split into 4 param strings
 * with param 3 = "Other Param" (not including quotes).
 **/
var splitter = function(cmd) {
  cmd = cmd.trim();

  var acc = [], inString = false, cur = "", l = cmd.length;

  for (var i = 0 ; i < l ; i++ ){
    var ch = cmd.charAt(i);
    switch(ch) {
    case '"':
      inString = !inString;
      if (!inString) {
        if (cur.length > 0) {
          acc.push(cur);
          cur = "";
        }
      }
      break;
    case ' ':
      if (inString) {
        cur += ' ';
      } else {
        if (cur.length > 0) {
          acc.push(cur);
          cur = "";
        }
      }
      break;
    default:
      cur += ch;
      break;
    }
  }

  if (cur.length > 0) acc.push(cur);

  return acc;
};


var parse_list = function(data){
  
  return data.split(/\n\n|\n\r/g)
     .filter(function(block) { return block.length > 2; })
     .map(function(block) {
       return block
         .split(/\n+|\r+/)
         .filter(function(line) { return line.length > 0;})
         .reduce(function(o,line) {
           var kv = line.replace(/^,/, '').split("=");
           o[kv[0]] = kv[1];
           return o;
         },{});
     })

}

var parse_values = function(out){
  
  var obj = {};
  var data = out.toString().trim().split('\n')
               .map(function(line){
                 return line.trim().split(/\s+/);
               });

  data[0].forEach(function(k, i) {
    obj[k] = data[1][i];
  })

  return obj;
}

/**
 * Run the wmic command provided.
 *
 * The resulting output string has an additional pid property added so, one may get the process
 * details. This seems the easiest way of doing so given the run is in a queue.
 **/
var run = exports.run = function(cmd, cb) {

  var opts = {env: process.env, cwd: process.env.TEMP };
  if (opts.env.PATH.indexOf('system32') === -1) {
    opts.env.PATH += ';' + process.env.WINDIR + "\\system32";
    opts.env.PATH += ';' + process.env.WINDIR + "\\system32\\wbem";
  }

  var wm = spawn('wmic', splitter(cmd), opts),
      pid = wm.pid,
      out = [],
      err = [];

  wm.stdout.on('data', function(d) {
    // console.log('Got out: ' + d.toString())
    out.push(d);
  });

  wm.stderr.on('data', function(e) {
    // console.log('Got error: ' + e.toString())
    err.push(e);
  });

  wm.on('exit',function(code) {
    removeTmpFile();

    var e = err.toString().trim() == '' ? null : new Error(err);
    var str = out.toString().replace(/^,/, '').replace(/,\s+$/, '').trim();

    process.nextTick(function(){
      cb(e, str, pid);
    })
  });

  wm.stdin.end();

};

exports.get_value = function(section, value, condition, cb){
  var cond = condition ? ' where "' + condition + '" ' : '';
  var cmd = section + cond + ' get ' + value + ' /value';

  run(cmd, function(err, out){
    if (err) return cb(err);
    var str = out.match(/=(.*)/)[1];
    if (str)
      cb(null, str.trim());
    else
      cb(new Error("Wmic: Couldn't get " + value + " in " + section));
  })
}

exports.get_values = function(section, keys, condition, cb){
  
  var cond = condition ? ' where "' + condition + '" ' : '';
  var cmd = section + cond + ' get ' + keys;

  run(cmd, function(err, out){
    if (err) return cb(err);
    cb(null, parse_values(out));
  });
  
};


/**
 * Calls back an array of objects for the given command.
 *
 * This only works for alias commands with a LIST clause.
 **/
exports.get_list = function(cmd, callback) {
  run(cmd + ' list full', function(err, data) {    
    if (err) return callback(err);
    callback(null, parse_list(data));
  });
};
