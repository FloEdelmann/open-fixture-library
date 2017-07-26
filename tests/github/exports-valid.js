#!/usr/bin/node

const colors = require('colors');

const Fixture = require('../../lib/model/Fixture.js');
const pullRequest = require('./pull-request');

const plugins = require('../../plugins/plugins.js');
const testFixtures = require('../test-fixtures.json').map(
  fixture => `${fixture.man}/${fixture.key}`
);

pullRequest.init()
.then(prData => {
  return pullRequest.fetchChangedComponents()
})
.then(changedComponents => {
  let validateTasks = [];

  if (changedComponents.added.model ||
      changedComponents.modified.model ||
      changedComponents.removed.model) {
    validateTasks.push({
      type: 'model'
    });
  }
  else {
    const plugins = changedComponents.added.exports.concat(changedComponents.modified.exports);
    validateTasks = validateTasks.concat(plugins.map(plugin => ({
      type: 'plugin',
      plugin: plugin
    })));

    // only tests that are not covered by plugin tasks (which run all tests)
    const exportTests = changedComponents.added.exportTests.concat(changedComponents.modified.exportTests)
      .filter(([plugin, test]) => !plugins.includes(plugin));
    validateTasks = validateTasks.concat(exportTests.map(test => ({
      type: 'export-test',
      plugin: test[0],
      test: test[1]
    })));
  }

  const fixtures = changedComponents.added.fixtures.concat(changedComponents.modified.fixtures);
  validateTasks = validateTasks.concat(fixtures.map(fixture => ({
    type: 'fixture',
    fixture: fixture
  })));
})
.then(validateTasks => {
  // ...
});

/*Promise.all(plugins.filter(
  plugin => plugin.export !== null && plugin.exportTests.length > 0
).map(plugin => {
  return new Promise((resolve, reject) => {
    const exportFiles = plugin.export.export(testFixtures);
    const filePromises = exportFiles.map(file => {
      const testPromises = plugin.exportTests.map(
        test => test.test(file.content)
      );
      return testPromises;
    });

    Promise.all(filePromises.map(testPromises =>
      Promise.all(testPromises)
    ))
    .then(fileResults => {
      console.log(colors.yellow(`Validating ${plugin.export.name}'s export`));

      for (let i = 0; i < fileResults.length; i++) {
        const file = exportFiles[i];
        const testResults = fileResults[i];

        console.log(file.name);

        for (let j = 0; j < testResults.length; j++) {
          const test = plugin.exportTests[j];
          const result = testResults[j];

          if (result.passed) {
            console.log('└', colors.green('[PASS]'), test.key);
          }
          else {
            console.log('└', colors.red('[FAIL]'), `${test.key}:`);
            for (const error of result.errors) {
              console.log('  -', error);
            }
            fails++;
          }
        }
      }

      console.log();
    })
    .catch(error => {
      console.error(error);
    })
    .then(() => {
      resolve();
    });
  });
}))
.then(() => {
  if (fails === 0) {
    console.log(colors.green('[PASS]'), 'All exported files passed.');
    process.exit(0);
  }

  console.log(colors.red('[FAIL]'), `${fails} test(s) failed.`);
  process.exit(1);
});*/