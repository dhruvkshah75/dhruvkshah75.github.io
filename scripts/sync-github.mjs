import fs from "node:fs/promises";
import ts from "typescript";

const file = new URL("../lib/portfolio.ts", import.meta.url);
const source = await fs.readFile(file, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { projects: current } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
async function get(url, json = true) {
  const response = await fetch(url, { headers: { "User-Agent": "dhruv-portfolio-sync", Accept: json ? "application/vnd.github+json" : "text/html" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}; the existing portfolio has not been changed.`);
  return json ? response.json() : response.text();
}
const [repos, html] = await Promise.all([get("https://api.github.com/users/dhruvkshah75/repos?per_page=100"), get("https://github.com/dhruvkshah75", false)]);
const pinned = [...html.matchAll(/href="\/(dhruvkshah75\/[^" ]+)"[^>]*>\s*<span[^>]*class="repo"[^>]*>(.*?)<\/span>/gs)].map(match => match[2].trim());
if (!pinned.length) throw new Error("Could not read pinned repositories. Keeping the existing portfolio unchanged.");
const names = [...new Set([...pinned, ...current.map(project => project.name)])];
const projects = names.flatMap(name => {
  const repo = repos.find(repo => repo.name === name && !repo.private && !repo.fork);
  if (!repo) return [];
  const existing = current.find(project => project.name === name);
  return [{
    name, description: existing?.description || repo.description || "View the source and documentation on GitHub.",
    language: repo.language || "Code", stack: existing?.stack || [repo.language || "Code"], category: existing?.category || "Tools", url: repo.html_url,
    ...(repo.homepage?.startsWith("https://") ? { demo: repo.homepage } : {}),
    pinned: pinned.includes(name), ...(existing?.status ? { status: existing.status } : {}),
  }];
});
const updated = source.replace(/export const projects: Project\[\] = \[[\s\S]*?\n\];/, `export const projects: Project[] = ${JSON.stringify(projects, null, 2)};`);
if (updated === source && !projects.length) throw new Error("No project data was found. Existing source was not changed.");
await fs.writeFile(file, updated);
console.log(`Updated ${projects.length} public projects, including ${pinned.length} pins. Curated copy, categories and progress statuses were preserved.`);
