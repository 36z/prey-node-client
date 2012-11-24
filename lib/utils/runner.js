#!/usr/bin/env node

// This script lets us call programs as a local user rather than root.
// Usage: ./runner.js [user_name] [command] [arg1] [arg2] [arg3]

var spawn = require('child_process').spawn,
    args = process.argv;

args.shift() && args.shift();

var run_as = args.shift(),
    command = args.shift();

if (!run_as) {
  console.log('Usage: runner.js [user_name] [command] <args>');
  process.exit(1);
}

// console.log('Current uid: ' + process.getuid());

try {
  process.setuid(run_as);
  // console.log('New uid: ' + process.getuid());
} catch (err) {
  console.log('Failed to set uid: ' + err);
}

console.log("Running " + command + " with uid " + process.getuid());

var opts = { env: process.env }

if (process.platform == 'linux')
  opts.env.DISPLAY = ':0'; // so it uses active display

var child = spawn(command, args, opts);

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on('exit', function(code){
	process.exit(code);
})
