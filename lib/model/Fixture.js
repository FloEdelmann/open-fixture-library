/** @ignore @typedef {import('./AbstractChannel.js').default} AbstractChannel */
/** @ignore @typedef {import('./Capability.js').default} Capability */
import CoarseChannel from './CoarseChannel.js';
import FineChannel from './FineChannel.js';
import Manufacturer from './Manufacturer.js';
import Matrix from './Matrix.js';
import Meta from './Meta.js';
import Mode from './Mode.js';
import NullChannel from './NullChannel.js';
import Physical from './Physical.js';
import SwitchingChannel from './SwitchingChannel.js';
import TemplateChannel from './TemplateChannel.js';
import Wheel from './Wheel.js';

import packageJson from '../../package.json';


/*
  benchmark results for accessing fix.physical (10,000,000 iterations):
  - without cache: ~1.9s
  - with cache: ~0.52s (nearly 4 times faster!)
  => that proves why caching, even for these small objects, is useful

  Code:
    const benchmarkIterations = 10000000;
    function benchmark() {
      const t0 = process.hrtime();

      for (let i = 0; i < benchmarkIterations; i++) {
        fix1.physical;
      }

      const deltaT = process.hrtime(t0);

      console.log(deltaT);
    }
*/


/**
 * A physical DMX device.
 */
class Fixture {
  /**
   * Create a new Fixture instance.
   * @param {String|Manufacturer} man Either the fixture's manufacturer's key or a Manufacturer instance.
   * @param {String} key The fixture's unique key. Equals to filename without '.json'.
   * @param {Object} jsonObject The fixture's parsed JSON data.
   */
  constructor(man, key, jsonObject) {
    this.manufacturer = man; // calls the setter
    this._key = key;
    this.jsonObject = jsonObject; // also calls the setter
  }

  /**
   * @returns {Manufacturer} The fixture's manufacturer.
   */
  get manufacturer() {
    return this._manufacturer;
  }

  /**
   * @param {String|Manufacturer} newMan Either the fixture's manufacturer's key or a Manufacturer instance.
   */
  set manufacturer(newMan) {
    if (newMan instanceof Manufacturer) {
      this._manufacturer = newMan;
    }
    else {
      this._manufacturer = new Manufacturer(newMan);
    }
  }

  /**
   * @returns {String} The fixture's unique key. Equals to filename without '.json'.
   */
  get key() {
    return this._key;
  }

  /**
   * @returns {Object} The fixture's parsed JSON data.
   */
  get jsonObject() {
    return this._jsonObject;
  }

  /**
   * @param {Object} jsonObject The fixture's parsed JSON data.
   */
  set jsonObject(jsonObject) {
    this._jsonObject = jsonObject;
    this._cache = {};
  }

  /**
   * @returns {String} An URL pointing to the fixture's page on the Open Fixture Library website.
   */
  get url() {
    return `${packageJson.homepage}${this.manufacturer.key}/${this.key}`;
  }

  /**
   * @returns {String} The fixture's product name.
   */
  get name() {
    return this._jsonObject.name; // required
  }

  /**
   * @returns {Boolean} Whether a short name is defined for this fixture.
   */
  get hasShortName() {
    return `shortName` in this._jsonObject;
  }

  /**
   * @returns {String} A globally unique and as short as possible product name, defaults to name.
   */
  get shortName() {
    return this._jsonObject.shortName || this._jsonObject.name;
  }

  /**
   * @returns {Array.<String>} The fixture's categories with the most applicable one first.
   */
  get categories() {
    return this._jsonObject.categories; // required
  }

  /**
   * @returns {String} The fixture's most applicable category. Equals to first item of categories.
   */
  get mainCategory() {
    return this.categories[0];
  }

  /**
   * @returns {Meta} A Meta instance providing information like author or create date.
   */
  get meta() {
    if (!(`meta` in this._cache)) {
      this._cache.meta = new Meta(this._jsonObject.meta);
    }

    return this._cache.meta;
  }

  /**
   * @returns {Boolean} Whether a comment is defined for this fixture.
   */
  get hasComment() {
    return `comment` in this._jsonObject;
  }

  /**
   * @returns {Boolean} A comment about the fixture (often a note about a incorrectness in the manual). Defaults to an empty string.
   */
  get comment() {
    return this._jsonObject.comment || ``;
  }

  /**
   * @returns {String|null} A string describing the help that is needed for this fixture, or null if no help is needed.
   */
  get helpWanted() {
    return this._jsonObject.helpWanted || null;
  }

  /**
   * @returns {Boolean} True if help is needed in this fixture (maybe in a capability), false otherwise.
   */
  get isHelpWanted() {
    return this.helpWanted !== null || this.isCapabilityHelpWanted;
  }

  /**
   * @returns {Boolean} True if help is needed in a capability, false otherwise.
   */
  get isCapabilityHelpWanted() {
    if (!(`isCapabilityHelpWanted` in this._cache)) {
      this._cache.isCapabilityHelpWanted = this.allChannels.some(ch => ch.isHelpWanted);
    }

    return this._cache.isCapabilityHelpWanted;
  }

  /**
   * @returns {Object.<String, Array>|null} An object with URL arrays, organized by link type, or null if no links are available for this fixture.
   */
  get links() {
    return this._jsonObject.links || null;
  }

  /**
   * @param {String} type The type of the links that should be returned.
   * @returns {Array.<String>} An array of URLs of the specified type (may be empty).
   */
  getLinksOfType(type) {
    if (this.links === null) {
      return [];
    }

    return this.links[type] || [];
  }

  /**
   * @returns {Object|null} Information about the RDM functionality of this fixture. Defaults to null.
   * @property {Number} modelId The RDM model/product id of the fixture, given in decimal format.
   * @property {String|null} softwareVersion The software version used as reference in this fixture definition.
   */
  get rdm() {
    return this._jsonObject.rdm || null;
  }

  /**
   * @returns {Physical|null} The general physical information for the fixture, may be overridden by modes.
   */
  get physical() {
    if (!(`physical` in this._cache)) {
      this._cache.physical = `physical` in this._jsonObject ? new Physical(this._jsonObject.physical) : null;
    }

    return this._cache.physical;
  }

  /**
   * @returns {Matrix|null} The matrix information for this fixture.
   */
  get matrix() {
    if (!(`matrix` in this._cache)) {
      this._cache.matrix = `matrix` in this._jsonObject ? new Matrix(this._jsonObject.matrix) : null;
    }

    return this._cache.matrix;
  }

  /**
   * @returns {Array.<Wheel>} The fixture's wheels as {@link Wheel} instances.
   */
  get wheels() {
    if (!(`wheels` in this._cache)) {
      this._cache.wheels = Object.entries(this._jsonObject.wheels || {}).map(
        ([wheelName, wheelJson]) => new Wheel(wheelName, wheelJson)
      );
    }

    return this._cache.wheels;
  }

  /**
   * @param {String} wheelName The name of the wheel.
   * @returns {Wheel|null} The wheel with the given name, or null if no wheel with the given name exists.
   */
  getWheelByName(wheelName) {
    if (!(`wheelByName` in this._cache)) {
      this._cache.wheelByName = {};

      this.wheels.forEach(wheel => {
        this._cache.wheelByName[wheel.name] = wheel;
      });
    }

    return this._cache.wheelByName[wheelName] || null;
  }

  /**
   * @returns {Object.<String, String>} Channel keys from {@link Fixture#allChannelKeys} pointing to unique versions of their channel names.
   */
  get uniqueChannelNames() {
    if (!(`uniqueChannelNames` in this._cache)) {
      this._cache.uniqueChannelNames = {};

      const names = this.allChannels.map(ch => ch.name);

      for (let i = 0; i < names.length; i++) {
        const originalName = names[i];

        // make unique by appending ' 2', ' 3', ...
        let duplicates = 1;
        while (names.indexOf(names[i]) !== i) {
          duplicates++;
          names[i] = `${originalName} ${duplicates}`;
        }

        // save unique name
        this._cache.uniqueChannelNames[this.allChannelKeys[i]] = names[i];
      }
    }

    return this._cache.uniqueChannelNames;
  }

  /**
   * @returns {Array.<String>} Coarse channels from the fixture definition's `availableChannels` section. Ordered by appearance.
   */
  get availableChannelKeys() {
    if (!(`availableChannelKeys` in this._cache)) {
      this._cache.availableChannelKeys = Object.keys(this._jsonObject.availableChannels || {});
    }

    return this._cache.availableChannelKeys;
  }

  /**
   * @returns {Array.<CoarseChannel>} Coarse channels from the fixture definition's `availableChannels` section. Ordered by appearance.
   */
  get availableChannels() {
    if (!(`availableChannels` in this._cache)) {
      this._cache.availableChannels = this.availableChannelKeys.map(
        chKey => new CoarseChannel(chKey, this._jsonObject.availableChannels[chKey], this)
      );
    }

    return this._cache.availableChannels;
  }

  /**
   * @returns {Array.<String>} Coarse channels' keys, including matrix channels' keys. If possible, ordered by appearance.
   */
  get coarseChannelKeys() {
    if (!(`coarseChannelKeys` in this._cache)) {
      this._cache.coarseChannelKeys = this.coarseChannels.map(ch => ch.key);
    }

    return this._cache.coarseChannelKeys;
  }

  /**
   * @returns {Array.<CoarseChannel>} Coarse channels, including matrix channels. If possible, ordered by appearance.
   */
  get coarseChannels() {
    if (!(`coarseChannels` in this._cache)) {
      this._cache.coarseChannels = this.allChannels.filter(ch => ch instanceof CoarseChannel);
    }

    return this._cache.coarseChannels;
  }

  /**
   * @returns {Array.<String>} All fine channels' aliases, including matrix fine channels' aliases. If possible, ordered by appearance.
   */
  get fineChannelAliases() {
    if (!(`fineChannelAliases` in this._cache)) {
      this._cache.fineChannelAliases = this.fineChannels.map(ch => ch.key);
    }

    return this._cache.fineChannelAliases;
  }

  /**
   * @returns {Array.<FineChannel>} All fine channels, including matrix fine channels. If possible, ordered by appearance.
   */
  get fineChannels() {
    if (!(`fineChannels` in this._cache)) {
      this._cache.fineChannels = this.allChannels.filter(ch => ch instanceof FineChannel);
    }

    return this._cache.fineChannels;
  }

  /**
   * @returns {Array.<String>} All switching channels' aliases, including matrix switching channels' aliases. If possible, ordered by appearance.
   */
  get switchingChannelAliases() {
    if (!(`switchingChannelAliases` in this._cache)) {
      this._cache.switchingChannelAliases = this.switchingChannels.map(ch => ch.key);
    }

    return this._cache.switchingChannelAliases;
  }

  /**
   * @returns {Array.<SwitchingChannel>} All switching channels, including matrix switching channels. If possible, ordered by appearance.
   */
  get switchingChannels() {
    if (!(`switchingChannels` in this._cache)) {
      this._cache.switchingChannels = this.allChannels.filter(ch => ch instanceof SwitchingChannel);
    }

    return this._cache.switchingChannels;
  }

  /**
   * Template channels are used to automatically generate channels.
   * @returns {Array.<String>} All template channel keys from the fixture definition's `templateChannels` section. Ordered by appearance.
   */
  get templateChannelKeys() {
    return Object.keys(this._jsonObject.templateChannels || {});
  }

  /**
   * Template channels are used to automatically generate channels.
   * @returns {Array.<TemplateChannel>} TemplateChannel instances for all template channels from the fixture definition's `templateChannels` section. Ordered by appearance.
   */
  get templateChannels() {
    if (!(`templateChannels` in this._cache)) {
      this._cache.templateChannels = this.templateChannelKeys.map(
        key => new TemplateChannel(key, this._jsonObject.templateChannels[key], this)
      );
    }

    return this._cache.templateChannels;
  }

  /**
   * Searches the template channel with the given key. Fine and switching template channel aliases *can't* be found.
   * @param {String} chKey The template channel's key
   * @returns {TemplateChannel|null} The corresponding template channel.
   */
  getTemplateChannelByKey(chKey) {
    if (!(`templateChannelByKey` in this._cache)) {
      this._cache.templateChannelByKey = {};

      for (const channel of this.templateChannels) {
        this._cache.templateChannelByKey[channel.key] = channel;
      }
    }

    return this._cache.templateChannelByKey[chKey] || null;
  }

  /**
   * @returns {Array.<String>} Keys of all resolved matrix channels.
   */
  get matrixChannelKeys() {
    if (!(`matrixChannelKeys` in this._cache)) {
      this._cache.matrixChannelKeys = this.matrixChannels.map(ch => ch.key);
    }

    return this._cache.matrixChannelKeys;
  }

  /**
   * @returns {Array.<AbstractChannel>} All (resolved) channels with `pixelKey` information (including fine and switching channels).
   */
  get matrixChannels() {
    if (this.matrix === null) {
      return [];
    }

    if (!(`matrixChannels` in this._cache)) {
      this._cache.matrixChannels = this.allChannels.filter(ch => ch.pixelKey !== null);
    }

    return this._cache.matrixChannels;
  }

  /**
   * @returns {Array.<String>} All null channels' keys.
   */
  get nullChannelKeys() {
    return this.nullChannels.map(ch => ch.key);
  }

  /**
   * @returns {Array.<NullChannel>} Automatically generated null channels.
   */
  get nullChannels() {
    if (!(`nullChannels` in this._cache)) {
      // we only need to create as many NullChannels as in the mode with the most null channels
      // e.g. Mode 1: 1x null, Mode 2: 3x null, Mode 3: 2x null => 3 NullChannels
      const maxNullPerMode = Math.max(...this.modes.map(mode => mode.nullChannelCount));
      this._cache.nullChannels = [];
      for (let i = 0; i < maxNullPerMode; i++) {
        const channel = new NullChannel(this);
        this._cache.nullChannels.push(channel);
      }
    }

    return this._cache.nullChannels;
  }

  /**
   * @returns {Array.<String>} All channel keys used in this fixture, including resolved matrix channels' keys. If possible, ordered by appearance.
   */
  get allChannelKeys() {
    if (!(`allChannelKeys` in this._cache)) {
      this._cache.allChannelKeys = Object.keys(this.allChannelsByKey);
    }

    return this._cache.allChannelKeys;
  }

  /**
   * @returns {Array.<AbstractChannel>} All channels used in this fixture, including resolved matrix channels. If possible, ordered by appearance.
   */
  get allChannels() {
    if (!(`allChannels` in this._cache)) {
      this._cache.allChannels = Object.values(this.allChannelsByKey);
    }

    return this._cache.allChannels;
  }

  /**
   * @returns {Object.<String, AbstractChannel>} All channel keys used in this fixture pointing to the respective channel, including matrix channels. If possible, ordered by appearance.
   */
  get allChannelsByKey() {
    if (!(`allChannelsByKey` in this._cache)) {
      const allChannelsByKey = {};

      this.availableChannels.forEach(mainChannel => {
        [mainChannel, ...mainChannel.fineChannels, ...mainChannel.switchingChannels].forEach(ch => {
          allChannelsByKey[ch.key] = ch;
        });
      });

      this.nullChannels.forEach(ch => {
        allChannelsByKey[ch.key] = ch;
      });

      const allMatrixChannelsByKey = {};
      this.templateChannels.forEach(templateChannel => {
        templateChannel.createMatrixChannels().forEach(ch => {
          allMatrixChannelsByKey[ch.key] = ch;
        });
      });

      Object.values(allMatrixChannelsByKey).forEach(matrixChannel => {
        if (matrixChannel.key in allChannelsByKey) {
          // matrix channel is overridden by an available channel
          const overrideChannel = allChannelsByKey[matrixChannel.key];
          overrideChannel.pixelKey = matrixChannel.pixelKey;

          // move channel to the place where the matrix channel would have been inserted
          delete allChannelsByKey[matrixChannel.key];
          matrixChannel = overrideChannel;
        }

        // check if matrix channel is used in a mode's channel list
        // (maybe indirect in switching channels)
        const matrixChannelUsed = this.modes.some(
          mode => mode.channelKeys.some(chKey => {
            if (matrixChannel.key === chKey) {
              // matrix channel used directly
              return true;
            }

            const otherChannel = allChannelsByKey[chKey] || allMatrixChannelsByKey[chKey];
            if (otherChannel instanceof SwitchingChannel && otherChannel.switchToChannelKeys.includes(matrixChannel.key)) {
              // matrix channel used in a switching channel
              return true;
            }

            return false;
          })
        );

        if (matrixChannelUsed) {
          allChannelsByKey[matrixChannel.key] = matrixChannel;
        }
      });

      this._cache.allChannelsByKey = allChannelsByKey;
    }

    return this._cache.allChannelsByKey;
  }

  /**
   * @param {String} key The channel's key.
   * @returns {AbstractChannel|null} The found channel, null if not found.
   */
  getChannelByKey(key) {
    return this.allChannelsByKey[key] || null;
  }

  /**
   * @returns {Array.<Capability>} All available channels' and template channels' capabilities.
   */
  get capabilities() {
    if (!(`capabilities` in this._cache)) {
      const channels = this.availableChannels.concat(this.templateChannels);
      this._cache.capabilities = channels.flatMap(channel => channel.capabilities);
    }

    return this._cache.capabilities;
  }

  /**
   * @returns {Array.<Mode>} The fixture's modes.
   */
  get modes() {
    if (!(`modes` in this._cache)) {
      this._cache.modes = this._jsonObject.modes.map(jsonMode => new Mode(jsonMode, this));
    }

    return this._cache.modes;
  }
}

export default Fixture;
