const promisify = require(`util`).promisify;
const xml2js = require(`xml2js`);

const { Range, SwitchingChannel } = require(`../../../lib/model.js`);

/**
 * @param {object} exportFile The file returned by the plugins' export module.
 * @param {!string} exportFile.name File name, may include slashes to provide a folder structure.
 * @param {!string} exportFile.content File content.
 * @param {!string} exportFile.mimetype File mime type.
 * @param {?Array.<Fixture>} exportFile.fixtures Fixture objects that are described in given file; may be omitted if the file doesn't belong to any fixture (e.g. manufacturer information).
 * @param {?string} exportFile.mode Mode's shortName if given file only describes a single mode.
 * @returns {!Promise} Resolve when the test passes or reject with an error or an array of errors if the test fails.
**/
module.exports = async function testChannelNumbers(exportFile) {
  const parser = new xml2js.Parser();
  const parseString = promisify(parser.parseString);

  const fixture = exportFile.fixtures[0];
  const mode = fixture.modes.find(mode => mode.shortName === exportFile.mode);
  const channelCount = mode.channels.length;

  /** @type {!object.<number, Array.<Range>} */
  const usedChannelRanges = {};

  const errors = [];

  const xml = await parseString(exportFile.content);
  xml.device.functions.filter(
    // filter out tags without content
    xmlFunction => typeof xmlFunction === `object`
  ).forEach(
    xmlFunction => findChannels(xmlFunction, -1)
  );

  checkUsedChannels();

  if (errors.length > 0) {
    throw errors;
  }

  /**
   * Recursively searches the given XML tree for tags with dmxchannel attributes and capabilities.
   * @param {!XMLElement} xmlNode A single XML node.
   * @param {!number} currentChannelIndex The index of the channel if the xmlNode is inside a function associated to a channel. Else, it's -1.
   */
  function findChannels(xmlNode, currentChannelIndex) {
    if (xmlNode.$) {
      const indexAttributes = [`dmxchannel`, `finedmxchannel`, `ultradmxchannel`, `ultrafinedmxchannel`];
      indexAttributes.filter(attr => attr in xmlNode.$).forEach(attr => {
        const channelIndex = parseInt(xmlNode.$[attr]);

        if (!(channelIndex in usedChannelRanges)) {
          usedChannelRanges[channelIndex] = [];
        }

        if (attr === `dmxchannel`) {
          currentChannelIndex = channelIndex;
        }

        if (channelIndex >= channelCount) {
          errors.push(`${attr}=${channelIndex} is out of range (maximum: ${channelCount - 1}).`);
        }
      });

      if (`mindmx` in xmlNode.$) {
        // xmlNode is a capability
        addCapability(xmlNode, currentChannelIndex);
      }
    }

    Object.keys(xmlNode).forEach(tagname => {
      if (tagname !== `$`) {
        for (const child of xmlNode[tagname]) {
          findChannels(child, currentChannelIndex);
        }
      }
    });
  }

  /**
   * Checks the given capability xml and adds the DMX range to the channel's ranges.
   * @param {!XMLElement} xmlNode A <step> or <range> element.
   * @param {!number} channelIndex The index of the channel that contains this capability.
   */
  function addCapability(xmlNode, channelIndex) {
    const mindmx = parseInt(xmlNode.$.mindmx);
    const maxdmx = parseInt(xmlNode.$.maxdmx);
    const range = new Range([Math.min(mindmx, maxdmx), Math.max(mindmx, maxdmx)]);

    if (channelIndex === -1) {
      errors.push(`Capability ${range} is not inside a channel function.`);
    }
    else if (range.start < 0 || range.end > 255) {
      errors.push(`Capability ${range} in channel ${channelIndex + 1} is out of the allowed 0…255 range.`);
    }
    else {
      const existingRanges = usedChannelRanges[channelIndex];

      if (range.overlapsWithOneOf(existingRanges)) {
        errors.push(`Capability ${range} in channel ${channelIndex + 1} overlaps with other capabilities.`);
      }
      else {
        existingRanges.push(range);
      }
    }

    if (`minval` in xmlNode.$) {
      const minval = parseInt(xmlNode.$.minval);
      const maxval = parseInt(xmlNode.$.maxval);

      if (minval > maxval) {
        errors.push(`Capability ${range} in channel ${channelIndex + 1} must not use a greater minval (${minval}) than maxval (${maxval}). Instead, swap mindmx and maxdmx.`);
      }
    }
  }

  /**
   * Checks that:
   * - All not NoFunction channels have been used.
   * - No NoFunction channels have been used.
   * - Each channel has either no capability at all or its ranges span the whole 0…255 range.
   */
  function checkUsedChannels() {
    mode.channels.forEach((channel, index) => {
      const isUsed = index in usedChannelRanges;
      const isNoFunction = isNoFunctionChannel(channel);

      if (isUsed) {
        if (isNoFunction) {
          errors.push(`Channel ${index + 1} "${channel.name}" of type NoFunction should be omitted.`);
        }
        else {
          const mergedRanges = Range.getMergedRanges(usedChannelRanges[index]);

          if (!areRangesComplete(mergedRanges)) {
            errors.push(`Channel ${index + 1} "${channel.name}" is missing capabilities. Used ranges: ${mergedRanges.join(`, `)}`);
          }
        }
      }
      else if (!isNoFunction) {
        errors.push(`Channel ${index + 1} "${channel.name}" is missing.`);
      }
    });

    /**
     * @param {AbstractChannel} channel The channel to check.
     * @returns {boolean} Whether the given channel is of type NoFunction. If it is a switching channel, the default channel is checked.
     */
    function isNoFunctionChannel(channel) {
      if (channel.type === `NoFunction`) {
        return true;
      }

      if (channel instanceof SwitchingChannel) {
        return isNoFunctionChannel(channel.defaultChannel);
      }

      return false;
    }
  }

  /**
   * @param {!Array.<Range>} ranges A channel's found ranges with adjacent ones already merged.
   * @returns {!boolean} True if there's only one 0…255 range or no range at all.
   */
  function areRangesComplete(ranges) {
    if (ranges.length === 0) {
      // no capabilities used
      return true;
    }

    if (ranges.length > 1) {
      // more than one range -> could not be merged to 0…255
      return false;
    }

    const range = ranges[0];
    return range.start === 0 && range.end === 255;
  }
};
