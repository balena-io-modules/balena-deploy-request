const fs = require('fs');
const { git, gitMultilineResults, toTitleCase } = require('./utils');

let packageName = process.argv[2];
if (!packageName) {
	try {
		packageName = JSON.parse(fs.readFileSync('./package.json').toString()).name;
	} catch (e) {
		console.error(
			`No 'package.json' found, you can manually specify a package name as the first argument`,
		);
		process.exit(1);
	}
}

const packageNameAliases = {
	'balena.io': 'balena-api',
};

packageName = packageNameAliases[packageName] || packageName;

const moduleAliases = {
	'resin-ui': 'dashboard',
};

const moduleName =
	moduleAliases[packageName] ||
	packageName.replace('resin-', '').replace('balena-', '');

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
	).filter((line) => line.match(/^v/))[0];
	if (!latestProdVersionTag) {
		// for VB v1 tags
		latestProdVersionTag = gitMultilineResults(
			`log ${latestProdTag} --skip 1 -n 1 --pretty=tformat:%s`,
		).filter((line) => line.match(/^v/))[0];
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
).filter((line) => line.match(/^[+-]/) && !line.match(/^--- a\/|[+]{3} b/));

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

const changelog = rawChangelog.map((l) => l.replace(/^\+/, ''));

const notableChanges = [];
for (const l of changelog) {
	// Pick up to 1 level of nested changes
	const match = l.match(
		/^((?<nesting>[>]{1,2}) )?(\*|<summary>) (?<change>\w[^<]+)( <\/summary>)?$/,
	);
	if (
		match != null &&
		!match.groups.change.startsWith('Update dependencies [')
	) {
		notableChanges.push(
			`* ${match.groups.nesting ?? ''}${match.groups.change}`,
		);
	}
}

const result = [
	`# ${toTitleCase(packageName)} #release-notes ${date}`,
	'',
	`The ${moduleName} has been updated from ${oldVersion} to ${newVersion}`,
	'',
	'Notable changes',
	'* [only keep the important and rephrase]',
	...notableChanges,
	'',
	'<details><summary>Expand changelog</summary>',
	'',
	...changelog,
	'</details>',
];

console.log(result.join('\n'));
