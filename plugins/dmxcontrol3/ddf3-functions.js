const xmlbuilder = require(`xmlbuilder`);

const { Capability, CoarseChannel } = require(`../../lib/model.js`);

module.exports = {
  const: {
    isCapSuitable: cap => cap._channel.isConstant,
    create: (channel, caps) => {
      const xmlConst = xmlbuilder.create(`const`);
      xmlConst.attribute(`val`, channel.getDefaultValueWithResolution(CoarseChannel.RESOLUTION_8BIT));
      return xmlConst;
    }
  },
  dimmer: {
    isCapSuitable: cap => cap.type === `Intensity`,
    create: (channel, caps) => {
      const xmlDimmer = xmlbuilder.create(`dimmer`);

      if (channel.capabilities.length > 1 || caps[0].brightness[0].number !== 0) {
        const dmxControlCaps = getSingleUnitCapabilities(caps, `brightness`, `%`);
        dmxControlCaps.forEach(cap => {
          const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
          xmlCap.attribute(`type`, `linear`);
          xmlDimmer.importDocument(xmlCap);
        });
      }

      return xmlDimmer;
    }
  },
  shutter: {
    isCapSuitable: cap => {
      const isShutterCap = cap.type === `ShutterStrobe` && [`Open`, `Closed`].includes(cap.shutterEffect);
      const channelHasOpen = cap._channel.capabilities.some(cap => cap.shutterEffect === `Open`);
      const channelHasClosed = cap._channel.capabilities.some(cap => cap.shutterEffect === `Closed`);
      return isShutterCap && channelHasOpen && channelHasClosed;
    },
    create: (channel, caps) => {
      const xmlShutter = xmlbuilder.create(`shutter`);

      caps.forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap);
        xmlCap.attribute(`type`, cap.shutterEffect.toLowerCase());
        xmlShutter.importDocument(xmlCap);
      });

      return xmlShutter;
    }
  },
  strobe: {
    isCapSuitable: cap =>
      (cap.type === `ShutterStrobe` && ![`Open`, `Closed`].includes(cap.shutterEffect)) ||
      (cap.type === `NoFunction` && cap._channel.type === `Strobe`),
    create: (channel, caps) => {
      const xmlStrobe = xmlbuilder.create(`strobe`);

      caps.forEach(cap => {
        let xmlCap;

        if (cap.speed) {
          const [dmxControlCap] = getSingleUnitCapabilities([cap], `speed`, `Hz`, 0, 50);
          xmlCap = getBaseXmlCapability(cap, dmxControlCap.startValue, dmxControlCap.endValue);
        }
        else {
          xmlCap = getBaseXmlCapability(cap);
        }

        xmlCap.attribute(`type`, getStrobeType(cap));
        xmlStrobe.importDocument(xmlCap);
      });

      return xmlStrobe;

      /**
       * @param {Capability} cap A ShutterStrobe capability, excluding Open and Closed or a NoFunction capability
       * @returns {string} The strobe type that should be used in the DMXControl capability.
       */
      function getStrobeType(cap) {
        if (cap.type === `NoFunction`) {
          return `open`;
        }

        const typePerShutterEffect = {
          Strobe: cap.randomTiming ? `random` : `linear`,
          Pulse: `pulse`,
          RampUp: `ramp up`,
          RampDown: `ramp down`,
          RampUpDown: `ramp up/down`,
          Lightning: `lightning`,
          Spikes: `spikes`
        };
        return typePerShutterEffect[cap.shutterEffect];
      }
    }
  },
  strobeSpeed: {
    isCapSuitable: cap => cap.type === `StrobeSpeed`,
    create: (channel, caps) => {
      const xmlSpeed = xmlbuilder.create(`strobespeed`);

      const dmxControlCaps = getSingleUnitCapabilities(caps, `speed`, `Hz`, 0, 50);
      dmxControlCaps.forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlSpeed.importDocument(xmlCap);
      });

      return xmlSpeed;
    }
  },
  strobeDuration: {
    isCapSuitable: cap => cap.type === `StrobeDuration`,
    create: (channel, caps) => {
      const xmlDuration = xmlbuilder.create(`duration`);

      getSingleUnitCapabilities(caps, `duration`, `s`, 0, 2).forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue * 1000, cap.endValue * 1000);
        xmlCap.attribute(`type`, `linear`);
        xmlDuration.importDocument(xmlCap);
      });

      return xmlDuration;
    }
  },
  pan: {
    isCapSuitable: cap => cap.type === `Pan`,
    create: (channel, caps) => {
      const xmlPan = xmlbuilder.create(`pan`);

      caps.forEach(cap => {
        xmlPan.element(`range`, {
          range: cap.angle[1].number - cap.angle[0].number
        });
      });

      return xmlPan;
    }
  },
  tilt: {
    isCapSuitable: cap => [`Pan`, `Tilt`].includes(cap.type),
    create: (channel, caps) => {
      const xmlTilt = xmlbuilder.create(`tilt`);

      caps.forEach(cap => {
        xmlTilt.element(`range`, {
          range: cap.angle[1].number - cap.angle[0].number
        });
      });

      return xmlTilt;
    }
  },
  panTiltSpeed: {
    isCapSuitable: cap => cap.type === `PanTiltSpeed`,
    create: (channel, caps) => {
      const xmlPanTiltSpeed = xmlbuilder.create(`ptspeed`);

      const speedCaps = getSingleUnitCapabilities(
        caps.filter(cap => cap.speed !== null), `speed`, `%`
      );
      const durationCaps = getSingleUnitCapabilities(
        caps.filter(cap => cap.duration !== null), `duration`, `%`
      );

      speedCaps.forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlCap.attribute(`type`, `linear`);
        xmlPanTiltSpeed.importDocument(xmlCap);
      });

      durationCaps.forEach(cap => {
        // 100% duration means low speed, so we need to invert this
        const xmlCap = getBaseXmlCapability(cap.capObject, 100 - cap.startValue, 100 - cap.endValue);
        xmlCap.attribute(`type`, `linear`);
        xmlPanTiltSpeed.importDocument(xmlCap);
      });

      return xmlPanTiltSpeed;
    }
  },
  color: {
    isCapSuitable: cap => cap.type === `ColorIntensity` || (cap.type === `NoFunction` && cap._channel.type === `Single Color`),
    create: (channel, caps) => {
      const capsPerColor = {};

      for (const cap of caps) {
        if (!(cap.color in capsPerColor)) {
          capsPerColor[cap.color] = [];
        }
        capsPerColor[cap.color].push(cap);
      }

      delete capsPerColor.null; // NoFunction caps will be ignored

      return Object.keys(capsPerColor).map((color, index) => {
        const colorCaps = capsPerColor[color];
        const xmlColor = xmlbuilder.create(color.toLowerCase());

        if (Object.keys(capsPerColor).length > 1) {
          const dmxControlCaps = getSingleUnitCapabilities(colorCaps, `brightness`, `%`);
          dmxControlCaps.forEach(cap => {
            const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
            xmlCap.attribute(`type`, `linear`);
            xmlColor.importDocument(xmlCap);
          });
        }

        return xmlColor;
      });
    }
  },
  colorWheel: {
    isCapSuitable: cap => cap.isSlotType(`Color`) || cap.type === `ColorPreset` || (cap.type === `WheelRotation` && cap.speed && cap.wheels.some(wheel => wheel.type === `Color`)),
    create: (channel, caps) => {
      const xmlColorWheel = xmlbuilder.create(`colorwheel`);

      // RGB value for dummy colors. Will be decremented by 1 every time a dummy color is created.
      let greyValue = 0x99;

      const presetCaps = caps.filter(cap => cap.isSlotType(`Color`) || cap.type === `ColorPreset`);

      // split proportional caps so we only have stepped caps
      for (let i = 0; i < presetCaps.length; i++) {
        const cap = presetCaps[i];

        if (!cap.isStep) {
          const splittedCaps = getSplittedCapabilities(cap);
          presetCaps.splice(i, 1, ...splittedCaps);
        }
      }

      // merge adjacent stepped caps
      for (let i = 0; i < presetCaps.length; i++) {
        const cap = presetCaps[i];

        if (i + 1 < presetCaps.length) {
          const nextCap = presetCaps[i + 1];
          const mergedCapability = getMergedCapability(cap, nextCap);

          if (mergedCapability) {
            presetCaps.splice(i, 2, mergedCapability);
            i--; // maybe the merged capability can be merged another time
          }
        }
      }

      presetCaps.forEach(cap => {
        xmlColorWheel.element(`step`, {
          type: `color`,
          val: getColor(cap),
          mindmx: cap.getDmxRangeWithResolution(CoarseChannel.RESOLUTION_8BIT).start,
          maxdmx: cap.getDmxRangeWithResolution(CoarseChannel.RESOLUTION_8BIT).end,
          caption: cap.name
        });
      });


      const rotationCaps = getSingleUnitCapabilities(
        caps.filter(cap => cap.type === `WheelRotation`), `speed`, `Hz`, 0, 15
      );
      if (rotationCaps.length > 0) {
        const xmlWheelRotation = xmlColorWheel.element(`wheelrotation`);
        rotationCaps.forEach(cap => xmlWheelRotation.importDocument(getRotationSpeedXmlCapability(cap)));
      }

      return xmlColorWheel;

      /**
       * @param {Capability} cap A capability with different start/end values.
       * @returns {array.<Capability>} One capability representing the start value and one representing the end value.
       */
      function getSplittedCapabilities(cap) {
        const startCapJson = {
          dmxRange: [cap.rawDmxRange.start, cap.rawDmxRange.start],
          _splitted: true
        };
        const centerCapJson = {
          dmxRange: [cap.rawDmxRange.center, cap.rawDmxRange.center],
          _splitted: true
        };
        const endCapJson = {
          dmxRange: [cap.rawDmxRange.end, cap.rawDmxRange.end],
          _splitted: true
        };

        Object.entries(cap.jsonObject).forEach(([key, value]) => {
          if (key === `dmxRange`) {
            return;
          }

          if (key.includes(`Start`)) {
            key = key.replace(`Start`, ``);
            startCapJson[key] = value;
          }
          else if (key.includes(`End`)) {
            key = key.replace(`End`, ``);
            endCapJson[key] = value;
          }
          else {
            startCapJson[key] = value;
            centerCapJson[key] = value;
            endCapJson[key] = value;
          }
        });

        if (cap.hasComment) {
          const startEndRegex = /^([a-z0-9 ]+?) *(?:…|->?|\bto\b) *([a-z0-9 ]+?)$/i; // Red…Blue, Red to Blue, Red -> Blue, Red-Blue, ...
          const match = startEndRegex.exec(cap.comment);

          if (match) {
            const [, startColorName, endColorName] = match;
            startCapJson.comment = startColorName.replace(/^[a-z]/, firstLetter => firstLetter.toUpperCase());
            endCapJson.comment = endColorName.replace(/^[a-z]/, firstLetter => firstLetter.toUpperCase());
          }
        }

        if (`slotNumber` in startCapJson) {
          centerCapJson.slotNumber = (cap.slotNumber[0].number + cap.slotNumber[1].number) / 2;
        }
        if (`colors` in startCapJson) {
          centerCapJson.colors = cap.colors.allColors;
        }

        const [startCap, centerCap, endCap] = [startCapJson, centerCapJson, endCapJson].map(
          capJson => new Capability(capJson, cap._resolution, cap._channel)
        );

        if (cap.slotNumber) {
          return [startCap, centerCap, endCap];
        }
        return [startCap, endCap];
      }

      /**
       * @param {Capability} cap1 A capability.
       * @param {Capability} cap2 Another capability.
       * @returns {Capability|null} A capability that combines the values of both given capabilities. Null if merging was not possible.
       */
      function getMergedCapability(cap1, cap2) {
        if (!cap1.rawDmxRange.isAdjacentTo(cap2.rawDmxRange)) {
          return null;
        }

        const filterDistiguishableKeys = key => ![`dmxRange`, `_splitted`, `menuClick`].includes(key);
        const distinguishableKeys1 = Object.keys(cap1.jsonObject).filter(filterDistiguishableKeys);
        const distinguishableKeys2 = Object.keys(cap2.jsonObject).filter(filterDistiguishableKeys);
        const hasDifferentKeys = !arraysEqual(distinguishableKeys1, distinguishableKeys2);
        const hasDifferentValues = distinguishableKeys1.some(key => {
          const value1 = cap1.jsonObject[key];
          const value2 = cap2.jsonObject[key];

          if (key === `slotNumber`) {
            // slotNumber 8 and slotNumber 1 are the same slots if the wheel only has 7 slots
            return !arraysEqual(cap1.wheelSlot, cap2.wheelSlot);
          }

          return value1 !== value2 && !arraysEqual(value1, value2);
        });
        if (hasDifferentKeys || hasDifferentValues) {
          return null;
        }

        const capJson = {};
        const preferredJsonObject = !cap1.jsonObject._splitted ? cap1.jsonObject : cap2.jsonObject; // we prefer unsplitted caps
        Object.entries(preferredJsonObject).forEach(([key, value]) => {
          capJson[key] = value;
        });

        const dmxRange = cap1.rawDmxRange.getRangeMergedWith(cap2.rawDmxRange);
        capJson.dmxRange = [dmxRange.start, dmxRange.end];

        return new Capability(capJson, cap1._resolution, cap1._channel);
      }

      /**
       * @param {Capability} cap A capability.
       * @returns {string} A color from the given capability's color data if there's only one color. A generic (and probably unique) grey color instead.
       */
      function getColor(cap) {
        if (cap.colors && cap.colors.allColors.length === 1) {
          return cap.colors.allColors[0];
        }

        const hex = (greyValue--).toString(16);
        return `#${hex}${hex}${hex}`;
      }
    }
  },
  colorTemperature: {
    isCapSuitable: cap => cap.type === `ColorTemperature`,
    create: (channel, caps) => {
      const xmlColorTemp = xmlbuilder.create(`colortemp`);

      const zeroPercentValue = 8000 - ((8000 - 2500) / 2);
      const dmxControlCaps = getSingleUnitCapabilities(caps, `colorTemperature`, `K`, zeroPercentValue, 8000);
      dmxControlCaps.forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlCap.attribute(`type`, `linear`);
        xmlColorTemp.importDocument(xmlCap);
      });

      return xmlColorTemp;
    }
  },
  goboWheel: {
    isCapSuitable: cap => cap.isSlotType(`Gobo`) || (cap.type === `WheelRotation` && cap.speed && cap.wheels.some(wheel => wheel.type === `Gobo`)),
    create: (channel, caps) => {
      const xmlGoboWheel = xmlbuilder.create(`gobowheel`);

      const capsPerSlot = {};

      // search for first normal cap and first shaking cap per index
      // further caps of the same index will be ignored (for now)
      const slotCaps = caps.filter(cap => cap.isSlotType(`Gobo`));
      slotCaps.forEach(cap => {
        const slotNumber = `${cap.slotNumber[0]}…${cap.slotNumber[1]}`;

        if (!(slotNumber in capsPerSlot)) {
          capsPerSlot[slotNumber] = {
            normalCap: null,
            shakingCap: null
          };
        }

        if (cap.type !== `WheelShake` && !capsPerSlot[slotNumber].normalCap) {
          capsPerSlot[slotNumber].normalCap = cap;
        }
        else if (cap.type === `WheelShake` && !capsPerSlot[slotNumber].shakingCap) {
          capsPerSlot[slotNumber].shakingCap = cap;
        }
      });

      const usesShake = Object.values(capsPerSlot).some(({ shakingCap }) => shakingCap !== null);
      if (usesShake) {
        xmlGoboWheel.element(`goboshake`);
      }

      Object.values(capsPerSlot).forEach(({ normalCap, shakingCap }) => {
        if (normalCap) {
          const xmlCap = getBaseXmlCapability(normalCap);
          xmlCap.attribute(`type`, normalCap.isSlotType(`Open`) ? `open` : `gobo`);
          xmlCap.attribute(`caption`, normalCap.name);

          if (shakingCap) {
            let xmlShakeCap;

            if (shakingCap.shakeSpeed) {
              const [dmxControlCap] = getSingleUnitCapabilities([shakingCap], `shakeSpeed`, `Hz`, 0, 20);
              xmlShakeCap = getBaseXmlCapability(shakingCap, dmxControlCap.startValue, dmxControlCap.endValue);
            }
            else {
              xmlShakeCap = getBaseXmlCapability(shakingCap);
            }

            xmlShakeCap.attribute(`handler`, `goboshake`);
            xmlCap.importDocument(xmlShakeCap);
          }

          xmlGoboWheel.importDocument(xmlCap);
        }
      });

      const rotationCaps = getSingleUnitCapabilities(
        caps.filter(cap => cap.type === `WheelRotation`), `speed`, `Hz`, 0, 15
      );
      if (rotationCaps.length > 0) {
        const xmlWheelRotation = xmlGoboWheel.element(`wheelrotation`);
        rotationCaps.forEach(cap => xmlWheelRotation.importDocument(getRotationSpeedXmlCapability(cap)));
      }

      return xmlGoboWheel;
    }
  },
  goboIndex: { // gobo stencil rotation angle
    isCapSuitable: cap => cap.type === `WheelSlotRotation` && cap.wheels.some(wheel => wheel.type === `Gobo`) && cap.angle !== null,
    create: (channel, caps) => {
      const xmlGoboIndex = xmlbuilder.create(`goboindex`);

      getSingleUnitCapabilities(caps, `angle`, `deg`, 0, 360).forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlCap.attribute(`range`, Math.abs(cap.endValue - cap.startValue));
        xmlGoboIndex.importDocument(xmlCap);
      });

      return xmlGoboIndex;
    }
  },
  goboRotation: { // gobo stencil rotation speed
    isCapSuitable: cap => cap.type === `WheelSlotRotation` && cap.wheels.some(wheel => wheel.type === `Gobo`) && cap.speed !== null,
    create: (channel, caps) => {
      const xmlGoboRotation = xmlbuilder.create(`goborotation`);

      getSingleUnitCapabilities(caps, `speed`, `Hz`, 0, 5).forEach(cap => {
        const xmlCap = getRotationSpeedXmlCapability(cap);
        xmlGoboRotation.importDocument(xmlCap);
      });

      return xmlGoboRotation;
    }
  },
  goboShake: { // gobo shake speed
    isCapSuitable: cap => cap.type === `WheelShake` && cap.wheels.some(wheel => wheel.type === `Gobo`) && cap.wheelSlot === null && cap.shakeSpeed !== null,
    create: (channel, caps) => {
      const xmlGoboShake = xmlbuilder.create(`goboshake`);

      getSingleUnitCapabilities(caps, `shakeSpeed`, `Hz`, 0, 20).forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlGoboShake.importDocument(xmlCap);
      });

      return xmlGoboShake;
    }
  },
  focus: {
    isCapSuitable: cap => cap.type === `Focus`,
    create: (channel, caps) => {
      const xmlFocus = xmlbuilder.create(`focus`);

      const dmxControlCaps = getSingleUnitCapabilities(caps, `distance`, `%`);
      dmxControlCaps.forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlCap.attribute(`type`, `linear`);
        xmlFocus.importDocument(xmlCap);
      });

      return xmlFocus;
    }
  },
  frost: {
    isCapSuitable: cap => cap.type === `Frost`,
    create: (channel, caps) => {
      const xmlFrost = xmlbuilder.create(`frost`);

      if (caps.length > 1) {
        caps.forEach(cap => {
          let xmlCap;

          if (cap.frostIntensity[0].number !== cap.frostIntensity[1].number) {
            xmlCap = getBaseXmlCapability(cap, cap.frostIntensity[0].number, cap.frostIntensity[1].number);
            xmlCap.attribute(`type`, `frost`);
          }
          else {
            // generate <step>s with value="true" or value="false"
            // this is not documented, but used in other fixtures
            const isFrostOn = cap.frostIntensity[0].number > 0;
            xmlCap = getBaseXmlCapability(cap);
            xmlCap.attribute(`value`, `${isFrostOn}`);
          }

          xmlFrost.importDocument(xmlCap);
        });
      }

      return xmlFrost;
    }
  },
  iris: {
    isCapSuitable: cap => cap.type === `Iris`,
    create: (channel, caps) => {
      const xmlIris = xmlbuilder.create(`iris`);

      const dmxControlCaps = getSingleUnitCapabilities(caps, `openPercent`, `%`);
      dmxControlCaps.forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlCap.attribute(`type`, `linear`);
        xmlIris.importDocument(xmlCap);
      });

      return xmlIris;
    }
  },
  zoom: {
    isCapSuitable: cap => cap.type === `Zoom`,
    create: (channel, caps) => {
      const xmlZoom = xmlbuilder.create(`zoom`);

      const dmxControlCaps = getSingleUnitCapabilities(caps, `angle`, `deg`, 0, 90);
      dmxControlCaps.forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlCap.attribute(`type`, `linear`);
        xmlZoom.importDocument(xmlCap);
      });

      return xmlZoom;
    }
  },
  prism: {
    isCapSuitable: cap => cap.type === `Prism` || (cap.type === `NoFunction` && cap._channel.type === `Prism`),
    create: (channel, caps) => {
      const xmlPrism = xmlbuilder.create(`prism`);

      const hasRotationAngleCaps = caps.some(cap => cap.angle !== null);
      const hasRotationSpeedCaps = caps.some(cap => cap.speed !== null);

      if (hasRotationAngleCaps) {
        xmlPrism.element(`prismindex`);
      }

      if (hasRotationSpeedCaps) {
        xmlPrism.element(`prismrotation`);
      }


      // group adjacent capabilities by comment
      const capsGroupedByComment = [];
      caps.forEach(cap => {
        const lastGroup = capsGroupedByComment[capsGroupedByComment.length - 1];

        if (lastGroup && lastGroup[0].type === cap.type && lastGroup[0].comment === cap.comment) {
          // push to last group
          lastGroup.push(cap);
        }
        else {
          // push new group
          capsGroupedByComment.push([cap]);
        }
      });

      capsGroupedByComment.forEach(commentGroup => {
        const firstCap = commentGroup[0];
        const lastCap = commentGroup[commentGroup.length - 1];

        const xmlStep = xmlPrism.element(`step`, {
          type: firstCap.type === `NoFunction` ? `open` : `prism`,
          mindmx: firstCap.getDmxRangeWithResolution(CoarseChannel.RESOLUTION_8BIT).start,
          maxdmx: lastCap.getDmxRangeWithResolution(CoarseChannel.RESOLUTION_8BIT).end,
          caption: firstCap.name
        });

        // add ranges for capabilities without rotation speed
        commentGroup.filter(cap => cap.angle !== null).forEach(cap => {
          const xmlRange = getBaseXmlCapability(cap, cap.angle[0].number, cap.angle[1].number);
          xmlRange.attribute(`range`, cap.angle[1].number - cap.angle[0].number);
          xmlRange.attribute(`handler`, `prismindex`);
          xmlStep.importDocument(xmlRange);
        });

        // add ranges/steps for rotation speed dmx control capabilities
        const rotationSpeedCaps = commentGroup.filter(cap => cap.speed !== null);
        getSingleUnitCapabilities(rotationSpeedCaps, `speed`, `Hz`, 0, 5).forEach(cap => {
          const xmlCap = getRotationSpeedXmlCapability(cap);
          xmlCap.attribute(`handler`, `prismrotation`);
          xmlStep.importDocument(xmlCap);
        });
      });


      return xmlPrism;
    }
  },
  prismIndex: { // rotation angle
    isCapSuitable: cap => cap.type === `PrismRotation` && cap.angle !== null,
    create: (channel, caps) => {
      const xmlPrismIndex = xmlbuilder.create(`prismindex`);

      getSingleUnitCapabilities(caps, `angle`, `deg`, 0, 360).forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlCap.attribute(`range`, Math.abs(cap.endValue - cap.startValue));
        xmlPrismIndex.importDocument(xmlCap);
      });

      return xmlPrismIndex;
    }
  },
  prismRotation: { // rotation speed
    isCapSuitable: cap => cap.type === `PrismRotation` && cap.speed !== null,
    create: (channel, caps) => {
      const xmlPrismRotation = xmlbuilder.create(`prismrotation`);

      getSingleUnitCapabilities(caps, `speed`, `Hz`, 0, 5).forEach(cap => {
        const xmlCap = getRotationSpeedXmlCapability(cap);
        xmlPrismRotation.importDocument(xmlCap);
      });

      return xmlPrismRotation;
    }
  },
  fog: {
    isCapSuitable: cap => cap.type === `Fog` || (cap.type === `NoFunction` && cap._channel.type === `Fog`),
    create: (channel, caps) => {
      const xmlFog = xmlbuilder.create(`fog`);

      if (caps.length > 1) {

        caps.forEach(cap => {
          let xmlCap;

          if (cap.fogOutput !== null && cap.fogOutput[0].number !== cap.fogOutput[1].number) {
            xmlCap = getBaseXmlCapability(cap, cap.fogOutput[0].number, cap.fogOutput[1].number);
            xmlCap.attribute(`type`, `fog`);
          }
          else {
            // generate <step>s with value="true" or value="false"
            // this is not documented, but used in other fixtures
            const isFogOn = cap.type !== `NoFunction` && (cap.fogOutput === null || cap.fogOutput[0].number > 0);
            xmlCap = getBaseXmlCapability(cap);
            xmlCap.attribute(`value`, `${isFogOn}`);
          }

          xmlFog.importDocument(xmlCap);
        });
      }

      return xmlFog;
    }
  },
  fan: {
    isCapSuitable: cap => (cap.speed !== null || cap.type === `NoFunction`) && /\bfan\b/i.test(cap._channel.name),
    create: (channel, caps) => {
      const xmlFan = xmlbuilder.create(`fan`);

      if (caps.length > 1) {

        caps.forEach(cap => {
          let xmlCap;

          if (cap.speed !== null && cap.speed[0].number !== cap.speed[1].number) {
            xmlCap = getBaseXmlCapability(cap, Math.abs(cap.speed[0].number), Math.abs(cap.speed[1].number));
            xmlCap.attribute(`type`, `fan`);
          }
          else {
            // generate <step>s with value="true" or value="false"
            // this is not documented, but used in other fixtures
            const isFanOn = cap.type !== `NoFunction` && (cap.speed[0].number > 0);
            xmlCap = getBaseXmlCapability(cap);
            xmlCap.attribute(`value`, `${isFanOn}`);
          }

          xmlFan.importDocument(xmlCap);
        });
      }

      return xmlFan;
    }
  },
  index: { // rotation angle
    isCapSuitable: cap => cap.angle && cap.type.includes(`Rotation`),
    create: (channel, caps) => {
      const xmlIndex = xmlbuilder.create(`index`);

      getSingleUnitCapabilities(caps, `angle`, `deg`, 0, 360).forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap.capObject, cap.startValue, cap.endValue);
        xmlCap.attribute(`range`, Math.abs(cap.endValue - cap.startValue));
        xmlIndex.importDocument(xmlCap);
      });

      return xmlIndex;
    }
  },
  rotation: { // rotation speed
    isCapSuitable: cap => cap.speed !== null && cap.type.match(/(Rotation|Continuous)/),
    create: (channel, caps) => {
      const xmlRotation = xmlbuilder.create(`rotation`);

      const dmxControlCaps = getSingleUnitCapabilities(caps, `speed`, `Hz`, 0, 5);
      dmxControlCaps.forEach(cap => xmlRotation.importDocument(getRotationSpeedXmlCapability(cap)));

      return xmlRotation;
    }
  },
  rawStep: { // only steps
    isCapSuitable: cap => cap._channel.type !== `NoFunction` && (cap._channel.capabilities.every(cap => cap.isStep) || cap.usedStartEndEntities.length === 0),
    create: (channel, caps) => {
      const xmlRawStep = xmlbuilder.create(`rawstep`);

      caps.forEach(cap => {
        const xmlCap = getBaseXmlCapability(cap);
        xmlCap.attribute(`caption`, cap.name);
        xmlRawStep.importDocument(xmlCap);
      });

      return xmlRawStep;
    }
  },
  raw: { // steps and ranges
    isCapSuitable: cap => cap._channel.type !== `NoFunction` && cap.usedStartEndEntities.length > 0,
    create: (channel, caps) => {
      const xmlRaw = xmlbuilder.create(`raw`);

      caps.forEach(cap => {
        const [startEntity, endEntity] = cap[cap.usedStartEndEntities[0]];
        const xmlCap = getBaseXmlCapability(cap, startEntity.number, endEntity.number);
        xmlCap.attribute(`caption`, cap.name);
        xmlCap.attribute(`type`, cap.usedStartEndEntities[0] === `speed` && startEntity.number === endEntity.number ? `stop` : `linear`);
        xmlRaw.importDocument(xmlCap);
      });

      return xmlRaw;
    }
  }
};

/**
 * @typedef {object} DmxControlCapability
 * @property {Capability} capObject
 * @property {number} startValue
 * @property {number} endValue
 */

/**
 * Converts all property values to the allowed unit.
 * @param {array.<Capability>} caps Array of capabilities that use the given property.
 * @param {string} property Name of the property whose values should be normalized.
 * @param {string} allowedUnit The unit all capabilities should be converted to. Must be a base unit (i. e. no `ms` but `s`) or `%`.
 * @param {number} zeroPercentValue The equivalent of 0% in the allowed unit. Must be used if allowedUnit is not percent.
 * @param {number} hundredPercentValue The equivalent of 100% in the allowed unit. Must be used if allowedUnit is not percent.
 * @returns {array.<DmxControlCapability>} Array of objects wrapping the original capabilities.
 */
function getSingleUnitCapabilities(caps, property, allowedUnit, zeroPercentValue, hundredPercentValue) {
  const dmxControlCaps = caps.map(cap => {
    const startEntity = cap[property][0].getBaseUnitEntity();
    const endEntity = cap[property][1].getBaseUnitEntity();

    return {
      capObject: cap,
      unit: startEntity.unit,
      startValue: startEntity.number,
      endValue: endEntity.number
    };
  });

  // they should all be of the same (wrong) unit, as we converted to the base unit above
  const capsWithWrongUnit = dmxControlCaps.filter(cap => cap.unit !== allowedUnit);
  const maxValueWithWrongUnit = Math.max(...(capsWithWrongUnit.map(cap => Math.max(Math.abs(cap.startValue), Math.abs(cap.endValue)))));
  if (allowedUnit !== `%`) {
    // we take the conversion from percent to unit as a linear function f(x) = (m*x + t)
    // where x is the percentage value and f(x) or y is the value in the allowed unit
    const m = (hundredPercentValue - zeroPercentValue) / 100; // delta y / delta x
    const t = zeroPercentValue; // f(0) = m * 0 + t = t
    const percentToUnit = (x => (m * x) + t);

    capsWithWrongUnit.forEach(cap => {
      cap.unit = allowedUnit;
      cap.startValue = percentToUnit(cap.startValue);
      cap.endValue = percentToUnit(cap.endValue);
    });
  }
  else if (maxValueWithWrongUnit !== 0) {
    capsWithWrongUnit.forEach(cap => {
      cap.unit = allowedUnit;
      cap.startValue = cap.startValue / maxValueWithWrongUnit * 100;
      cap.endValue = cap.endValue / maxValueWithWrongUnit * 100;
    });
  }

  dmxControlCaps.forEach(cap => {
    delete cap.unit;
  });

  return dmxControlCaps;
}

/**
 * This function already handles swapping DMX start/end if the given start/end value is inverted (i.e. decreasing).
 * @param {Capability} cap The capability to use as data source.
 * @param {number|null} startValue The start value of an start/end entity, e.g. speedStart. Unit can be freely chosen. Omit if minval/maxval should not be added.
 * @param {*|null} endValue The end value of an start/end entity, e.g. speedEnd. Unit can be freely chosen. Omit if minval/maxval should not be added.
 * @returns {XMLElement} A <step> or <range> with mindmx, maxdmx and, optionally, minval and maxval attributes.
 */
function getBaseXmlCapability(cap, startValue = null, endValue = null) {
  const dmxRange = cap.getDmxRangeWithResolution(CoarseChannel.RESOLUTION_8BIT);
  let [dmxStart, dmxEnd] = [dmxRange.start, dmxRange.end];

  if (startValue !== null && startValue > endValue) {
    [startValue, endValue] = [endValue, startValue];
    [dmxStart, dmxEnd] = [dmxEnd, dmxStart];
  }

  const xmlCap = xmlbuilder.create(cap.isStep ? `step` : `range`);
  xmlCap.attribute(`mindmx`, dmxStart);
  xmlCap.attribute(`maxdmx`, dmxEnd);

  if (startValue !== null) {
    if (startValue === endValue) {
      xmlCap.attribute(`val`, parseFloat(startValue.toFixed(3)));
    }
    else {
      xmlCap.attribute(`minval`, parseFloat(startValue.toFixed(3)));
      xmlCap.attribute(`maxval`, parseFloat(endValue.toFixed(3)));
    }
  }

  return xmlCap;
}

/**
 * @param {DmxControlCapability} cap The DMX control capability; i.e. speed is in Hz.
 * @returns {XMLElement} A capability xml element with the proper stop/cw/ccw type
 */
function getRotationSpeedXmlCapability(cap) {
  if (cap.startValue === 0 && cap.endValue === 0) {
    const xmlStep = getBaseXmlCapability(cap.capObject);
    xmlStep.attribute(`type`, `stop`);
    return xmlStep;
  }

  const xmlRange = getBaseXmlCapability(cap.capObject, Math.abs(cap.startValue), Math.abs(cap.endValue));
  xmlRange.attribute(`type`, (cap.startValue >= 0 && cap.endValue >= 0) ? `cw` : `ccw`);
  return xmlRange;
}

/**
 * @param {array} arr1 First array to compare.
 * @param {array} arr2 Second array to compare.
 * @returns {boolean} Whether both arrays have equal size and their items do strictly equal.
 */
function arraysEqual(arr1, arr2) {
  if (arr1 === arr2) {
    return true;
  }

  if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
    return false;
  }

  return arr1.length === arr2.length && arr1.every(
    (item, index) => item === arr2[index]
  );
}
