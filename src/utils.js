const { spawnSync } = require('child_process');

function exec(cmd, args, stdio) {
	let { error, status, stdout } = spawnSync(cmd, args.split(' '), {
		encoding: 'utf8',
		stdio,
	});
	if (error) {
		console.log(error.stack);
		status = 1;
	}
	if (status) {
		process.exitCode = status;
	}
	return stdout;
}

exports.git = function git(args) {
	return exec('git', args, 'pipe');
};

exports.gitMultilineResults = function gitMultilineResults(args) {
	return exports
		.git(args)
		.split('\n')
		.filter((line) => !!line);
};

exports.toTitleCase = function toTitleCase(str) {
	return str.replace(/\w\S*/g, function (txt) {
		return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
	});
};
