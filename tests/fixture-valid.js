const util = require('util');

const schema = require('../fixtures/schema.js');

const Fixture = require('../lib/model/Fixture.js');
const FineChannel = require('../lib/model/FineChannel.js');
const SwitchingChannel = require('../lib/model/SwitchingChannel.js');

/**
 * @typedef ResultData
 * @type {object}
 * @property {string[]} errors
 * @property {string[]} warnings
 */
let result;
/** @type {Fixture} */
let fixture;
/** @type {Set<string>} */
let definedChannelKeys; // and aliases
/** @type {Set<string>} */
let usedChannelKeys; // and aliases
/** @type {Set<string>} */
let modeNames;
/** @type {Set<string>} */
let modeShortNames;

/**
 * Checks that a given fixture JSON object is valid.
 * @param {!string} manKey The manufacturer key.
 * @param {!string} fixKey The fixture key.
 * @param {?object} fixtureJson The fixture JSON object.
 * @param {?UniqueValues} [uniqueValues=null] Values that have to be unique are checked and all new occurences are appended.
 * @return {ResultData} The result object containing errors and warnings, if any.
 */
module.exports = function checkFixture(manKey, fixKey, fixtureJson, uniqueValues=null) {
  result = {
    errors: [],
    warnings: []
  };
  definedChannelKeys = new Set();
  usedChannelKeys = new Set();
  modeNames = new Set();
  modeShortNames = new Set();

  const schemaErrors = schema.Fixture.errors(fixtureJson);
  if (schemaErrors !== false) {
    result.errors.push(getErrorString('File does not match schema.', schemaErrors));
    return result;
  }

  try {
    fixture = new Fixture(manKey, fixKey, fixtureJson);
    
    checkFixIdentifierUniqueness(uniqueValues);
    checkMeta(fixture.meta);
    checkPhysical(fixture.physical);
    checkMatrix(fixture.matrix);
    checkChannels(fixtureJson);
  
    for (const mode of fixture.modes) {
      checkMode(mode);
    }
  
    checkUnusedChannels();
  }
  catch (error) {
    result.errors.push(getErrorString('File could not be imported into model.', error))
  }

  return result;
};

/**
 * Checks that fixture key, name and shortName are unique.
 * @param {?UniqueValues} [uniqueValues=null] Values that have to be unique are checked and all new occurences are appended.
 */
function checkFixIdentifierUniqueness(uniqueValues) {
  // test is called for a single fixture, e.g. when importing
  if (uniqueValues === null) {
    return;
  }

  const manKey = fixture.manufacturer.key;

  // fixture.key
  if (!(manKey in uniqueValues.fixKeysInMan)) {
    uniqueValues.fixKeysInMan[manKey] = new Set();
  }
  checkUniqueness(
    uniqueValues.fixKeysInMan[manKey],
    fixture.key,
    `Fixture key '${fixture.key}' is not unique in manufacturer ${manKey} (test is not case-sensitive).`
  );

  // fixture.name
  if (!(manKey in uniqueValues.fixNamesInMan)) {
    uniqueValues.fixNamesInMan[manKey] = new Set();
  }
  checkUniqueness(
    uniqueValues.fixNamesInMan[manKey],
    fixture.name,
    `Fixture name '${fixture.name}' is not unique in manufacturer ${manKey} (test is not case-sensitive).`
  );
  
  // fixture.shortName
  checkUniqueness(
    uniqueValues.fixShortNames,
    fixture.shortName,
    `Fixture shortName '${fixture.shortName}' is not unique (test is not case-sensitive).`
  );
}

/**
 * Check that a fixture's meta block is valid.
 * @param {!Meta} meta The fixture's Meta object.
 */
function checkMeta(meta) {
  if (meta.lastModifyDate < meta.createDate) {
    result.errors.push('meta.lastModifyDate is earlier than meta.createDate.');
  }
}

/**
 * Checks if the given Physical object is valid.
 * @param {?Physical} physical A fixture's or a mode's physical data.
 * @param {!string} [modeDescription=''] Optional information in error messages about current mode.
 */
function checkPhysical(physical, modeDescription = '') {
  if (physical === null) {
    return;
  }

  const physicalJson = physical.jsonObject;
  if (isNotEmpty(physicalJson, `physical${modeDescription} is empty. Please remove it or add data.`)) {
    for (const property of ['bulb', 'lens', 'focus']) {
      isNotEmpty(physicalJson[property], `physical.${property}${modeDescription} is empty. Please remove it or add data.`);
    }
  
    if (physical.lensDegreesMin > physical.lensDegreesMax) {
      result.errors.push(`physical.lens.degreesMinMax${modeDescription} is an invalid range.`);
    }

    if (physical.hasMatrixPixels && fixture.matrix === null) {
      result.errors.push('physical.matrixPixels is set but fixture.matrix is missing.');
    }
  }
}

/**
 * Checks if the given Matrix object is valid.
 * @param {?Matrix} matrix A fixture's matrix data.
 */
function checkMatrix(matrix) {
  if (matrix === null) {
    return;
  }

  const matrixJson = matrix.jsonObject;
  const hasPixelCount = 'pixelCount' in matrixJson;
  const hasPixelKeys = 'pixelKeys' in matrixJson;
  
  if (!hasPixelCount && !hasPixelKeys) {
    result.errors.push('Matrix must either define \'pixelCount\' or \'pixelKeys\'.');
    return;
  }
  if (hasPixelCount && hasPixelKeys) {
    result.errors.push('Matrix can\'t define both \'pixelCount\' and \'pixelKeys\'.');
    return;
  }

  if (matrix.definedAxes.length === 0) {
    result.errors.push('Matrix may not consist of only a single pixel.');
    return;
  }

  const variesInAxisLength = matrix.pixelKeys.some(
    rows => rows.length !== matrix.pixelCountY || rows.some(
      columns => columns.length !== matrix.pixelCountX
    )
  );
  if (variesInAxisLength) {
    result.errors.push('Matrix must not vary in axis length.');
  }

  checkPixelGroups(matrix);
}

/**
 * Check if the referenced pixelKeys from the pixelGroups exist and are not referenced more than once.
 * @param {Matrix} matrix The Matrix instance
 */
function checkPixelGroups(matrix) {
  for (const pixelGroupKey of matrix.pixelGroupKeys) {
    const usedPixelKeys = new Set();

    if (pixelGroupKey in matrix.pixelKeyPositions) {
      result.errors.push(`pixelGroupKey '${pixelGroupKey}' is already used as pixelKey. Please choose a different name.`);
    }

    for (const pixelKey of matrix.pixelGroups[pixelGroupKey]) {
      if (!(pixelKey in matrix.pixelKeyPositions)) {
        result.errors.push(`pixelGroup '${pixelGroupKey}' references unknown pixelKey '${pixelKey}'.`);
      }
      if (usedPixelKeys.has(pixelKey)) {
        result.errors.push(`pixelGroup '${pixelGroupKey}' can't reference pixelKey '${pixelKey}' more than once.`);
      }
      usedPixelKeys.add(pixelKey);
    }
  }
}

/**
 * Check if availableChannels and templateChannels are defined correctly.
 * @param {!object} fixtureJson The fixture's JSON data
 */
function checkChannels(fixtureJson) {
  if (isNotEmpty(fixtureJson.availableChannels, 'availableChannels are empty. Add a channel or remove it.')) {
    for (const channel of fixture.availableChannels) {
      checkChannel(channel);
    }
  }
    
  if (isNotEmpty(fixtureJson.templateChannels, 'templateChannels are empty. Add a channel or remove it.')) {
    if (fixture.matrix === null) {
      result.errors.push('templateChannels are defined but matrix data is missing.')
    }
    else {
      // for (const channel of fixture.templateChannels) {
      //   checkChannel(channel);
      // }
    }
  }
  else if (fixture.matrix !== null) {
    result.errors.push('Matrix is defined but templateChannels are missing.');
  }
}

/**
 * Check that an available or template channel is valid.
 * @param {!Channel} channel The channel to test.
 */
function checkChannel(channel) {
  checkTemplateVariables(channel.key);
  checkUniqueness(
    definedChannelKeys,
    channel.key,
    `Channel key '${channel.key}' is already defined in another letter case.`
  );

  if (/\bfine\b|\d+(?:\s|-|_)*bit/i.test(channel.name)) {
    // channel name contains the word "fine" or "16bit" / "8 bit" / "32-bit" / "24_bit"
    result.errors.push(`Channel '${channel.key}' should rather be a fine channel alias of its corresponding coarse channel.`);
  }
  checkTemplateVariables(channel.name);

  // Nothing channels
  if (channel.type === 'Nothing') {
    const isNotEmpty = Object.keys(channel.jsonObject).some(
      prop => prop !== 'type' && prop !== 'name'
    );
    if (isNotEmpty) {
      result.errors.push(`Channel '${channel.name}' with type 'Nothing' can only set 'name' as additional property.`);
      return;
    }
  }

  // Fine channels
  for (const alias of channel.fineChannelAliases) {
    checkTemplateVariables(alias);
    checkUniqueness(
      definedChannelKeys,
      alias,
      `Fine channel alias '${alias}' in channel '${channel.key}' is already defined (maybe in another letter case).`
    );
  }
  const minUsedFineness = Math.min(...fixture.modes.map(
    mode => channel.getFinenessInMode(mode)
  ));

  // Switching channels
  for (const alias of channel.switchingChannelAliases) {
    checkTemplateVariables(alias);
    checkUniqueness(
      definedChannelKeys,
      alias,
      `Switching channel alias '${alias}' in channel '${channel.key}' is already defined (maybe in another letter case).`
    );
  }
  if (!channel.hasDefaultValue && channel.switchingChannelAliases.length > 0) {
    result.errors.push(`defaultValue is missing in channel '${channel.key}' although it defines switching channels.`);
  }
  
  if (channel.color !== null && channel.type !== 'Single Color') {
    result.warnings.push(`color in channel '${channel.key}' defined but channel type is not 'Single Color'.`);
  }
  else if (channel.color === null && channel.type === 'Single Color') {
    result.errors.push(`color in channel '${channel.key}' undefined but channel type is 'Single Color'.`);
  }

  if (channel.hasDefaultValue && channel.defaultValue > channel.maxDmxBound) {
    result.errors.push(`defaultValue must be less or equal to ${channel.maxDmxBound} in channel '${channel.key}'.`);
  }

  if (channel.hasHighlightValue && channel.highlightValue > channel.maxDmxBound) {
    result.errors.push(`highlightValue must be less or equal to ${channel.maxDmxBound} in channel '${channel.key}'.`);
  }

  checkCapabilities(channel, minUsedFineness);
}

/**
 * Checks whether the specified string contains only allowed and all required variables
 * and pushes an error on wrong variable usage.
 * @param {!string} str The string to be checked.
 * @param {!string[]} [requiredVariables=[]] Variables that must be included in the string. Specify them with leading dollar sign ($var).
 * @param {!string[]} [allowedVariables=[]] Variables that may be included in the string; requiredVariables are automatically included. Specify them with leading dollar sign ($var).
 */
function checkTemplateVariables(str, requiredVariables=[], allowedVariables=[]) {
  allowedVariables = allowedVariables.concat(requiredVariables);

  const variables = str.match(/\$\w+/g) || [];
  for (const variable of variables) {
    if (!allowedVariables.includes(variable)) {
      result.errors.push(`Variable ${variable} not allowed in '${str}'`);
    }
  }
  for (const variable of requiredVariables) {
    if (!variables.includes(variable)) {
      result.errors.push(`Variable ${variable} missing in '${str}'`);
    }
  }
}

/**
 * Check that a channel's capabilities are valid.
 * @param {!Channel} channel The channel to test.
 * @param {number} minUsedFineness The smallest fineness that the channel is used in a mode. This controls how the capability ranges have to look like.
 */
function checkCapabilities(channel, minUsedFineness) {
  if (!channel.hasCapabilities) {
    return;
  }

  let rangesInvalid = false;

  for (let i = 0; i < channel.capabilities.length; i++) {
    const cap = channel.capabilities[i];
    
    // if one of the previous capabilities had an invalid range,
    // it doesn't make sense to check later ranges
    if (!rangesInvalid) {
      rangesInvalid = !checkRange(channel, i, minUsedFineness);
    }

    if ((cap.color || cap.image) && !['Multi-Color', 'Effect', 'Gobo'].includes(channel.type)) {
      result.errors.push(`color or image present in capability '${cap.name}' (#${i+1}) but improper channel type '${channel.type}' in channel '${channel.key}'.`);
    }

    if (cap.color2 && !cap.color) {
      result.errors.push(`color2 present but color missing in capability '${cap.name}' (#${i+1}) in channel '${channel.key}'.`);
    }

    if (cap.color && cap.image) {
      result.errors.push(`color and image cannot be present at the same time in capability '${cap.name}' (#${i+1}) in channel '${channel.key}'.`);
    }

    const switchingChannelAliases = Object.keys(cap.switchChannels);
    if (!arraysEqual(switchingChannelAliases, channel.switchingChannelAliases)) {
      result.errors.push(`Capability '${cap.name}' (#${i+1}) must define the same switching channel aliases as all other capabilities in channel '${channel.key}'.`);
    }
    else {
      for (const alias of switchingChannelAliases) {
        const chKey = cap.switchChannels[alias];
        usedChannelKeys.add(chKey.toLowerCase());

        if (channel.fixture.getChannelByKey(chKey) === null) {
          result.errors.push(`Channel '${chKey}' is referenced from capability '${cap.name}' (#${i+1}) in channel '${channel.key}' but is not defined.`);
        }
      }
    }
  }
}

/**
 * Check that a capability's range is valid.
 * @param {!Channel} channel The channel the capability belongs to.
 * @param {!number} capNumber The number of the capability in the channel, starting with 0.
 * @param {number} minUsedFineness The smallest fineness that the channel is used in a mode.This controls if this range can be from 0 up to channel.maxDmxBound or less.
 */
function checkRange(channel, capNumber, minUsedFineness) {
  const cap = channel.capabilities[capNumber];
  
  // first capability
  if (capNumber === 0 && cap.range.start !== 0) {
    result.errors.push(`The first range has to start at 0 in capability '${cap.name}' (#${capNumber+1}) in channel '${channel.key}'.`);
    return false;
  }
  
  // all capabilities
  if (cap.range.start > cap.range.end) {
    result.errors.push(`range invalid in capability '${cap.name}' (#${capNumber+1}) in channel '${channel.key}'.`);
    return false;
  }
  
  // not first capability
  const prevCap = capNumber > 0 ? channel.capabilities[capNumber-1] : null;
  if (capNumber > 0 && cap.range.start !== prevCap.range.end + 1) {
    result.errors.push(`ranges must be adjacent in capabilities '${prevCap.name}' (#${capNumber}) and '${cap.name}' (#${capNumber+1}) in channel '${channel.key}'.`);
    return false;
  }

  // last capability
  if (capNumber === channel.capabilities.length - 1) {
    const rawRangeEnd = channel.jsonObject.capabilities[capNumber].range[1];
    const possibleEndValues = getPossibleEndValues(minUsedFineness);
    
    if (!possibleEndValues.includes(rawRangeEnd)) {
      result.errors.push(`The last range has to end at ${possibleEndValues.join(' or ')} in capability '${cap.name}' (#${capNumber+1}) in channel '${channel.key}'`);
      return false;
    }
  }

  return true;
}

/**
 * Get the highest possible DMX value for each fineness up to the specified one.
 * E.g. fineness=2 -> [255, 65535, 16777215]
 * @param {!number} fineness The least used fineness in a mode of a channel.
 * @return {!number[]} Possible end values, sorted ascending.
 */
function getPossibleEndValues(fineness) {
  let values = [];
  for (let i = 0; i <= fineness; i++) {
    values.push(Math.pow(256, i+1)-1);
  }
  return values;
}

/**
 * Check that a mode is valid.
 * @param {!Mode} mode The mode to check.
 */
function checkMode(mode) {
  checkUniqueness(
    modeNames,
    mode.name,
    `Mode name '${mode.shortName}' not unique (test is not case-sensitive).`
  );
  checkUniqueness(
    modeShortNames,
    mode.shortName,
    `Mode shortName '${mode.shortName}' not unique (test is not case-sensitive).`
  );

  if (/\bmode\b/i.test(mode.name) || /\bmode\b/i.test(mode.shortName)) {
    result.errors.push(`Mode name and shortName must not contain the word 'mode' in mode '${mode.shortName}'.`);
  }

  checkPhysical(mode.physicalOverride, ` in mode '${mode.shortName}'`);

  let modeChannelKeyCount = {};

  for (let i = 0; i < mode.jsonObject.channels.length; i++) {
    checkModeChannelReference(i, mode, modeChannelKeyCount);
  }

  const duplicateChannelReferences = Object.keys(modeChannelKeyCount).filter(
    chKey => modeChannelKeyCount[chKey] > 1
  );
  if (duplicateChannelReferences.length > 0) {
    result.errors.push(`Channels ${duplicateChannelReferences} are used more than once in mode '${mode.shortName}'.`);
  }
}

/**
 * Check that a channel reference in a mode is valid.
 * @param {!number} chNumber The mode's channel index.
 * @param {!Mode} mode The mode to check.
 * @param {Object.<string, number>} modeChKeyCount An object to count the occurences of all used channel keys.
 */
function checkModeChannelReference(chNumber, mode, modeChKeyCount) {
  const chReference = mode.jsonObject.channels[chNumber];

  // this is a null channel 
  if (chReference === null) {
    return;
  }

  // this is a complex channel insert block (e.g. matrices)
  if (typeof chReference !== 'string') {
    checkChannelInsertBlock(chReference, modeChKeyCount);
    return;
  }

  const channel = mode.fixture.getChannelByKey(chReference);
  if (channel === null) {
    result.errors.push(`Channel '${chReference}' is referenced from mode '${mode.shortName}' but is not defined.`);
    return;
  }

  usedChannelKeys.add(channel.key.toLowerCase());
  modeChKeyCount[channel.key] = (modeChKeyCount[channel.key] || 0) + 1;

  if (channel instanceof SwitchingChannel) {
    checkSwitchingChannelReference(channel, mode, modeChKeyCount);
    return;
  }

  if (channel instanceof FineChannel) {
    checkCoarserChannelsInMode(channel, mode);
    return;
  }

  if (channel.type === 'Pan' || channel.type === 'Tilt') {
    checkPanTiltMaxInPhysical(channel, mode);
  }
}

function checkChannelInsertBlock(complexData, modeChKeyCount) {
  switch (complexData.insert) {
    case 'matrixChannels':
      checkMatrixReference(complexData, modeChKeyCount);
      return;

    // we need no default as other values are prohibited by the schema
  }
}

function checkMatrixReference(reference, modeChKeyCount) {
  // TODO
}

function checkSwitchingChannelReference(channel, mode, modeChKeyCount) {
  // the mode must also contain the trigger channel
  if (mode.getChannelIndex(channel.triggerChannel) === -1) {
    result.errors.push(`mode '${mode.shortName}' uses switching channel '${channel.key}' but is missing its trigger channel '${channel.triggerChannel.key}'`);
  }

  // if the channel can be switched to a fine channel, the mode must also contain coarser channels
  for (const switchToChannel of channel.switchToChannels) {
    if (switchToChannel === null) {
      // already raised an issue when switching channel was defined
      continue;
    }

    modeChKeyCount[switchToChannel.key] = (modeChKeyCount[switchToChannel.key] || 0) + 1;

    if (switchToChannel instanceof FineChannel) {
      checkCoarserChannelsInMode(switchToChannel, mode);
    }
  }
}

function checkCoarserChannelsInMode(channel, mode) {
  const coarseChannel = channel.coarseChannel;
  const coarserChannelKeys = coarseChannel.fineChannelAliases.filter(
    (alias, index) => index < channel.fineness - 1
  ).concat(coarseChannel.key);

  const notInMode = coarserChannelKeys.filter(
    chKey => mode.getChannelIndex(chKey) === -1
  );

  if (notInMode.length > 0) {
    result.errors.push(`Mode '${mode.shortName}' contains the fine channel '${channel.key}' but is missing its coarser channels ${notInMode}.`);
  }
}

function checkPanTiltMaxInPhysical(channel, mode) {
  const maxProp = channel.type === 'Pan' ? 'focusPanMax' : 'focusTiltMax';
  const maxPropDisplay = channel.type === 'Pan' ? 'panMax' : 'tiltMax';

  if (mode.physical[maxProp] === null) {
    result.warnings.push(`physical.${maxPropDisplay} is not defined although there's a ${channel.type} channel '${channel.key}' in mode '${mode.shortName}'.`);
  }
  else if (mode.physical[maxProp] === 0) {
    result.warnings.push(`physical.${maxPropDisplay} is 0 although there's a ${channel.type} channel '${channel.key}' in mode '${mode.shortName}'.`);
  }
}

function checkUnusedChannels() {
  const unused = [...definedChannelKeys].filter(
    chKey => !usedChannelKeys.has(chKey)
  );

  if (unused.length > 0) {
    result.warnings.push('Unused channel(s): ' + unused.join(', '));
  }
}

// returns whether the object contains data
function isNotEmpty(obj, messageIfEmpty) {
  if (obj !== undefined) {
    if (Object.keys(obj).length === 0) {
      result.errors.push(messageIfEmpty);
    }
    else {
      return true;
    }
  }
  return false;
}

function checkUniqueness(set, value, messageIfNotUnique) {
  if (set.has(value.toLowerCase())) {
    result.errors.push(messageIfNotUnique);
  }
  set.add(value.toLowerCase());
}


function getErrorString(description, error) {
  return description + ' ' + util.inspect(error, false, null);
}

function arraysEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (a == null || b == null || a.length !== b.length) {
    return false;
  }

  return a.every((val, index) => val === b[index]);
}
