var Command = require('command');
var fs = require('fs');

exports.run_cmd = function(cmd, callback){

	cmd = new Command(cmd);
	cmd.on('return', function(output){
		callback(output);
	});

};

exports.get_logged_user = function(){

	exports.run_cmd(os.get_logged_user_cmd, function(user_name){
		GLOBAL.logged_user = user_name.first_line();
	});

}

exports.tempfile_path = function(filename){

	return os.temp_path + '/' + filename;

};

exports.save_file_contents = function(file_name, data){

	fs.writeFile(file_name, data, function (err) {
		if (err) throw err;
		// console.log(' -- File saved: ' + file_name);
	});

};

exports.replace_in_file = function(file_name, from, to){

	fs.readFile(file_name, function (err, data) {
		if (err) throw err;
		var new_data = data.toString().replace(from, to);
		if(new_data != data) exports.save_file_contents(file_name, new_data)
	});

};
