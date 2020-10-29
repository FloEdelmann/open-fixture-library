#!/usr/bin/node

/**
 * @fileoverview This script generates a set of test fixtures that cover all defined fixture features (while
 * keeping the set as small as possible) and updates tests/test-fixtures.json and tests/test-fixtures.md.
 */

const fs = require(`fs`);
const path = require(`path`);
const chalk = require(`chalk`);

const { fixtureFromRepository } = require(`../lib/model.js`);
const register = require(`../fixtures/register.json`);
const manufacturers = require(`../fixtures/manufacturers.json`);

const fixFeaturesDirectory = path.join(__dirname, `../lib/fixture-features`);
const jsonFile = path.join(__dirname, `../tests/test-fixtures.json`);
const markdownFile = path.join(__dirname, `../tests/test-fixtures.md`);


const fixFeatures = [];
const featuresUsed = {}; // feature id -> times used
for (const featureFile of fs.readdirSync(fixFeaturesDirectory)) {
  if (path.extname(featureFile) === `.js`) {
    // module exports array of fix features
    const fixFeatureFile = require(path.join(fixFeaturesDirectory, featureFile));

    for (let index = 0; index < fixFeatureFile.length; index++) {
      const fixFeature = fixFeatureFile[index];

      // default id
      if (!(`id` in fixFeature)) {
        fixFeature.id = path.basename(featureFile, `.js`);
        if (fixFeatureFile.length > 1) {
          fixFeature.id += `-${index}`;
        }
      }

      // check uniqueness of id
      if (fixFeature.id in featuresUsed) {
        console.error(`${chalk.red(`[Error]`)} Fixture feature id '${fixFeature.id}' is used multiple times.`);
        process.exit(1);
      }

      fixFeatures.push(fixFeature);
      featuresUsed[fixFeature.id] = 0;
    }
  }
}

// check which features each fixture supports
let fixtures = [];
for (const manFix of Object.keys(register.filesystem)) {
  const [manKey, fixKey] = manFix.split(`/`);

  // pre-process data
  const fix = fixtureFromRepository(manKey, fixKey);
  const fixResult = {
    man: manKey,
    key: fixKey,
    name: fix.name,
    features: [],
  };

  // check all features
  for (const fixFeature of fixFeatures) {
    if (fixFeature.hasFeature(fix)) {
      fixResult.features.push(fixFeature.id);
      featuresUsed[fixFeature.id]++;
    }
  }

  fixtures.push(fixResult);
}

// first fixtures are more likely to be filtered out, so we start with the ones with the fewest features
fixtures.sort((a, b) => {
  if (a.features.length === b.features.length) {
    return `${a.man}/${a.key}`.localeCompare(`${b.man}/${b.key}`, `en`);
  }

  return a.features.length - b.features.length;
});

// filter out
fixtures = fixtures.filter(fixture => {
  for (const feature of fixture.features) {
    // this is the only remaining fixture with that feature -> keep it
    if (featuresUsed[feature] === 1) {
      return true;
    }
  }
  // has no new features -> filter out
  for (const feature of fixture.features) {
    featuresUsed[feature]--;
  }
  return false;
});

// original alphabetic ordering
fixtures.sort((a, b) => {
  return `${a.man}/${a.key}`.localeCompare(`${b.man}/${b.key}`, `en`);
});

console.log(chalk.yellow(`Generated list of test fixtures:`));
for (const fixture of fixtures) {
  console.log(` - ${fixture.man}/${fixture.key}`);
}

fs.writeFile(jsonFile, `${JSON.stringify(fixtures, null, 2)}\n`, `utf8`, error => {
  if (error) {
    console.error(`${chalk.red(`[Fail]`)} Could not write test-fixtures.json`, error);
  }
  else {
    console.log(`${chalk.green(`[Success]`)} Updated ${jsonFile}`);
  }
});

fs.writeFile(markdownFile, getMarkdownCode(), `utf8`, error => {
  if (error) {
    console.error(`${chalk.red(`[Fail]`)} Could not write test-fixtures.md`, error);
  }
  else {
    console.log(`${chalk.green(`[Success]`)} Updated ${markdownFile}`);
  }
});

/**
 * Generates a markdown table presenting the test fixtures and all fix features.
 * @returns {String} The markdown code to be used in a markdown file.
 */
function getMarkdownCode() {
  const mdLines = [
    `# Test fixtures`,
    ``,
    `See the [fixture feature documentation](../docs/fixture-features.md). This file is automatically`,
    `generated by [\`cli/make-test-fixtures.js\`](../cli/make-test-fixtures.js).`,
    ``,
  ];

  // fixture list
  fixtures.forEach((fixture, index) => {
    mdLines.push(`${index + 1}. [*${manufacturers[fixture.man].name}* ${fixture.name}](../fixtures/${fixture.man}/${fixture.key}.json)`);
  });
  mdLines.push(``);

  // table head
  const tableHead = [`*Fixture number*`].concat(fixtures.map((fixture, index) => index + 1)).join(` | `);

  mdLines.push(tableHead);
  mdLines.push(`|-`.repeat(fixtures.length + 1));

  // table body
  const footnotes = [];
  fixFeatures.forEach((fixFeature, index) => {
    let line = `**${fixFeature.name}**`;

    if (fixFeature.description) {
      footnotes.push(fixFeature.description);
      const n = footnotes.length;
      line += ` [<sup>[${n}]</sup>](#user-content-footnote-${n})`;
    }

    for (const fixture of fixtures) {
      line += fixture.features.includes(fixFeature.id) ? ` | ✅` : ` | ❌`;
    }

    mdLines.push(line);

    // repeat table head
    if ((index + 1) % 15 === 0) {
      mdLines.push(tableHead);
    }
  });
  mdLines.push(``);

  // footnotes
  mdLines.push(`## Footnotes`, ``);
  for (const [index, footnote] of footnotes.entries()) {
    mdLines.push(`**<a id="user-content-footnote-${index + 1}">[${index + 1}]</a>**: ${footnote}  `);
  }
  mdLines.push(``);

  return mdLines.join(`\n`);
}
