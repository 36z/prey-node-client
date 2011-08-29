//////////////////////////////////////////
// NodeJS Async Downloader
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//
/*
	usage:
	var dw = new Download(file, local_download_path);
	dw.on('complete', function(filename, stats){
		console.log(filename); // downloaded file
	};

	example:
	var dw = new Download('http://server.com/file.zip', '/tmp/downloads');
*/
//////////////////////////////////////////

var sys = require('sys'),
		fs = require('fs'),
		url = require('url'),
		http = require('http'),
		path = require('path'),
		util = require('util'),
		emitter = require('events').EventEmitter;

module.exports = Download;

function Download(link){

	var self = this;
	var local_path = arguments[1] || false;

	var start = function(link){
		resolve_filename(link, local_path, function(filename){
			do_fetch(link, filename)
		});
	}

	var resolve_filename = function(link, local_path, callback){

		var filename = path.basename(link);

		if(!local_path){
			callback(filename);
		} else {
			path.exists(local_path, function(exists){
				if(exists) {
					if(fs.statSync(local_path).isFile()) // file exists
						fs.unlink(local_path, function(){
							callback(local_path);
						});
					else
						callback(local_path + "/" + filename); // dir provided, no file
				}
				else {
					path.exists(path.dirname(local_path), function(exists){
						if(exists) callback(local_path);
					})
				}
			})
		}

	}

	var do_fetch = function(link, filename){

		console.log(" -- Downloading " + filename);

		var remote = url.parse(link)
		var headers = { "Host" : remote.hostname + (remote.port || "") }

		var stream = fs.createWriteStream(filename, { mode : 0755 })

		stream.on("error", function (err) {
			// console.log("Error downloading file.");
			fs.close(stream.fd, function(){
				fs.unlink(filename);
			})
			if (stream._ERROR) return;
			// self.emit('error', err);
		})

		stream.on("open", function(){
			// util.debug("Stream opened");
			fetch_and_write(remote, stream, headers)
		})

		stream.on("close", function(){
			if (stream._ERROR) return;
			// console.log("Download complete.")
			var stats = {
				bytes: 10000,
				time: 2000,
			}
			self.emit('complete', filename, stats);
		})

	}

	var fetch_and_write = function(remote, stream, headers){

		var https = remote.protocol === "https:"
		var port = remote.port || (https ? 443 : 80)

		//console.log("Sending request to " + remote.hostname + "...")

		var request = http
			.createClient(port, remote.hostname, https)
			.request("GET", remote.pathname, headers)
			.on("response", function (response) {
				// console.log(response.headers);
				// console.log("Response: " + response.statusCode);
				if (response.statusCode !== 200) {
					return stream.emit("error", new Error(response.statusCode + " " + (sys.inspect(response.headers).replace(/\s+/, ' '))))
				}
				sys.pump(response, stream)
			})
			.end()

	}

	start(link);

}

sys.inherits(Download, emitter);
