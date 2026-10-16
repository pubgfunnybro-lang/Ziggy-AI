import fs from "node:fs";

const file = "app/page.tsx";
let t = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

const a = String.raw`<path d="M16 14H48V20.5L28.5 43.5H48V50H16V43.5L35.5 20.5H16Z" fill="#ffffff" />`;
const b = String.raw`<path d="M23 12H41A10 10 0 0 1 51 22V32A10 10 0 0 1 41 42H29L19 51V42H23A10 10 0 0 1 13 32V22A10 10 0 0 1 23 12Z" fill="#ffffff" />
      <path d="M20 32L26 22L32 32L38 22L44 32" fill="none" stroke="#c45f3d" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />`;

const n = t.split(a).length - 1;
if (n !== 1) {
  console.log("STOP. Nothing was changed. Found " + n + " matches for the old logo.");
  process.exit(1);
}
fs.writeFileSync(file, t.replace(a, () => b));
console.log("Logo updated in page.tsx");
