const xmlbuilder = require('xmlbuilder');
const sanitize = require('sanitize-filename');

const FineChannel = require('../../lib/model/FineChannel.js');
const SwitchingChannel = require('../../lib/model/SwitchingChannel.js');

module.exports.name = 'D::Light';
module.exports.version = '0.1.0';

module.exports.export = function exportDLight(fixtures, options) {
  let deviceFiles = [];

  for (const fixture of fixtures) {
    // add device for each mode
    for (const mode of fixture.modes) {
      let xml = xmlbuilder.begin()
        .declaration('1.0')
        .element({
          Device: {
            frames: {
              '@id': mode.channels.length
            },
            ManufacturerName: fixture.manufacturer.name,
            ModelName: `${fixture.name} (${mode.name})`,
            creationDate: fixture.meta.createDate.toISOString().split('T')[0]
          }
        })
        .element('Attributes');

      // channels are grouped by their channel type which is called AttributesDefinition in D::Light
      const channelsByAttribute = getChannelsByAttribute(mode.channels);
      for (const attribute of Object.keys(channelsByAttribute)) {
        addAttribute(xml, mode, attribute, channelsByAttribute[attribute]);
      }

      deviceFiles.push({
        name: `${fixture.manufacturer.key}/${fixture.key}-${sanitize(mode.shortName)}.xml`,
        content: xml.end({
          pretty: true,
          indent: '  '
        }),
        mimetype: 'application/xml'
      });
    }
  }

  return deviceFiles;
};

function addAttribute(xml, mode, attribute, channels) {
  const xmlAttribute = xml.element({
    AttributesDefinition: {
      '@id': attribute,
      '@length': channels.length
    }
  });

  for (let i = 0; i < channels.length; i++) {
    addChannel(xmlAttribute, mode, channels[i], i);
  }
}

function addChannel(xmlAttribute, mode, channel, index) {
  let xmlChannel = xmlAttribute.element({
    ThisAttribute: {
      '@id': index,
      HOME: {
        '@id': getDefaultValue(channel)
      },
      addressIndex: {
        '@id': mode.getChannelIndex(channel)
      },
      parameterName: {
        '@id': channel.uniqueName
      },
      minLevel: {
        '@id': 0
      },
      maxLevel: {
        '@id': 255
      }
    }
  });
}

function getDefaultValue(channel) {
  if (channel instanceof SwitchingChannel) {
    return getDefaultValue(channel.defaultChannel);
  }
  if (channel instanceof FineChannel) {
    return channel.defaultValue;
  }
  return channel.getDefaultValueWithFineness(0);
}

function getChannelsByAttribute(channels) {
  let channelsByAttribute = {
    'INTENSITY': [],
    'COLOUR': [],
    'FOCUS': [],
    'BEAM': [],
    'BLADE': [],
    'EFFECT': [],
    'CONTROL': [],
    'EXTRA': [],
    'FINE': []
  };

  for (let channel of channels) {
    channelsByAttribute[getChannelAttribute(channel)].push(channel);
  }

  const emptyAttributes = Object.keys(channelsByAttribute).filter(
    attribute => channelsByAttribute[attribute].length === 0
  );
  for (const emptyAttribute of emptyAttributes) {
    delete channelsByAttribute[emptyAttribute];
  }
  
  return channelsByAttribute;
}

function getChannelAttribute(channel) {
  if (channel instanceof SwitchingChannel) {
    channel = channel.defaultChannel;
  }
  if (channel instanceof FineChannel) {
    if (channel.fineness === 1) {
      return 'FINE';
    }
    return 'EXTRA';
  }

  switch (channel.type) {
    case 'Intensity':
      return 'INTENSITY';

    case 'SingleColor':
    case 'MultiColor':
      return 'COLOUR';

    case 'Pan':
    case 'Tilt':
      return 'FOCUS';

    case 'Beam':
      return 'BEAM';

    case 'Strobe':
    case 'Shutter':
    case 'Speed':
    case 'Gobo':
    case 'Prism':
    case 'Effect':
      return 'EFFECT';

    case 'Maintenance':
      return 'CONTROL';

    case 'Nothing':
    default:
      return 'EXTRA';
  }
}