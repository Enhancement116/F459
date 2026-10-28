# F459 LAB

APICTA research showcase website. Static HTML, CSS and JavaScript; no build step required.

## Local preview

Run `python -m http.server 8000` from this folder, then open http://localhost:8000.

## Deployment

Target: https://enhancement-social.org/F459/

All website resources use relative paths and support hosting under `/F459/`. Publish this folder as the F459 project site, or copy its contents into the existing host's F459 directory. Do not set a CNAME containing a URL path, and do not replace the existing root site's content.

## Editing

- `index.html`: bilingual content, team members and photo slots.
- `style.css`, `refinements.css`, `identity.css`: responsive visual design.
- `app.js`: language switch and architecture tabs.
- `nkust-logo.png`, `cce-logo.jpg`, `SOURCES.txt`: official institutional logos and source attribution.
- Portraits and up to five research videos currently remain placeholders.

Team: Prof. 吳介騫; first cohort 114: 劉予翰; second cohort 114 (latest requested label): 林翔晨、吳佳寰、李佳爵、何若鏡, with 錢思妤 on the second row; third cohort 116: a、b. Mobile layouts wrap for readability.


## Multi-page site
Home: index.html. Learning directory: learn.html. Lessons: navigation.html, signals.html, computing.html, validation.html. Research: technology.html, results.html, team.html. Shared behavior: app.js, pages.js; animations: pages.css and inline SVG. Educational diagrams are conceptual, not measurements.
