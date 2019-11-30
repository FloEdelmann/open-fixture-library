#!/usr/bin/node

const fs = require(`fs`);
const path = require(`path`);
const chalk = require(`chalk`);
const Ajv = require(`ajv`);

const manufacturerSchema = require(`../schemas/dereferenced/manufacturers.json`);
const { checkFixture, checkUniqueness, getErrorString } = require(`./fixture-valid.js`);

/**
 * @typedef {Object} UniqueValues
 * @property {Set.<String>} manNames All manufacturer names
 * @property {Object.<String, Set.<String>>} fixKeysInMan All fixture keys by manufacturer key
 * @property {Object.<String, Set.<String>>} fixNamesInMan All fixture names by manufacturer key
 * @property {Object.<String, Set.<String>>} fixRdmIdsInMan All RDM ids by manufacturer key
 * @property {Set.<String>} fixShortNames All fixture short names
 */
/** @type {UniqueValues} */
const uniqueValues = {
  manNames: new Set(),
  manRdmIds: new Set(),
  fixKeysInMan: {}, // new Set() for each manufacturer
  fixNamesInMan: {}, // new Set() for each manufacturer
  fixRdmIdsInMan: {}, // new Set() for each manufacturer
  fixShortNames: new Set()
};

const promises = [];

// search fixture files
const fixturePath = path.join(__dirname, `..`, `fixtures`);
for (const manKey of fs.readdirSync(fixturePath)) {
  const manDir = path.join(fixturePath, manKey);

  // files in manufacturer directory
  if (fs.statSync(manDir).isDirectory()) {
    for (const file of fs.readdirSync(manDir)) {
      if (path.extname(file) === `.json`) {
        const fixKey = path.basename(file, `.json`);
        handleFixtureFile(manKey, fixKey);
      }
    }
  }
}

/**
 * Checks (asynchronously) the given fixture by adding a Promise to the promises array that resolves with a result object.
 * @param {String} manKey The manufacturer key.
 * @param {String} fixKey The fixture key.
 */
function handleFixtureFile(manKey, fixKey) {
  const filename = `${manKey}/${fixKey}.json`;
  const result = {
    name: filename,
    errors: [],
    warnings: []
  };

  const filepath = path.join(fixturePath, filename);

  promises.push(new Promise((resolve, reject) => {
    fs.readFile(filepath, `utf8`, (readError, data) => {
      if (readError) {
        result.errors.push(getErrorString(`File could not be read.`, readError));
        return resolve(result);
      }

      let fixtureJson;
      try {
        fixtureJson = JSON.parse(data);
      }
      catch (parseError) {
        result.errors.push(getErrorString(`File could not be parsed as JSON.`, parseError));
        return resolve(result);
      }

      try {
        // checkFixture(..) returns { errors: [..], warnings: [..] }
        Object.assign(result, checkFixture(manKey, fixKey, fixtureJson, uniqueValues));
      }
      catch (validateError) {
        result.errors.push(getErrorString(`Fixture could not be validated.`, validateError));
      }
      return resolve(result);
    });
  }));
}

// check manufacturers file
promises.push(new Promise((resolve, reject) => {
  const result = {
    name: `manufacturers.json`,
    errors: [],
    warnings: []
  };
  const filename = path.join(fixturePath, result.name);

  fs.readFile(filename, `utf8`, (readError, data) => {
    if (readError) {
      result.errors.push(getErrorString(`File could not be read.`, readError));
      return resolve(result);
    }

    let manufacturers;
    try {
      manufacturers = JSON.parse(data);
    }
    catch (parseError) {
      result.errors.push(getErrorString(`File could not be parsed.`, parseError));
      return resolve(result);
    }


    const validate = (new Ajv()).compile(manufacturerSchema);
    const valid = validate(manufacturers);
    if (!valid) {
      result.errors.push(getErrorString(`File does not match schema.`, validate.errors));
      return resolve(result);
    }

    for (const manKey of Object.keys(manufacturers)) {
      if (manKey.startsWith(`$`)) {
        // JSON schema property
        continue;
      }

      checkUniqueness(
        uniqueValues.manNames,
        manufacturers[manKey].name,
        result,
        `Manufacturer name '${manufacturers[manKey].name}' is not unique (test is not case-sensitive).`
      );

      if (`rdmId` in manufacturers[manKey]) {
        checkUniqueness(
          uniqueValues.manRdmIds,
          `${manufacturers[manKey].rdmId}`,
          result,
          `Manufacturer RDM ID '${manufacturers[manKey].rdmId}' is not unique.`
        );
      }
    }

    return resolve(result);
  });
}));


// print results
Promise.all(promises).then(results => {
  let totalFails = 0;
  let totalWarnings = 0;

  // each file
  results.forEach(result => {
    const failed = result.errors.length > 0;

    console.log(
      failed ? chalk.red(`[FAIL]`) : chalk.green(`[PASS]`),
      result.name
    );

    totalFails += failed ? 1 : 0;
    for (const error of result.errors) {
      console.log(`└`, chalk.red(`Error:`), error);
    }

    totalWarnings += result.warnings.length;
    for (const warning of result.warnings) {
      console.log(`└`, chalk.yellow(`Warning:`), warning);
    }
  });

  // newline
  console.log();

  // summary
  if (totalWarnings > 0) {
    console.log(chalk.yellow(`[INFO]`), `${totalWarnings} unresolved warning(s)`);
  }

  if (totalFails === 0) {
    console.log(chalk.green(`[PASS]`), `All ${results.length} tested files were valid.`);
    process.exit(0);
  }

  console.error(chalk.red(`[FAIL]`), `${totalFails} of ${results.length} tested files failed.`);
  process.exit(1);
}).catch(error => console.error(chalk.red(`[Error]`), `Test errored:`, error));
