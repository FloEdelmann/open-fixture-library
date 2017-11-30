const FineChannel = require('../../lib/model/FineChannel.js');

module.exports = [{
  name: 'Switches fine channels',
  description: 'Whether at least one switching channel switches fine channels',
  hasFeature: fixture => fixture.switchingChannels.some(
    switchingChannel => switchingChannel.switchToChannels.some(
      channel => channel instanceof FineChannel
    )
  )
}];