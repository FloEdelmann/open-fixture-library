<template>
  <div class="editor-capability-type-data">
    <LabeledInput
      :formstate="formstate"
      :name="`capability${capability.uuid}-type`"
      :hint="capabilityTypeHint"
      label="Capability type">
      <select
        v-model="capability.type"
        :class="{ empty: capability.type === `` }"
        :name="`capability${capability.uuid}-type`"
        :required="required"
        @change="changeCapabilityType()">

        <option value="" disabled>Please select a capability type</option>

        <option
          v-for="type of capabilityTypes"
          :key="type"
          :value="type">{{ type }}</option>

      </select>
    </LabeledInput>

    <Component
      :is="`Capability${capability.type}`"
      v-if="capability.type !== ``"
      ref="capabilityTypeData"
      :capability="capability"
      :channel="channel"
      :formstate="formstate" />
  </div>
</template>

<script>
import { capabilityTypes } from '../../../lib/schema-properties.js';

import LabeledInput from '../LabeledInput.vue';

import CapabilityBeamAngle from './capabilities/BeamAngle.vue';
import CapabilityBeamPosition from './capabilities/BeamPosition.vue';
import CapabilityBladeInsertion from './capabilities/BladeInsertion.vue';
import CapabilityBladeRotation from './capabilities/BladeRotation.vue';
import CapabilityBladeSystemRotation from './capabilities/BladeSystemRotation.vue';
import CapabilityColorIntensity from './capabilities/ColorIntensity.vue';
import CapabilityColorPreset from './capabilities/ColorPreset.vue';
import CapabilityColorTemperature from './capabilities/ColorTemperature.vue';
import CapabilityEffect from './capabilities/Effect.vue';
import CapabilityEffectDuration from './capabilities/EffectDuration.vue';
import CapabilityEffectParameter from './capabilities/EffectParameter.vue';
import CapabilityEffectSpeed from './capabilities/EffectSpeed.vue';
import CapabilityFocus from './capabilities/Focus.vue';
import CapabilityFog from './capabilities/Fog.vue';
import CapabilityFogOutput from './capabilities/FogOutput.vue';
import CapabilityFogType from './capabilities/FogType.vue';
import CapabilityFrost from './capabilities/Frost.vue';
import CapabilityFrostEffect from './capabilities/FrostEffect.vue';
import CapabilityGeneric from './capabilities/Generic.vue';
import CapabilityIntensity from './capabilities/Intensity.vue';
import CapabilityIris from './capabilities/Iris.vue';
import CapabilityIrisEffect from './capabilities/IrisEffect.vue';
import CapabilityMaintenance from './capabilities/Maintenance.vue';
import CapabilityNoFunction from './capabilities/NoFunction.vue';
import CapabilityPan from './capabilities/Pan.vue';
import CapabilityPanContinuous from './capabilities/PanContinuous.vue';
import CapabilityPanTiltSpeed from './capabilities/PanTiltSpeed.vue';
import CapabilityPrism from './capabilities/Prism.vue';
import CapabilityPrismRotation from './capabilities/PrismRotation.vue';
import CapabilityRotation from './capabilities/Rotation.vue';
import CapabilityShutterStrobe from './capabilities/ShutterStrobe.vue';
import CapabilitySoundSensitivity from './capabilities/SoundSensitivity.vue';
import CapabilitySpeed from './capabilities/Speed.vue';
import CapabilityStrobeDuration from './capabilities/StrobeDuration.vue';
import CapabilityStrobeSpeed from './capabilities/StrobeSpeed.vue';
import CapabilityTilt from './capabilities/Tilt.vue';
import CapabilityTiltContinuous from './capabilities/TiltContinuous.vue';
import CapabilityTime from './capabilities/Time.vue';
import CapabilityWheelRotation from './capabilities/WheelRotation.vue';
import CapabilityWheelShake from './capabilities/WheelShake.vue';
import CapabilityWheelSlot from './capabilities/WheelSlot.vue';
import CapabilityWheelSlotRotation from './capabilities/WheelSlotRotation.vue';
import CapabilityZoom from './capabilities/Zoom.vue';

export default {
  components: {
    LabeledInput,
    CapabilityNoFunction,
    CapabilityShutterStrobe,
    CapabilityStrobeSpeed,
    CapabilityStrobeDuration,
    CapabilityIntensity,
    CapabilityColorIntensity,
    CapabilityColorPreset,
    CapabilityColorTemperature,
    CapabilityPan,
    CapabilityPanContinuous,
    CapabilityTilt,
    CapabilityTiltContinuous,
    CapabilityPanTiltSpeed,
    CapabilityWheelSlot,
    CapabilityWheelShake,
    CapabilityWheelSlotRotation,
    CapabilityWheelRotation,
    CapabilityEffect,
    CapabilityEffectSpeed,
    CapabilityEffectDuration,
    CapabilityEffectParameter,
    CapabilitySoundSensitivity,
    CapabilityBeamAngle,
    CapabilityBeamPosition,
    CapabilityFocus,
    CapabilityZoom,
    CapabilityIris,
    CapabilityIrisEffect,
    CapabilityFrost,
    CapabilityFrostEffect,
    CapabilityPrism,
    CapabilityPrismRotation,
    CapabilityBladeInsertion,
    CapabilityBladeRotation,
    CapabilityBladeSystemRotation,
    CapabilityFog,
    CapabilityFogOutput,
    CapabilityFogType,
    CapabilityRotation,
    CapabilitySpeed,
    CapabilityTime,
    CapabilityMaintenance,
    CapabilityGeneric,
  },
  model: {
    prop: `capability`,
  },
  props: {
    capability: {
      type: Object,
      required: true,
    },
    channel: {
      type: Object,
      required: true,
    },
    formstate: {
      type: Object,
      required: false,
      default: null,
    },
    required: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      capabilityTypes: Object.keys(capabilityTypes),
      capabilityTypeHint: null,
    };
  },
  methods: {
    /**
     * Add all properties to capability.typeData that are required by the current capability type and are not yet in there.
     */
    async changeCapabilityType() {
      await this.$nextTick();

      const defaultData = this.$refs.capabilityTypeData.defaultData;
      for (const property of Object.keys(defaultData)) {
        if (!(property in this.capability.typeData)) {
          this.$set(this.capability.typeData, property, defaultData[property]);
        }
      }

      this.capabilityTypeHint = `hint` in this.$refs.capabilityTypeData
        ? this.$refs.capabilityTypeData.hint
        : null;
    },

    /**
     * Called when the channel is saved. Removes all properties from capability.typeData that are not relevant for this capability type and sets open to false.
     * @public
     */
    cleanCapabilityData() {
      const component = this.$refs.capabilityTypeData;

      const defaultData = component.defaultData;

      for (const property of Object.keys(this.capability.typeData)) {
        if (!(property in defaultData)) {
          delete this.capability.typeData[property];
        }
      }

      if (component && `resetProperties` in component) {
        const resetProperties = component.resetProperties;

        for (const property of resetProperties) {
          const defaultPropertyData = defaultData[property];
          this.capability.typeData[property] = typeof defaultPropertyData === `string` ? `` : defaultPropertyData;
        }
      }

      this.capability.open = false;
    },
  },
};
</script>
