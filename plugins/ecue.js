const fs = require('fs');
const path = require('path');
const colorNames = require('color-names');
const xml2js = require('xml2js');
const xmlbuilder = require('xmlbuilder');

module.exports.name = 'e:cue';
module.exports.version = '0.2.0';

module.exports.export = function exportEcue(library, options) {
  let outfiles = [];

  const defaults = require(path.join(options.baseDir, 'fixtures', 'defaults'));

  const timestamp = new Date().toISOString().replace(/T/, '#').replace(/\..+/, '');

  let xml = xmlbuilder.create(
    {
      Document: {
        '@Owner': 'user',
        '@TypeVersion': 2,
        '@SaveTimeStamp': timestamp
      }
    },
    {
      encoding: 'UTF-8',
      standalone: true
    }
  );
  let xmlLibrary = xml.ele({
    Library: {}
  });
  let xmlFixtures = xmlLibrary.ele({
    Fixtures: {}
  });
  let xmlTiles = xmlLibrary.ele({
    Tiles: {}
  });

  let xmlManFixtures = {};
  for (const data of library) {
    const filePath = path.join(options.baseDir, 'fixtures', data.manufacturerKey, data.fixtureKey + '.json');
    let fixture = Object.assign({}, defaults, JSON.parse(fs.readFileSync(filePath, 'utf-8')));

    if (fixture.shortName === null) {
      fixture.shortName = fixture.name;
    }

    let physical = Object.assign({}, defaults.physical, fixture.physical);
    physical.bulb = Object.assign({}, defaults.physical.bulb, fixture.physical.bulb);
    physical.lens = Object.assign({}, defaults.physical.lens, fixture.physical.lens);
    physical.focus = Object.assign({}, defaults.physical.focus, fixture.physical.focus);

    if (!(data.manufacturerKey in xmlManFixtures)) {
      const manData = options.manufacturers[data.manufacturerKey];

      let xmlMan = {
        'Manufacturer': {
          '@_CreationDate': timestamp,
          '@_ModifiedDate': timestamp,
          '@Name': manData.name,
          '@Comment': manData.comment || '',
          '@Web': manData.website || ''
        }
      };
      xmlManFixtures[data.manufacturerKey] = xmlFixtures.ele(xmlMan);
      xmlTiles.ele(xmlMan);
    }

    exportHandleModes(fixture, defaults, physical, xmlManFixtures[data.manufacturerKey]);
  }

  outfiles.push({
    name: 'UserLibrary.xml',
    content: xml.end({
      pretty: true,
      indent: '    '
    }),
    mimetype: 'application/xml'
  });

  return outfiles;
};

function exportHandleModes(fixture, defaults, physical, xmlMan) {
  const fixCreationDate = fixture.meta.createDate + '#00:00:00';
  const fixModifiedDate = fixture.meta.lastModifyDate + '#00:00:00';

  for (const mode of fixture.modes) {
    let modeData = Object.assign({}, defaults.modes[0], mode);
    modeData.physical = Object.assign({}, physical, modeData.physical);
    modeData.physical.bulb = Object.assign({}, physical.bulb, modeData.physical.bulb);
    modeData.physical.lens = Object.assign({}, physical.lens, modeData.physical.lens);
    modeData.physical.focus = Object.assign({}, physical.focus, modeData.physical.focus);

    if (modeData.shortName === null) {
      modeData.shortName = modeData.name;
    }

    let xmlFixture = xmlMan.ele({
      'Fixture': {
        '@_CreationDate': fixCreationDate,
        '@_ModifiedDate': fixModifiedDate,
        '@Name': fixture.name + (fixture.modes.length > 1 ? ` (${modeData.shortName} mode)` : ''),
        '@NameShort': fixture.shortName + (fixture.modes.length > 1 ? '-' + modeData.shortName : ''),
        '@Comment': fixture.comment,
        '@AllocateDmxChannels': mode.channels.length,
        '@Weight': modeData.physical.weight,
        '@Power': modeData.physical.power,
        '@DimWidth': modeData.physical.dimensions[0],
        '@DimHeight': modeData.physical.dimensions[1],
        '@DimDepth': modeData.physical.dimensions[2]
      }
    });

    let viewPosCount = 1;
    for (let dmxCount=0; dmxCount<mode.channels.length; dmxCount++) {
      let chKey = mode.channels[dmxCount];

      if (chKey === null) {
        // we already handled this as part of a 16-bit channel or it is a undefined channel, so just skip
        continue;
      }

      let channel = fixture.availableChannels[chKey];


      let dmxByte0 = dmxCount;
      let dmxByte1 = -1;

      if (!(chKey in fixture.availableChannels)) {
        // this is a fine channel

        const coarseChannelKey = Object.keys(fixture.availableChannels).find(coarseKey => 'fineChannelAliases' in fixture.availableChannels[coarseKey] && fixture.availableChannels[coarseKey].fineChannelAliases.includes(chKey));

        // use coarse channel's data
        channel = fixture.availableChannels[coarseChannelKey];

        const coarseChannelIndex = mode.channels.indexOf(coarseChannelKey);

        if (coarseChannelIndex !== -1) {
          dmxByte0 = coarseChannelIndex;
          dmxByte1 = dmxCount;

          mode.channels[dmxByte0] = null;
          mode.channels[dmxByte1] = null;
        }
        else {
          // coarse and first fine channel were already handled -> just pretend it's a single channel
          channel.name = (channel.name || coarseChannelKey) + ' fine^' + (channel.fineChannelAliases.indexOf(chKey) + 1);
          divideChannelDmxValues(channel, channel.fineChannelAliases.length - 1);
        }
      }
      else if ('fineChannelAliases' in fixture.availableChannels[chKey]) {
        const firstFineChannelIndex = mode.channels.indexOf(fixture.availableChannels[chKey].fineChannelAliases[0]);

        if (firstFineChannelIndex !== -1) {
          dmxByte1 = firstFineChannelIndex;

          mode.channels[dmxByte1] = null;
        }
        else {
          divideChannelDmxValues(channel, 1);
        }
      }

      dmxByte0++;
      dmxByte1++;

      if (!('name' in channel)) {
        channel.name = chKey;
      }

      let chData = Object.assign({}, defaults.availableChannels['channel key'], channel);

      let chType;
      switch (chData.type) {
        case 'MultiColor':
        case 'SingleColor':
          chType = 'Color';
          break;
        case 'Beam':
        case 'Shutter':
        case 'Strobe':
        case 'Gobo':
        case 'Prism':
        case 'Effect':
        case 'Speed':
        case 'Maintenance':
        case 'Nothing':
          chType = 'Beam';
          break;
        case 'Pan':
        case 'Tilt':
          chType = 'Focus';
          break;
        case 'Intensity':
        default:
          chType = 'Intensity';
      }

      let xmlChannelObj = {};
      xmlChannelObj[`Channel${chType}`] = {
        '@Name': chData.name,
        '@DefaultValue': chData.defaultValue,
        '@Highlight': chData.highlightValue,
        '@Deflection': 0,
        '@DmxByte0': dmxByte0,
        '@DmxByte1': dmxByte1,
        '@Constant': chData.constant ? 1 : 0,
        '@Crossfade': chData.crossfade ? 1 : 0,
        '@Invert': chData.invert ? 1 : 0,
        '@Precedence': chData.precedence,
        '@ClassicPos': viewPosCount++
      };
      let xmlChannel = xmlFixture.ele(xmlChannelObj);

      if ('capabilities' in channel) {
        for (const cap of channel.capabilities) {
          const capData = Object.assign({}, defaults.availableChannels['channel key'].capabilities[0], cap);
          xmlChannel.ele({
            'Range': {
              '@Name': capData.name,
              '@Start': capData.range[0],
              '@End': capData.range[1],
              '@AutoMenu': capData.menuClick === 'hidden' ? 0 : 1,
              '@Centre': capData.menuClick === 'center' ? 1 : 0
            }
          });
        }
      }
    }
  }
}

function divideChannelDmxValues(channel, times) {
  if ('highlightValue' in channel) {
    channel.highlightValue = Math.floor(channel.highlightValue / Math.pow(256, times));
  }
  if ('defaultValue' in channel) {
    channel.defaultValue = Math.floor(channel.defaultValue / Math.pow(256, times));
  }
  if ('capabilities' in channel) {
    for (const cap of channel.capabilities) {
      cap.range[0] = Math.floor(cap.range[0] / Math.pow(256, times));
      cap.range[1] = Math.floor(cap.range[1] / Math.pow(256, times));
    }
  }
}

module.exports.import = function importEcue(str, filename, resolve, reject) {
  let colors = {};
  for (const hex in colorNames) {
    colors[colorNames[hex].toLowerCase().replace(/\s/g, '')] = hex;
  }

  const parser = new xml2js.Parser();
  const timestamp = new Date().toISOString().replace(/T.*/, '');

  parser.parseString(str, (parseError, xml) => {
    if (parseError) {
      reject(`Error parsing '${filename}' as XML.\n` + parseError.toString());
      return;
    }

    let out = {
      manufacturers: {},
      fixtures: {},
      warnings: {}
    };

    try {
      if (!('Library' in xml.Document) || !('Fixtures' in xml.Document.Library[0]) || !('Manufacturer' in xml.Document.Library[0].Fixtures[0])) {
        reject('Nothing to import.');
        return;
      }

      for (const manufacturer of xml.Document.Library[0].Fixtures[0].Manufacturer) {
        const manName = manufacturer.$.Name;
        const manKey = manName.toLowerCase().replace(/[^a-z0-9\-]+/g, '-');

        out.manufacturers[manKey] = {
          name: manName
        };

        if (manufacturer.$.Comment !== '') {
          out.manufacturers[manKey].comment = manufacturer.$.Comment;
        }
        if (manufacturer.$.Web !== '') {
          out.manufacturers[manKey].website = manufacturer.$.Web;
        }

        if (!('Fixture' in manufacturer)) {
          continue;
        }

        for (const fixture of manufacturer.Fixture) {
          let fix = {
            name: fixture.$.Name
          };

          let fixKey = manKey + '/' + fix.name.toLowerCase().replace(/[^a-z0-9\-]+/g, '-');
          if (fixKey in out.fixtures) {
            fixKey += '-' + Math.random().toString(36).substr(2, 5);
            out.warnings[fixKey].push('Fixture key is not unique, appended random characters.');
          }
          out.warnings[fixKey] = [];

          if (fixture.$.NameShort !== '') {
            fix.shortName = fixture.$.NameShort;
          }

          fix.categories = ['Other'];
          out.warnings[fixKey].push('Please specify categories.');

          fix.meta = {
            authors: [],
            createDate: fixture.$._CreationDate.replace(/#.*/, ''),
            lastModifyDate: fixture.$._ModifiedDate.replace(/#.*/, ''),
            importPlugin: {
              plugin: 'ecue',
              date: timestamp
            }
          }
          out.warnings[fixKey].push('Please specify your name in meta.authors.');

          if (fixture.$.Comment !== '') {
            fix.comment = fixture.$.Comment;
          }

          let physical = {};

          if (fixture.$.DimWidth !== '10' && fixture.$.DimHeight !== '10' && fixture.$.DimDepth !== '10') {
            physical.dimensions = [parseInt(fixture.$.DimWidth), parseInt(fixture.$.DimHeight), parseInt(fixture.$.DimDepth)];
          }
          if (fixture.$.Weight !== '0') {
            physical.weight = parseFloat(fixture.$.Weight);
          }
          if (fixture.$.Power !== '0') {
            physical.power = parseInt(fixture.$.Power);
          }

          if (JSON.stringify(physical) !== '{}') {
            fix.physical = physical;
          }

          fix.availableChannels = {};
          fix.multiByteChannels = [];
          fix.modes = [{
            name: `${fixture.$.AllocateDmxChannels}-channel`,
            shortName: `${fixture.$.AllocateDmxChannels}ch`,
            channels: []
          }];


          let channels = [];

          if (fixture.ChannelIntensity) {
            channels = channels.concat(fixture.ChannelIntensity);
          }
          if (fixture.ChannelColor) {
            channels = channels.concat(fixture.ChannelColor);
          }
          if (fixture.ChannelBeam) {
            channels = channels.concat(fixture.ChannelBeam);
          }
          if (fixture.ChannelFocus) {
            channels = channels.concat(fixture.ChannelFocus);
          }

          channels = channels.sort((a, b) => {
            if (parseInt(a.$.DmxByte0) < parseInt(b.$.DmxByte0)) {
              return -1;
            }

            return (parseInt(a.$.DmxByte0) > parseInt(b.$.DmxByte0)) ? 1 : 0;
          });

          for (const channel of channels) {
            let ch = {};

            const name = channel.$.Name;
            const testName = name.toLowerCase();

            let shortName = name;
            if (shortName in fix.availableChannels) {
              shortName += '-' + Math.random().toString(36).substr(2, 5);
            }

            if (name !== shortName) {
              ch.name = name;
            }

            ch.type = 'Intensity';
            if ('ChannelColor' in fixture && fixture.ChannelColor.indexOf(channel) !== -1) {
              if (('Range' in channel && channel.Range.length > 1) || /colou?r\s*macro/.test(testName)) {
                ch.type = 'MultiColor';
              }
              else {
                ch.type = 'SingleColor';
                const colorFound = ['Red', 'Green', 'Blue', 'Cyan', 'Magenta', 'Yellow', 'Amber', 'White', 'UV', 'Lime'].some(color => {
                  if (testName.includes(color.toLowerCase())) {
                    ch.color = color;
                    return true;
                  }
                  return false;
                });

                if (!colorFound) {
                  out.warnings[fixKey].push(`Please add a color to channel '${shortName}'.`);
                }
              }
            }
            else if (testName.includes('speed')) {
              ch.type = 'Speed';
            }
            else if (testName.includes('gobo')) {
              ch.type = 'Gobo';
            }
            else if (testName.includes('program') || testName.includes('effect') || testName.includes('macro')) {
              ch.type = 'Effect';
            }
            else if (testName.includes('prism')) {
              ch.type = 'Prism';
            }
            else if (testName.includes('shutter')) {
              ch.type = 'Shutter';
            }
            else if (testName.includes('strob')) {
              ch.type = 'Strobe';
            }
            else if (testName.includes('pan')) {
              ch.type = 'Pan';
            }
            else if (testName.includes('tilt')) {
              ch.type = 'Tilt';
            }
            else if (testName.includes('reset')) {
              ch.type = 'Maintenance';
            }
            else if (fixture.ChannelBeam && fixture.ChannelBeam.indexOf(channel) !== -1) {
              ch.type = 'Beam';
            }
            else if (!testName.includes('intensity') && !testName.includes('master') && !testName.includes('dimmer')) {
              // not even a default Intensity channel
              out.warnings[fixKey].push(`Please check the type of channel '${shortName}'.`);
            }

            if (channel.$.DmxByte1 !== '0') {
              const shortNameFine = shortName + ' fine';
              ch.fineChannelAliases = [shortNameFine];
              fix.modes[0].channels[parseInt(channel.$.DmxByte1) - 1] = shortNameFine;
            }

            if (channel.$.DefaultValue !== '0') {
              ch.defaultValue = parseInt(channel.$.DefaultValue);
            }
            if (channel.$.Highlight !== '0') {
              ch.highlightValue = parseInt(channel.$.Highlight);
            }
            if (channel.$.Invert === '1') {
              ch.invert = true;
            }
            if (channel.$.Constant === '1') {
              ch.constant = true;
            }
            if (channel.$.Crossfade === '1') {
              ch.crossfade = true;
            }
            if (channel.$.Precedence === 'HTP') {
              ch.precedence = 'HTP';
            }

            if ('Range' in channel) {
              ch.capabilities = [];

              channel.Range.forEach((range, i) => {
                let cap = {
                  range: [parseInt(range.$.Start), parseInt(range.$.End)],
                  name: range.$.Name
                };

                if (cap.range[1] === -1) {
                  cap.range[1] = (i+1 < channel.Range.length) ? parseInt(channel.Range[i+1].$.Start) - 1 : 255;
                }

                // try to read a color
                let color = cap.name.toLowerCase().replace(/\s/g, '');
                if (color in colors) {
                  cap.color = colors[color];
                }

                if (range.$.AutoMenu !== '1') {
                  cap.menuClick = 'hidden';
                }
                else if (range.$.Centre !== '0') {
                  cap.menuClick = 'center';
                }

                ch.capabilities.push(cap);
              });
            }

            fix.availableChannels[shortName] = ch;
            fix.modes[0].channels[parseInt(channel.$.DmxByte0) - 1] = shortName;
          }

          if (fix.multiByteChannels.length === 0) {
            delete fix.multiByteChannels;
          }

          out.fixtures[fixKey] = fix;
        }
      }
    }
    catch (parseError) {
      reject(`Error parsing '${filename}'.\n` + parseError.toString());
      return;
    }

    resolve(out);
  });
}
