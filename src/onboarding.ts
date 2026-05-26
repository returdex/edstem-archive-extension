import { OPEN_EDSTEM } from "./background/messageTypes";
import { defaultI18n, I18n } from "./i18n";

export function renderOnboarding(t: I18n = defaultI18n): string {
  return `
  <section class="onboarding-shell">
    <p class="eyebrow">${escapeHtml(t("appName"))}</p>
    <h1>${escapeHtml(t("onboardingTitle"))}</h1>
    <p class="lede">${escapeHtml(t("onboardingLede"))}</p>

    <ul class="trust-list">
      <li>${escapeHtml(t("trustExistingSession"))}</li>
      <li>${escapeHtml(t("trustLocalMarkdown"))}</li>
      <li>${escapeHtml(t("trustNoCredentials"))}</li>
    </ul>

    <button type="button" data-action="open-edstem">${escapeHtml(t("onboardingOpenEdstem"))}</button>
  </section>
  `;
}

const app = typeof document === "undefined" ? undefined : document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = renderOnboarding();

  app.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.action !== "open-edstem") {
      return;
    }
    void chrome.runtime.sendMessage({ type: OPEN_EDSTEM });
  });
} else if (typeof document !== "undefined") {
  throw new Error("Onboarding root element was not found.");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
