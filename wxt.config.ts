import { defineConfig } from "wxt";

import {
  EXPECTED_HOST_PERMISSIONS,
  EXPECTED_PERMISSIONS,
} from "./src/policy/permissionContract";

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: "__MSG_manifestName__",
    description: "__MSG_manifestDescription__",
    version: "0.4.0",
    default_locale: "en",
    permissions: [...EXPECTED_PERMISSIONS],
    host_permissions: [...EXPECTED_HOST_PERMISSIONS],
    action: {
      default_title: "__MSG_actionTitle__",
    },
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
  },
});
