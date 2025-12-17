import { spawn } from "node:child_process";

import { resolveInWorkspace, workspaceRoot } from "./workspace.js";

export async function runRepoScript(args: {
  script: "lint" | "build" | "dev" | "docs:dev" | "docs:build" | "typecheck";
}): Promise<string> {
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  const result = await new Promise<{ code: number | null; out: string }>(
    (resolve, reject) => {
      const child = spawn(pnpmCmd, ["-s", "run", args.script], {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      const limit = 60_000;
      child.stdout.on("data", (d) => {
        out += d.toString();
        if (out.length > limit)
          out = out.slice(0, limit) + "\n...<truncated>\n";
      });
      child.stderr.on("data", (d) => {
        out += d.toString();
        if (out.length > limit)
          out = out.slice(0, limit) + "\n...<truncated>\n";
      });
      child.on("error", (err) => reject(err));
      child.on("close", (code) => resolve({ code, out }));
    }
  );

  return `pnpm run ${args.script}\nexitCode=${result.code}\n\n${result.out}`;
}

export async function runMcpScript(args: {
  script: "start" | "dev" | "typecheck";
}): Promise<string> {
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const mcpDir = resolveInWorkspace("packages/mcp-service");

  const result = await new Promise<{ code: number | null; out: string }>(
    (resolve, reject) => {
      const child = spawn(pnpmCmd, ["-s", "run", args.script], {
        cwd: mcpDir,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      const limit = 60_000;
      child.stdout.on("data", (d) => {
        out += d.toString();
        if (out.length > limit)
          out = out.slice(0, limit) + "\n...<truncated>\n";
      });
      child.stderr.on("data", (d) => {
        out += d.toString();
        if (out.length > limit)
          out = out.slice(0, limit) + "\n...<truncated>\n";
      });
      child.on("error", (err) => reject(err));
      child.on("close", (code) => resolve({ code, out }));
    }
  );

  return `pnpm -C packages/mcp-service run ${args.script}\nexitCode=${result.code}\n\n${result.out}`;
}
