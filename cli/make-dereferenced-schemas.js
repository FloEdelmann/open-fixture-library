#!/usr/bin/node

const fs = require(`fs`);
const path = require(`path`);
const chalk = require(`chalk`);
const schemaRefParser = require(`json-schema-ref-parser`);

const schemaDir = path.join(__dirname, `../schemas/`);

let schemaFiles;
if (process.argv.length > 2) {
  schemaFiles = process.argv.slice(2);
}
else {
  schemaFiles = fs.readdirSync(schemaDir).filter(
    schemaFile => path.extname(schemaFile) === `.json`
  );
}

process.chdir(schemaDir);
for (const schemaFile of schemaFiles) {
  const schema = require(path.join(schemaDir, schemaFile));
  const dereferencedSchemaFile = path.join(schemaDir, `dereferenced`, schemaFile);

  schemaRefParser.dereference(schema)
    .then(dereferencedSchema => fs.writeFileSync(
      dereferencedSchemaFile,
      `${JSON.stringify(dereferencedSchema, null, 2)}\n`
    ))
    .then(() => {
      console.log(`${chalk.green(`[Success]`)} Updated dereferenced schema ${dereferencedSchemaFile}.`);
    })
    .catch(error => {
      console.error(chalk.red(`[Error]`), error);
    });
}
