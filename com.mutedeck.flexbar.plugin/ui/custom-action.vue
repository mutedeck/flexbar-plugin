<template>
  <v-container>
    <v-combobox
      v-model="modelValue.data.custom_action"
      :items="items"
      item-title="label"
      item-value="name"
      :return-object="false"
      :label="$t('Settings.CustomAction.Label')"
      :hint="$t('Settings.CustomAction.Hint')"
      persistent-hint
      :loading="loading"
      clearable
    ></v-combobox>
    <v-alert v-if="errorText" type="info" variant="tonal" density="compact" class="mt-4">{{ errorText }}</v-alert>
    <v-btn variant="text" prepend-icon="mdi-refresh" class="mt-2" :loading="loading" @click="load">
      {{ $t("Settings.CustomAction.Refresh") }}
    </v-btn>
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
  data() {
    return {
      actions: [],
      error: "",
      loading: false,
    };
  },
  computed: {
    items() {
      return this.actions
        .filter((action) => action.name)
        .map((action) => ({
          name: action.name,
          label: action.type === "builtin" ? `${action.name} (${this.$t("Settings.CustomAction.BuiltIn")})` : action.application ? `${action.name} (${action.application})` : action.name,
        }));
    },
    errorText() {
      switch (this.error) {
        case "":
          return "";
        case "not_connected":
          return this.$t("Settings.CustomAction.NotConnected");
        case "not_licensed":
          return this.$t("Settings.CustomAction.NotLicensed");
        default:
          return this.$t("Settings.CustomAction.LoadFailed");
      }
    },
  },
  created() {
    if (!this.modelValue.data) {
      this.modelValue.data = {};
    }
    this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        const result = await this.$fd.sendToBackend({ action: "list-custom-actions" });
        this.actions = result?.actions ?? [];
        this.error = result?.error ?? "";
      } catch (error) {
        this.$fd.warn(`Loading custom actions failed: ${error?.message ?? error}`);
        this.error = "failed";
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
