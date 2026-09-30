# Performance — Slow 3G (T55)

Target (Spec Section 6): on Chrome DevTools Slow 3G (now labelled "3G"), each intake step loads in 5 seconds or less and a compressed photo upload saves in 10 seconds or less.

## Measured so far (2026-09-29)

Fresh headless Chrome, cache disabled, Slow 3G (about 50 KB/s, 2-second delay per request), against the production build served gzip-compressed like GitHub Pages.

| Step | Time | Target | Result |
|---|---|---|---|
| First visit to the agency link: app appears ("Loading…") | 6.9 s | 5 s | Over target |
| First visit to the agency link: "Apply to Hoosier Home Care" ready | 13.3 s | 5 s | Over target |
| Each later intake step (About you → Review) | Not measured | 5 s | Expected to pass: no network use after the first load |
| Compressed photo upload | Not measured | 10 s | Expected to pass: compressed and saved on the phone, no network use |

The first visit downloads about 380 KB (app code ~75 KB, Bootstrap styles ~63 KB, Bootstrap Icons font ~134 KB, Roboto ~66 KB, logo ~26 KB, seed data ~15 KB).

## Decision (2026-09-29)

The first visit misses the 5-second target (about 6.9 s until the app appears and 13.3 s until it is ready on Slow 3G). Mike accepted the slower first visit for the demo, with no changes to the first download. After the first visit the app works from the browser, so later steps and photo saving don't depend on the network. If the pilot needs a faster first visit, the options are to load the coordinator screens only when needed and to ship only the icons the app uses instead of the whole icon font.
