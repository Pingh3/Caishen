import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const jp = path.join(root, "src/app/journal/page.tsx");

let s = fs.readFileSync(jp, "utf8");
s = s.replaceAll("\u2014", "-");
s = s.replaceAll("\u2026", "...");
// mojibake from em dash / ellipsis saved with wrong encoding
s = s.split("â€\u009d").join("-");
s = s.split("â€¦").join("...");
fs.writeFileSync(jp, s);
console.log("journal encoding fixed");
