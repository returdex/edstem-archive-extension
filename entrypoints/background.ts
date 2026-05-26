import { defineBackground } from "wxt/utils/define-background";

import { registerExportHandlers } from "../src/background/export";
import { registerInstallHandler } from "../src/background/install";
import { registerBackgroundMessageHandlers } from "../src/background/messages";
import { registerNotificationClickHandler } from "../src/background/notifications";
import { registerSyncHandlers } from "../src/background/sync";

export default defineBackground(() => {
  registerBackgroundMessageHandlers();
  registerSyncHandlers();
  registerExportHandlers();
  registerNotificationClickHandler();
  registerInstallHandler();
});
