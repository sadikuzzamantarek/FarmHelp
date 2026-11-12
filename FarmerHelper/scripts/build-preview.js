#!/usr/bin/env node

/**
 * Builds a self-contained browser preview: injects db.geo.json into
 * preview/template.html and writes preview/index.html.
 *
 * Open preview/index.html directly in a browser (double-click) — no server
 * needed, since the data is embedded.
 *
 * Usage: node scripts/build-preview.js
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const templatePath = path.join(root, "preview", "template.html");
const dataPath = path.join(root, "db.geo.json");
const outPath = path.join(root, "preview", "index.html");

const template = fs.readFileSync(templatePath, "utf8");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const html = template.replace("/*__DATA__*/", JSON.stringify(data));

fs.writeFileSync(outPath, html);
console.log(`✅ Built ${path.relative(root, outPath)} (${Object.keys(data.providers).length} providers)`);
console.log("   Open it in a browser: preview/index.html");
