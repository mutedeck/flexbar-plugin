<template>
  <v-container>
    <v-card :title="$t('Settings.Connection.Title')" prepend-icon="mdi-connection">
      <v-card-text>
        <v-chip :color="view.color" variant="flat" :prepend-icon="view.icon">{{ $t(view.label) }}</v-chip>
        <p class="mt-4 text-body-2">{{ $t(view.help) }}</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" prepend-icon="mdi-link-variant-off" :loading="resetting" @click="resetPairing">
          {{ $t("Settings.Connection.Reset") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script>
/** MuteDeck connection states (from the backend) → how the page shows them. */
const VIEWS = {
  authenticated: { key: "Connected", color: "success", icon: "mdi-check-circle" },
  v1: { key: "ConnectedLegacy", color: "success", icon: "mdi-check-circle" },
  pending: { key: "Pending", color: "warning", icon: "mdi-account-clock" },
  denied: { key: "Denied", color: "error", icon: "mdi-cancel" },
  connecting: { key: "Connecting", color: "grey", icon: "mdi-dots-horizontal" },
  disconnected: { key: "NotRunning", color: "grey", icon: "mdi-power-plug-off" },
};

export default {
  props: {
    // { uuid, cid, manifest, config }. The config holds the MuteDeck token; this page never shows or saves it.
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      state: "connecting",
      resetting: false,
      timer: null,
    };
  },
  computed: {
    // Message keys are built here, not in the template: FlexDesigner pastes the template into a JS
    // template string, so a `${...}` in the template runs too early ("view is not defined").
    view() {
      const view = VIEWS[this.state] ?? VIEWS.connecting;
      return { ...view, label: `Settings.Connection.${view.key}.Label`, help: `Settings.Connection.${view.key}.Help` };
    },
  },
  mounted() {
    this.refresh();
    this.timer = setInterval(this.refresh, 2000);
  },
  beforeUnmount() {
    clearInterval(this.timer);
  },
  methods: {
    async refresh() {
      try {
        const result = await this.$fd.sendToBackend({ action: "status" });
        this.state = result?.state ?? "disconnected";
      } catch (error) {
        this.state = "disconnected";
      }
    },
    async resetPairing() {
      this.resetting = true;
      try {
        await this.$fd.sendToBackend({ action: "reset-pairing" });
        this.$fd.showSnackbarMessage("info", this.$t("Settings.Connection.ResetDone"));
        await this.refresh();
      } catch (error) {
        this.$fd.warn(`Reset pairing failed: ${error?.message ?? error}`);
      } finally {
        this.resetting = false;
      }
    },
  },
};
</script>
