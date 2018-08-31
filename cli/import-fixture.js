#!/usr/bin/node

const path = require(`path`);
const minimist = require(`minimist`);
const promisify = require(`util`).promisify;
const readFile = promisify(require(`fs`).readFile);

const { checkFixture } = require(`../tests/fixture-valid.js`);
const plugins = require(`../plugins/plugins.json`);
const fixtureJsonStringify = require(`../lib/fixture-json-stringify.js`);
const createPullRequest = require(`../lib/create-github-pr.js`);

const args = minimist(process.argv.slice(2), {
  string: `p`,
  boolean: `c`,
  alias: {
    p: `plugin`,
    c: `create-pull-request`
  }
});

const filename = args._[0];

if (args._.length !== 1 || !plugins.importPlugins.includes(args.plugin)) {
  console.error(`Usage: ${process.argv[1]} -p <plugin> [--create-pull-request] <filename>\n\navailable plugins: ${plugins.importPlugins.join(`, `)}`);
  process.exit(1);
}

readFile(filename)
  .then(buffer => {
    const plugin = require(path.join(__dirname, `../plugins`, args.plugin, `import.js`));
    return plugin.import(buffer, filename);
  })
  .then(result => {
    result.errors = {};

    for (const key of Object.keys(result.fixtures)) {
      const [manKey, fixKey] = key.split(`/`);

      const checkResult = checkFixture(manKey, fixKey, result.fixtures[key]);

      result.warnings[key] = result.warnings[key].concat(checkResult.warnings);
      result.errors[key] = checkResult.errors;
    }

    if (args[`create-pull-request`]) {
      createPullRequest(result)
        .then(pullRequestUrl => console.log(`URL: ${pullRequestUrl}`))
        .catch(error => {
          console.log(fixtureJsonStringify(result));
          console.error(`Error creating pull request: ${error.message}`);
        });
    }
    else {
      console.log(fixtureJsonStringify(result));
    }
  })
  .catch(error => {
    console.error(`Error parsing '${filename}'.\n${error.toString()}`);
    process.exit(1);
  });
