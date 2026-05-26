export interface InstallRuntimeApi {
  getURL(path: string): string;
  onInstalled: {
    addListener(listener: (details: chrome.runtime.InstalledDetails) => void): void;
  };
}

export interface InstallTabsApi {
  create(options: { url: string }): Promise<chrome.tabs.Tab> | void;
}

export interface InstallDeps {
  runtime?: InstallRuntimeApi;
  tabs?: InstallTabsApi;
}

export function registerInstallHandler(deps: InstallDeps = {}): void {
  const runtime = deps.runtime ?? chrome.runtime;
  const tabs = deps.tabs ?? chrome.tabs;

  runtime.onInstalled.addListener((details) => {
    if (details.reason !== "install") {
      return;
    }
    void tabs.create({ url: runtime.getURL("onboarding.html") });
  });
}
