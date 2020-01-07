const fs = require('fs');
const { git, gitMultilineResults, toTitleCase } = require('./utils');

let packageName;
try {
	packageName = JSON.parse(fs.readFileSync('./package.json').toString()).name;
} catch (e) {
	console.error('No `package.json` found, aborting!');
	process.exit(1);
}

const packageNameAliases = {
	'balena.io': 'resin-api',
};

packageName = packageNameAliases[packageName] || packageName;

const moduleAliases = {
	'resin-ui': 'dashboard',
};

const moduleName =
	moduleAliases[packageName] ||
	packageName.replace('resin-', '').replace('balena-', '');

function getCodeowners() {
	// git ls-files '*CODEOWNERS'
	// * @user1 @user2
	let codeownerSet = new Set();
	const codeownersFiles = gitMultilineResults('ls-files *CODEOWNERS');
	codeownersFiles.forEach(function(file) {
		codeownerLine = fs
			.readFileSync(file)
			.toString()
			.toLowerCase()
			.split('\n')
			.filter(n => n && !n.startsWith('#'));
		codeownerLine.forEach(function(owner) {
			owner
				.split(/\s+/)
				.slice(1)
				.filter(n => n)
				.forEach(function(user) {
					codeownerSet.add(user);
				});
		});
	});
	return Array.from(codeownerSet);
}

function getLatestProdInfo() {
	const tags = gitMultilineResults('tag -l --sort=refname production-*');
	if (tags.length === 0) {
		console.error('No `production*` tags found, cannot compute changelog');
		process.exit(1);
	}
	let latestProdTag = tags[tags.length - 1];

	// if the current commit has the production tag skip it
	const currentCommitHash = git('rev-list -n 1 HEAD');
	const latestProdTagCommitHash = git(`rev-list -n 1 ${latestProdTag}`);

	if (currentCommitHash === latestProdTagCommitHash) {
		latestProdTag = tags[tags.length - 2];
	}

	let latestProdVersionTag = gitMultilineResults(
		`log ${latestProdTag} --skip 0 -n 1 --pretty=tformat:%s`,
	).filter(line => line.match(/^v/))[0];
	if (!latestProdVersionTag) {
		// for VB v1 tags
		latestProdVersionTag = gitMultilineResults(
			`log ${latestProdTag} --skip 1 -n 1 --pretty=tformat:%s`,
		).filter(line => line.match(/^v/))[0];
	}
	return {
		latestProdTag,
		latestProdVersionTag,
	};
}

const latestProdInfo = getLatestProdInfo();
const prevVersionTag = latestProdInfo.latestProdVersionTag;

const rawChangelog = gitMultilineResults(
	`diff -U0 ${prevVersionTag} CHANGELOG.md`,
).filter(line => line.match(/^[+-]/) && !line.match(/^--- a\/|[+]{3} b/));

const CHANGELOG_VERSION_REGEX = /#?#\W+v?(\d+\.\d+\.\d+)/;
const newVersionMatchGroups =
	rawChangelog[0].match(CHANGELOG_VERSION_REGEX) ||
	rawChangelog[1].match(CHANGELOG_VERSION_REGEX);
if (!newVersionMatchGroups || !newVersionMatchGroups[1]) {
	console.error(`Couldn't find latest non-prod version!`);
	console.error('rawChangelog', rawChangelog);
	console.error('newVersionMatchGroups', newVersionMatchGroups);
	return;
}

let oldVersion = prevVersionTag;
if (oldVersion[0] !== 'v') {
	oldVersion = `v${oldVersion}`;
}

const newVersion = `v${newVersionMatchGroups[1]}`;

const date = new Date().toISOString().match(/\d+-\d+-\d+/)[0];

const changelog = rawChangelog.map(l => l.replace(/^\+/, ''));

const codeowners = getCodeowners();
let ccList = [''];
if (codeowners.length) {
	ccList = ['codeowners:'].concat(codeowners);
}

const notableChanges = changelog
	.filter(l => l.match(/^\* /))
	.map(l => l.replace(/ \[.+\]$/, ''));

const result = [
	'================================ Deploy request ================================',
	'',
	`#devops please deploy #${packageName} ${newVersion} to production`,
	`@@devops`,
	`CODEOWNERS: ${ccList.join(' ')}`,
	'',
	'================================ Release notes =================================',
	'',
	`#release-notes #${packageName}`,
	`# ${toTitleCase(packageName)} release notes ${date}`,
	'',
	`The ${moduleName} has been updated from ${oldVersion} to ${newVersion}`,
	'',
	'Notable changes',
	'* <only keep the important and rephrase>',
	...notableChanges,
	'',
	...changelog,
	'',
	'================================================================================',
];

console.log(result.join('\n'));
