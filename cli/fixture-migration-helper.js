#!/usr/bin/node

const fs = require(`fs`);
const minimist = require(`minimist`);

const args = minimist(process.argv.slice(2), {
  string: `f`,
  alias: {
    f: `fixture`
  }
});

if (!args.fixture) {
  console.error(`Usage: ${process.argv[1]} -f <fixture filename>\n\npath relative to working directory`);
  process.exit(1);
}

fs.readFile(args.fixture, `utf8`, (readError, data) => {
  if (readError) {
    console.error(`read error`, readError);
    process.exit(1);
    return;
  }

  data = data.replace(`"$schema": "https://raw.githubusercontent.com/OpenLightingProject/open-fixture-library/master/schemas/fixture.json",`, `"$schema": "../../schemas/fixture.json",`);

  data = data.replace(/ {2}"(availableChannels|templateChannels)": \{\n((?:.|\n)+?)\n {2}\}/g, replaceChannels);

  fs.writeFile(args.fixture, data, `utf8`, writeError => {
    if (writeError) {
      console.error(`write error`, writeError);
      process.exit(1);
      return;
    }
  });
});

/* eslint-disable require-jsdoc */

function replaceChannels(match, channelsType, channels) {
  channels = channels.replace(/"range"/g, `"dmxRange"`);

  channels = channels.replace(/ {4}"([^"]+)": \{\n {6}((?:.|\n)+?)\n {4}\}/g, (match, channelName, propertiesStr) => {
    const properties = JSON.parse(`{${propertiesStr}}`);
    const propertiesArr = propertiesStr.split(/,\n {6}/);

    if (properties.type === `Single Color`) {
      properties.type = `ColorIntensity`;
    }

    // delete `type` channel property
    propertiesArr.splice((`name` in properties ? 1 : 0), 1);

    // delete `color` channel property
    if (`color` in properties) {
      propertiesArr.splice(propertiesArr.findIndex(line => line.includes(`"color"`)), 1);
    }

    propertiesStr = propertiesArr.join(`,\n      `);

    let returnStr = `    "${channelName}": {\n      ${propertiesStr}`;

    if (!(`capabilities` in properties)) {
      if (propertiesStr !== ``) {
        returnStr += `,\n      `;
      }

      returnStr += `"capability": {\n`;
      returnStr += `        "type": "${properties.type}"`;

      if (`color` in properties) {
        returnStr += `,\n        "color": "${properties.color}"`;
      }

      returnStr += `\n      }`;
    }
    else {
      returnStr = returnStr.replace(/ {6}"capabilities": \[\n {8}\{\n {10}((?:.|\n)+)\n {8}\}\n {6}\]/, (match, capPropsStr) => {
        capPropsStr = capPropsStr.replace(/"name"/g, `"comment"`);

        const capabilities = capPropsStr.split(/ {8}\},\n {8}\{/);

        // replace single `capabilities` item with `capability`
        if (capabilities.length === 1) {

          const capPropsArr = capPropsStr.split(/,\n {10}/);

          // delete `dmxRange` property
          capPropsArr.splice(0, 1);

          return `      "capability": {
        "type": "${properties.type}",
        ${capPropsArr.join(`,\n        `)}
      }`;
        }

        // add channel type to every capability
        const capabilitiesStr = capabilities.map(cap => {
          const capPropsArr = cap.split(/,\n {10}/);

          capPropsArr.splice(1, 0, `"type": "${properties.type}"`);

          return capPropsArr.join(`,\n          `);
        }).join(`        },\n        {`);

        return `      "capabilities": [
        {
          ${capabilitiesStr}
        }
      ]`;
      });
    }

    returnStr += `\n    }`;

    return returnStr;
  });

  channels = channels.replace(`      "capability": {
        "type": "Pan"
      }`, `      "capability": {
        "type": "Pan",
        "angleStart": "0%",
        "angleEnd": "100%"
      }`);

  channels = channels.replace(`      "capability": {
        "type": "Tilt"
      }`, `      "capability": {
        "type": "Tilt",
        "angleStart": "0%",
        "angleEnd": "100%"
      }`);

  return `  "${channelsType}": {\n${channels}\n  }`;
}
