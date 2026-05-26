# Edstem Archive Extension Permissions

| Permission | Why it is needed | Phase | Requirement |
|------------|------------------|-------|-------------|
| `activeTab` | Lets the extension recognize the current Edstem course tab when the user chooses the current-course workflow. | Phase 15 | EXTDISC-02, EXTDISC-03 |
| `downloads` | Saves generated Markdown archives through the browser's Downloads API without requiring a Python install. | Phase 15 | EXTEXPORT-01 |
| `notifications` | Shows one terminal notification only when a download completes, partially completes, or fails while the popup may be closed. | Phase 16 | EXTUI-06 |
| `alarms` | Supports resumable background work within Manifest V3 service-worker lifetime constraints. | Phase 14 | EXTSYNC-02, EXTBUILD-04 |
| `storage` | Stores local extension state needed for settings, resumability, and popup status. | Phase 14 | EXTSYNC-01, EXTPRIVACY-04 |
| `https://edstem.org/*` | Restricts extension network and sidebar course discovery to Edstem's bare origin, including region-prefixed pages such as /au/dashboard. | Phase 13 | EXTAUTH-01, EXTDISC-01, EXTPRIVACY-01 |
| `https://*.edstem.org/*` | Restricts extension network and sidebar course discovery to Edstem origins that the user can already access in their browser. | Phase 13 | EXTAUTH-01, EXTDISC-01, EXTPRIVACY-01 |
