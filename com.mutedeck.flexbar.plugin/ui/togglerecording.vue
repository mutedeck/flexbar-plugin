<!-- Generated from scripts/templates/toggle-key.vue by `npm run manifest`. Edit the template, not this file. -->
<template>
  <v-container>
    <v-radio-group v-model="modelValue.data.action_type" :label="$t('Settings.WhenTapped')" hide-details>
      <v-radio value="toggle" :label="$t('Settings.Record.Toggle')"></v-radio>
      <v-radio value="on" :label="$t('Settings.Record.On')"></v-radio>
      <v-radio value="off" :label="$t('Settings.Record.Off')"></v-radio>
    </v-radio-group>
  </v-container>
</template>

<script>
export default {
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  created() {
    if (!this.modelValue.data) {
      this.modelValue.data = {};
    }
    if (!["toggle", "on", "off"].includes(this.modelValue.data.action_type)) {
      this.modelValue.data.action_type = "toggle";
    }
  },
};
</script>
