import { spawn, spawnSync } from "node:child_process";

const services = [
  { label: "api", script: "dev:api" },
  { label: "doctor", script: "dev:doctor" },
  { label: "patient", script: "dev:patient" },
];

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const checkOnly = process.argv.includes("--check");

if (checkOnly) {
  for (const service of services) {
    console.log(`[coretex] ${npmExecutable} run ${service.script}`);
  }
  process.exit(0);
}

const children = [];
let shuttingDown = false;

function startService(script) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", `npm run ${script}`], {
      stdio: "inherit",
    });
  }

  return spawn(npmExecutable, ["run", script], {
    stdio: "inherit",
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          stdio: "ignore",
        });
      } else {
        child.kill("SIGTERM");
      }
    }
  }

  setTimeout(() => process.exit(exitCode), 250);
}

for (const service of services) {
  console.log(`[coretex] starting ${service.label}...`);
  const child = startService(service.script);

  children.push(child);

  child.on("error", (error) => {
    console.error(`[coretex] failed to start ${service.label}: ${error.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `[coretex] ${service.label} stopped (code=${code ?? "null"}, signal=${signal ?? "none"})`,
    );
    shutdown(code ?? 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
