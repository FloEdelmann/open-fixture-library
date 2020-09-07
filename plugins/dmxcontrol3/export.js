const xmlbuilder = require(`xmlbuilder`);
const sanitize = require(`sanitize-filename`);

const ddf3Functions = require(`./ddf3-functions.js`);
const ddf3FunctionGroups = require(`./ddf3-function-groups.js`);

/* eslint-disable no-unused-vars */
const {
  AbstractChannel,
  Capability,
  CoarseChannel,
  FineChannel,
  Fixture,
  Manufacturer,
  Matrix,
  MatrixChannel,
  MatrixChannelReference,
  Meta,
  Mode,
  NullChannel,
  Physical,
  Range,
  SwitchingChannel,
  TemplateChannel
} = require(`../../lib/model.js`);
/* eslint-enable no-unused-vars */

module.exports.name = `DMXControl 3 (DDF3)`;
module.exports.version = `0.1.0`;

/**
 * @param {array.<Fixture>} fixtures The fixtures to convert into DMXControl device definitions
 * @param {options} options Some global options
 * @returns {Promise.<array.<object>, Error>} The generated files
 */
module.exports.export = async function exportDMXControl3(fixtures, options) {
  const deviceDefinitions = [];

  for (const fixture of fixtures) {
    // add device for each mode
    for (const mode of fixture.modes) {
      const xml = xmlbuilder.begin()
        .declaration(`1.0`, `utf-8`)
        .element({
          device: {
            '@type': `DMXDevice`,
            '@dmxaddresscount': mode.channelKeys.length,
            '@dmxcversion': 3,
            '@ddfversion': module.exports.version
          }
        });

      addInformation(xml, mode);
      addFunctions(xml, mode);
      addProcedures(xml, mode);

      deviceDefinitions.push({
        name: sanitize(`${fixture.manufacturer.key}-${fixture.key}-${(mode.shortName)}.xml`).replace(/\s+/g, `-`),
        content: xml.end({
          pretty: true,
          indent: `  `
        }),
        mimetype: `application/xml`,
        fixtures: [fixture],
        mode: mode.shortName
      });
    }
  }

  return deviceDefinitions;
};

/**
 * Adds the information block to the specified XML file.
 * @param {XMLDocument} xml The device definition to add the information to
 * @param {Mode} mode The definition's mode
 */
function addInformation(xml, mode) {
  const xmlInfo = xml.element(`information`);
  xmlInfo.element(`model`).text(mode.fixture.name);
  xmlInfo.element(`vendor`).text(mode.fixture.manufacturer.name);
  xmlInfo.element(`author`).text(mode.fixture.meta.authors.join(`, `));
  xmlInfo.element(`mode`).text(mode.name);

  if (mode.fixture.hasComment) {
    xmlInfo.element(`comment`).text(mode.fixture.comment);
  }
}

/**
 * @typedef {Map.<(string|null), Array.<CoarseChannel>>} ChannelsPerPixel
 */

/**
 * @typedef {Map.<(string|null), Array.<XMLElement>>} XmlFunctionsPerPixel
 */

/**
 * Adds the DMX channels as functions to the specified XML file.
 * @param {XMLDocument} xml The device definition to add the functions to.
 * @param {Mode} mode The definition's mode.
 */
function addFunctions(xml, mode) {
  const channelsPerPixel = getChannelsPerPixel();
  /** @type {XmlFunctionsPerPixel} */
  const xmlFunctionsPerPixel = new Map();

  for (const [pixelKey, pixelChannels] of channelsPerPixel) {
    const xmlChannelFunctions = [];
    pixelChannels.forEach(ch => xmlChannelFunctions.push(...getXmlFunctionsFromChannel(ch)));

    groupXmlFunctions(xmlChannelFunctions);
    xmlFunctionsPerPixel.set(pixelKey, xmlChannelFunctions);
  }

  addMatrix(mode, xmlFunctionsPerPixel);

  for (const [pixelKey, xmlFunctions] of xmlFunctionsPerPixel) {
    if (xmlFunctions.length > 0) {
      const xmlFunctionsContainer = xml.element(`functions`);

      if (pixelKey !== null) {
        xmlFunctionsContainer.comment(pixelKey);
      }

      xmlFunctions.forEach(xmlFunction => xmlFunctionsContainer.importDocument(xmlFunction));
    }
  }

  /**
   * @returns {ChannelsPerPixel} Each pixel key pointing to its unwrapped matrix channels. null points to all non-matrix channels.
   */
  function getChannelsPerPixel() {
    const channelsPerPixel = new Map();

    channelsPerPixel.set(null, []);

    const matrix = mode.fixture.matrix;
    if (matrix !== null) {
      const pixelKeys = matrix.pixelGroupKeys.concat(matrix.getPixelKeysByOrder(`X`, `Y`, `Z`));
      pixelKeys.forEach(key => channelsPerPixel.set(key, []));
    }

    const channels = mode.channels.map(
      ch => (ch instanceof SwitchingChannel ? ch.defaultChannel : ch)
    ).filter(
      ch => !(ch instanceof FineChannel || ch instanceof NullChannel)
    );
    for (const channel of channels) {
      channelsPerPixel.get(channel.pixelKey).push(channel);
    }

    return channelsPerPixel;
  }

  /**
   * @param {CoarseChannel} channel The channel that should be represented as one or more DMXControl functions.
   * @returns {array.<XMLElement>} Functions created by this channel. They are not automatically grouped together.
   */
  function getXmlFunctionsFromChannel(channel) {
    const functionToCapabilities = {};

    for (const cap of channel.capabilities) {
      const properFunction = Object.keys(ddf3Functions).find(
        key => ddf3Functions[key].isCapSuitable(cap)
      );

      if (properFunction) {
        if (!Object.keys(functionToCapabilities).includes(properFunction)) {
          functionToCapabilities[properFunction] = [];
        }
        functionToCapabilities[properFunction].push(cap);
      }
    }

    let xmlFunctions = [];
    Object.keys(functionToCapabilities).forEach(functionKey => {
      const caps = functionToCapabilities[functionKey];
      xmlFunctions = xmlFunctions.concat(ddf3Functions[functionKey].create(channel, caps));
    });
    xmlFunctions.forEach(xmlFunc => addChannelAttributes(xmlFunc, mode, channel));

    return xmlFunctions;
  }

  /**
   * Merges and renames the given XML functions. Modifies the array.
   * @param {array.<XMLElement>} xmlFunctions Channel-level XML functions.
   */
  function groupXmlFunctions(xmlFunctions) {
    ddf3FunctionGroups.forEach(group => {
      const foundFunctions = {};
      group.functions.forEach(functionName => {
        foundFunctions[functionName] = [];
      });

      for (const xmlFunction of xmlFunctions) {
        if (xmlFunction.name in foundFunctions) {
          foundFunctions[xmlFunction.name].push(xmlFunction);
        }
      }

      const completeGroups = Math.min(...Object.values(foundFunctions).map(items => items.length));
      for (let i = 0; i < completeGroups; i++) {
        // take i-th function from each function type
        const groupFunctions = Object.values(foundFunctions).map(items => items[i]);
        const xmlGroup = group.getXmlGroup(...groupFunctions);

        // insert xml group at the position of the first grouped function
        xmlFunctions.splice(xmlFunctions.indexOf(groupFunctions[0]), 0, xmlGroup);

        // remove grouped functions from list
        groupFunctions.forEach(func => xmlFunctions.splice(xmlFunctions.indexOf(func), 1));
      }
    });
  }
}

/**
 * Adds the Maintenance capabilities as procedures to the specified XML file.
 * @param {XMLDocument} xml The device definition to add the functions to.
 * @param {Mode} mode The definition's mode.
 */
function addProcedures(xml, mode) {
  const maintenanceCapabilities = [];

  mode.channels.forEach(channel => {
    if (channel instanceof SwitchingChannel) {
      channel = channel.defaultChannel;
    }

    if (channel instanceof FineChannel) {
      return;
    }

    maintenanceCapabilities.push(...channel.capabilities.filter(
      capability => capability.type === `Maintenance` && capability.isStep
    ));
  });

  if (maintenanceCapabilities.length === 0) {
    return;
  }

  const xmlProcedures = xml.element(`procedures`);

  maintenanceCapabilities.forEach(capability => {
    const channelIndex = mode.getChannelIndex(capability._channel);

    const xmlProcedure = xmlProcedures.element(`procedure`, {
      name: capability.comment
    });

    xmlProcedure.element(`set`, {
      dmxchannel: channelIndex,
      value: capability.dmxRange.start
    });

    if (capability.hold) {
      xmlProcedure.element(`hold`, {
        value: capability.hold.getBaseUnitEntity().number * 1000
      });

      xmlProcedure.element(`restore`, {
        dmxchannel: channelIndex
      });
    }
  });
}

/**
 * Combines several XML functions from the individual pixels to a single <matrix> function, if possible.
 * @param {Mode} mode The definition's mode.
 * @param {XmlFunctionsPerPixel} xmlFunctionsPerPixel Pixel keys pointing to its xml functions.
 */
function addMatrix(mode, xmlFunctionsPerPixel) {
  const matrix = mode.fixture.matrix;
  const hasSuitableCategory = mode.fixture.categories.includes(`Matrix`) || mode.fixture.categories.includes(`Pixel Bar`);

  if (matrix === null || !hasSuitableCategory) {
    return;
  }

  const pixelKeys = matrix.getPixelKeysByOrder(`X`, `Y`, `Z`);

  const isMonochromeMatrix = pixelKeys.every(pixelKey => {
    const xmlFunctions = xmlFunctionsPerPixel.get(pixelKey);
    return xmlFunctions.length === 1 && xmlFunctions[0].name === `dimmer`;
  });

  const isRgbMatrix = pixelKeys.every(pixelKey => {
    const xmlFunctions = xmlFunctionsPerPixel.get(pixelKey);
    return xmlFunctions.length === 1 && xmlFunctions[0].name === `rgb`;
  });

  if (!isMonochromeMatrix && !isRgbMatrix) {
    return;
  }

  const xmlMatrix = xmlbuilder.create(`matrix`);
  xmlMatrix.attribute(`rows`, matrix.pixelCountY);
  xmlMatrix.attribute(`columns`, matrix.pixelCountX);

  pixelKeys.forEach(pixelKey => {
    xmlMatrix.importDocument(xmlFunctionsPerPixel.get(pixelKey).shift());
  });

  xmlFunctionsPerPixel.get(null).push(xmlMatrix);
}

/**
 * Adds name attribute, dmxchannel attribute and attributes for fine channels (if used in mode) to the given channel function.
 * @param {XMLElement} xmlElement The XML element to which the attributes should be added.
 * @param {Mode} mode The definition's mode.
 * @param {CoarseChannel} channel The channel whose data is used.
 */
function addChannelAttributes(xmlElement, mode, channel) {
  xmlElement.attribute(`name`, channel.name);

  const index = mode.getChannelIndex(channel);
  xmlElement.attribute(`dmxchannel`, index);

  const fineIndices = channel.fineChannels.map(
    fineCh => mode.getChannelIndex(fineCh)
  );

  if (fineIndices.length > 0 && fineIndices[0] !== -1) {
    xmlElement.attribute(`finedmxchannel`, fineIndices[0]);

    if (fineIndices.length > 1 && fineIndices[1] !== -1) {
      xmlElement.attribute(`ultradmxchannel`, fineIndices[1]);

      if (fineIndices.length > 2 && fineIndices[2] !== -1) {
        xmlElement.attribute(`ultrafinedmxchannel`, fineIndices[2]);
      }
    }
  }
}
