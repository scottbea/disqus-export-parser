var _ = require('underscore');
var parseString = require('xml2js').parseString;
var pretty = require('pretty-data').pd;
var fs = require('fs');
var url = require('url');


function Xml2Object(xml, cb) {
	try {
		parseString(xml, {explicitArray: false, mergeAttrs: false, attrkey: 'a'}, function (err, obj) {
			cb(err, obj);
		});
	}
	catch (e) {
		console.dir(e);
		cb(e, null);
	}
};

function parseThreads(obj, buffer) {
	var threadTable = {};
	var type = "thread";

	var rootElement = obj["disqus"] || {};

	// Parse categories
	var category = rootElement.category;

	// Parse threads
	var threads = rootElement.thread || [];
	for (var i = 0; i < threads.length; i++) {
		var thread = threads[i];

		thread.objectId = thread.a["dsq:id"];
		thread.categoryId = thread.category.a["dsq:id"];
		thread.authorEmail = ((thread.author || {}).email || "").replace(/ /g, "_");;
		thread.authorName = ((thread.author || {}).name || "").replace(/ /g, "_");;
		thread.createdDate = new Date(thread.createdAt);
		thread.year = thread.createdDate.getFullYear();
		thread.month = thread.createdDate.getMonth() + 1;
		thread.day = thread.createdDate.getDate();
		thread.message = (thread.message || "").replace(/\t/g, " ");
		thread.title = (thread.title || "").replace(/\t/g, " ");
		thread.categoryTitle = ((thread.category || {}).title || "").replace(/\t/g, " ");
		thread.isSpam = "non-spam";

		var linkObject = url.parse(thread.link);
		thread.host = linkObject.hostname;
		thread.pathname = linkObject.pathname;

		var linkPathSegments = _.compact(thread.pathname.split('/'));
		thread.linkLanguage = (["es", "pt"].indexOf(linkPathSegments[0]) >= 0) ? linkPathSegments.shift() : "en";
		thread.linkSeg1 = linkPathSegments.shift() || "";
		thread.linkSeg2 = linkPathSegments.shift() || "";
		thread.linkSeg3 = linkPathSegments.shift() || "";
		thread.linkSeg4 = linkPathSegments.shift() || "";
		thread.linkSeg5 = linkPathSegments.shift() || "";

		if (_.isFinite(thread.linkSeg2)) {
			thread.linkSeg2 = "N" + thread.linkSeg2;
		}

		threadTable[thread.objectId] = thread;

		if (_.isArray(buffer)) {
			buffer.push([
				type,
				thread.objectId,
				thread.id,
				thread.forum,
				thread.categoryId,
				thread.categoryTitle,
				thread.link,
				thread.title,
				thread.message,
				thread.createdAt,
				thread.authorEmail,
				thread.authorName,
				thread.isAnonymous,
				thread.username,
				thread.ipAddress,
				thread.isClosed,
				thread.isDeleted,
				thread.isSpam,
				thread.year,
				thread.month,
				thread.day,
				thread.host,
				thread.pathname,
				thread.linkLanguage,
				thread.linkSeg1,
				thread.linkSeg2,
				thread.linkSeg3,
				thread.linkSeg4,
				thread.linkSeg5
			].join('\t'));
		}
	}
	return threadTable;
}

function parsePosts(obj, threadTable, buffer) {
	var rootElement = obj["disqus"] || {};
	var type = "post";

	// Parse threads
	var posts = rootElement.post || [];
	for (var i = 0; i < posts.length; i++) {
		var post = posts[i];

		post.objectId = post.a['dsq:id'];
		post.authorEmail = ((post.author || {}).email || "").replace(/ /g, "_");
		post.authorName = ((post.author || {}).name || "").replace(/ /g, "_");
		post.isAnonymous = (post.isAnonymous || {}).isAnonymous;
		post.threadId = post.thread.a['dsq:id'];
		post.message = (post.message || "").replace(/\t/g, " ");
		post.isSpam = (post.isSpam == "true") ? "spam" : "non-spam";

		var thread = threadTable[post.threadId] || {};
		post.thread = thread;

		post.createdDate = new Date(post.createdAt);
		post.year = post.createdDate.getFullYear();
		post.month = post.createdDate.getMonth() + 1;
		post.day = post.createdDate.getDate();

		if (_.isArray(buffer)) {
			buffer.push([
				type,
				post.objectId,
				post.id,
				post.thread.forum,
				post.thread.categoryId,
				post.thread.categoryTitle,
				post.thread.link,
				post.thread.title,
				post.message,
				post.createdAt,
				post.authorEmail,
				post.authorName,
				post.isAnonymous,
				"",
				post.ipAddress,
				post.thread.isClosed,
				post.isDeleted,
				post.isSpam,
				post.year,
				post.month,
				post.day,
				post.thread.host,
				post.thread.pathname,
				post.thread.linkLanguage,
				post.thread.linkSeg1,
				post.thread.linkSeg2,
				post.thread.linkSeg3,
				post.thread.linkSeg4,
				post.thread.linkSeg5
			].join('\t'));
		}
	}
}

exports.cli = function () {
	// get the parameters
	var filename = process.argv[2];
	var mode = process.argv[3] || "json";
	var outputFilename = process.argv[4];

	// Check parameters and usage
	if (process.argv.length <= 2) {
		console.log("\nUsage: disqus-export-parser <filename> [<json|pretty|tsv>] [<output_filename>]\n\n");
		process.exit(1);
	}

	// If JSON then output pretty json
	exports.convert(filename, mode, outputFilename);
};

exports.parse = function (inputFileName, mode, cb) {

	// Read the file
	var xml = fs.readFileSync(inputFileName);

	// If JSON then output pretty json
	var buffer;

	if (mode == "tsv") {
		buffer = [];
		// Write out the headers
		buffer.push("type\tobjectId\tid\tforum\tcategoryId\tcategory.title\tlink\ttitle\tmessage\tcreatedAt\tauthorEmail\tauthorName\tisAnonymous\tusername\tipAddress\tisClosed\tisDeleted\tisSpam\tyear\tmonth\tday\thost\tpathname\tlinkLanguage\tlinkSeg1\tlinkSeg2\tlinkSeg3\tlinkSeg4\tlinkSeg5");
	}

	try {
		Xml2Object(xml, function (err, obj) {
			var threadTable = {};

			try {
				threadTable = parseThreads(obj, buffer);
			} catch (e) {
				console.log(e);
			}

			try {
				parsePosts(obj, threadTable, buffer);
			} catch (e) {
				console.log(e);
			}

			if (obj) {
				if ((mode == "object") || _.isUndefined(mode)) {
					buffer = obj;
				}
				else if (mode == "json") {
					buffer = JSON.stringify(obj);
				}
				else if (mode == "pretty") {
					buffer = pretty.json(obj);
				}
				else {
					buffer = buffer.join('\n');
				}
			}

			if (cb) {
				cb(err, buffer);
			}
			else {
				return buffer;
			}
		});
	}
	catch (e) {
		console.log(e);
	}
};

exports.convert = function (inputFileName, mode, outputFileName, cb) {
	// Read the file
	exports.parse(inputFileName, mode, function(err, buffer) {
		if (outputFileName) {
			fs.writeFileSync(outputFileName, buffer);
		}
		else {
			console.log(buffer);
		}

		if (cb) {
			cb(err, buffer);
		}
	});
};

