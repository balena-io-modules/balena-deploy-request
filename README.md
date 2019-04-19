# balena-deploy-request

A simple script for generating deploy requests along with release notes.

This is an attempt to automate a bit the process of preparing a deploy
request along with its release notes and also standardize their format
while following the balena process guidelines.

This is designed to work on repositories that:
* are VersionBot enabled
* are top level components that require deploy requests and get
  `production` & `production-*` tags

## Get started

1. Navigate to the repository folder of a top level component.
2. Checkout the commit with the version tag & commit title (eg: v2.0.0) that you are interested at getting deployed.
3. Run `npx balena-deploy-request` to get a skeleton for the deploy request & the release notes.
4. Fill the cc list with the usernames of everyone that has commits in this release.
5. Rewrite the "Notable changes" section to be more compact and only include the important changes.
6. Post the deploy request (1st message).
7. In the same thread post the release notes (2nd message).
