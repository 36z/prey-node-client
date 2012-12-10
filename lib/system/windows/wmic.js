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

var queue = async.queue(function(cmd, callback) {

  var wm = spawn('wmic', splitter(cmd)),
    pid = wm.pid,
    all = '',
    err;

  wm.stdout.on('data',function(d) {
    all += d;
  });

  wm.stderr.on('data',function(e) {
    err = e;
  });

  wm.on('exit',function() {
    removeTmpFile();
    // add a pid to the output string object
    callback(err,{data: all, pid: pid});
  });

  wm.stdin.end();

},1);


/**
 * Run the wmic command provided.
 *
 * The resulting output string has an additional pid property added so, one may get the process
 * details. This seems the easiest way of doing so given the run is in a queue.
 **/
var run = exports.run = function(cmd, cb) {
  queue.push(cmd, function(err, out) {
    cb(err, out.data, out.pid);
  });
};

exports.extractValue = function(str) {
  return (/\s+(\S*)/).exec(str)[1];
};

/**
 * Calls back an array of objects for the given command.
 *
 * This only works for alias commands with a LIST clause.
 **/
exports.list_full = function(cmd, callback) {
  cmd = cmd + ' list full';
  run(cmd,function(err, data) {
    if (err) return callback(_error("!:"+cmd,err));

    callback(null,data.split(/\n\n|\n\r/g)
       .filter(function(block) { return block.length > 2; })
       .map(function(block) {
         return block
           .split(/\n+|\r+/)
           .filter(function(line) { return line.length > 0 ;})
           .reduce(function(o,line) {
             var kv = line.split("=");
             o[kv[0]] = kv[1];
             return o;
           },{});
       }));
  });
};
