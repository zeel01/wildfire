/* eslint-disable no-unused-vars */
/* global require exports*/
const Gulp = require("gulp");
const zip = require("gulp-zip");

function createRelease(cb) {
	return Gulp.src([
		"module.json",
		"wildfire.js",
		"wildfire.css",
		"lang/*"
	], { base: "." })
		.pipe(zip("wildfire.zip"))
		.pipe(Gulp.dest("./"));
}

exports.zip = createRelease;
exports.default = createRelease;