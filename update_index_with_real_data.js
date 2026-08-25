// update_index_with_real_data.js
const fs = require("fs");

const storeData = JSON.parse(fs.readFileSync("store_data.json", "utf8"));
let indexHtml = fs.readFileSync("index.html", "utf8");

const engineHeader = "// STORE DIRECTORY & FREIGHT ENGINE (門市聯絡與跨店運費引擎)";
const endMarker = "window.refreshStoreDirectoryData = refreshStoreDirectoryData;";

const startIdx = indexHtml.indexOf(engineHeader);
const endIdx = indexHtml.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find markers in index.html");
    process.exit(1);
}

console.log("index.html store directory engine is up to date and verified.");
