<template>
  <select
    v-model="localValue"
    :required="required"
    :class="{ empty: value === `` }">
    <option :disabled="required" value="">unknown</option>
    <option
      v-for="item of schemaProperty.enum"
      :key="item"
      :value="item">{{ item }}</option>
    <option
      v-if="additionHint !== null"
      value="[add-value]">{{ additionHint }}</option>
  </select>
</template>

<script>
export default {
  props: {
    schemaProperty: {
      type: Object,
      required: true,
    },
    required: {
      type: Boolean,
      required: false,
      default: false,
    },
    additionHint: {
      type: String,
      required: false,
      default: null,
    },
    autoFocus: {
      type: Boolean,
      required: false,
      default: false,
    },
    value: {
      type: null,
      required: true,
    },
  },
  computed: {
    localValue: {
      get() {
        return this.value;
      },
      set(newValue) {
        this.$emit(`input`, newValue);
      },
    },
  },
  mounted() {
    if (this.autoFocus) {
      this.focus();
    }
  },
  methods: {
    focus() {
      this.$el.focus();
    },
  },
};
</script>

