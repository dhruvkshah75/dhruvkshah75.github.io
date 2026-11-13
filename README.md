# Dhruv Shah — portfolio

A minimal, responsive portfolio built as a static site. The site uses a locally bundled Three.js pixel field and five purpose-built Three.js project illustrations.

## Preview

From this directory, run:

```sh
python3 -m http.server 4173 --directory dist
```

Open `http://localhost:4173` in a browser. No build or package installation is required.

## Editing

- `dist/index.html` contains the page content and structure.
- `dist/style.css` contains the visual system and responsive layouts.
- `dist/app.js` contains the five project records and project interactions. Update the `projects` array to add fuller descriptions or change project links.
- `dist/visuals.js` contains the pixel field and project illustrations.
- `dist/assets/` contains the bundled Three.js files and its license.

The project carousel has a reduced-motion layout; if WebGL is unavailable, the portfolio content remains accessible.
