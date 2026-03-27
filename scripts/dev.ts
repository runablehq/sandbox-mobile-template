import type { Subprocess } from "bun";

// --- Configuration ---

const services = {
  api: {
    cwd: "packages/api",
    cmd: ["bun", "run", "dev"],
    color: "\x1b[36m", // cyan
    port: 8787,
  },
  app: {
    cwd: "packages/app",
    cmd: ["bun", "run", "start"],
    color: "\x1b[35m", // magenta
    port: 8081,
  },
} as const;

type ServiceName = keyof typeof services;

// --- Colors ---

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

// --- State ---

const processes = new Map<ServiceName, Subprocess>();
let isShuttingDown = false;

// --- CLI Args ---

function parseArgs(): Set<ServiceName> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${c.bold}Usage:${c.reset} bun dev [options]

${c.bold}Options:${c.reset}
  --api       Run API server only
  --app       Run mobile app only
  -h, --help  Show this help message

${c.bold}Examples:${c.reset}
  bun dev          # Start both services
  bun dev --api    # Start API only
  bun dev --app    # Start mobile app only
`);
    process.exit(0);
  }

  const selected = new Set<ServiceName>();

  if (args.includes("--api")) selected.add("api");
  if (args.includes("--app")) selected.add("app");

  // Default to all services if none specified
  if (selected.size === 0) {
    return new Set(Object.keys(services) as ServiceName[]);
  }

  return selected;
}

// --- Output ---

function log(name: ServiceName, line: string) {
  const { color } = services[name];
  console.log(`${color}[${name}]${c.reset} ${line}`);
}

function info(msg: string) {
  console.log(`${c.dim}${msg}${c.reset}`);
}

async function streamOutput(name: ServiceName, stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) log(name, line);
      }
    }

    if (buffer.trim()) log(name, buffer);
  } catch {
    // Stream closed
  }
}

// --- Process Management ---

function spawn(name: ServiceName): Subprocess {
  const { cwd, cmd } = services[name];

  const proc = Bun.spawn(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  processes.set(name, proc);
  streamOutput(name, proc.stdout);
  streamOutput(name, proc.stderr);

  // Handle unexpected exit
  proc.exited.then((code) => {
    if (!isShuttingDown && code !== 0) {
      console.log(`\n${c.red}✖ ${name} exited with code ${code}${c.reset}`);
      cleanup(1);
    }
  });

  return proc;
}

function cleanup(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${c.yellow}Shutting down...${c.reset}`);

  for (const [name, proc] of processes) {
    info(`Stopping ${name}...`);
    proc.kill("SIGTERM");
  }

  // Force kill after timeout
  setTimeout(() => {
    for (const proc of processes.values()) {
      proc.kill("SIGKILL");
    }
    process.exit(exitCode);
  }, 3000);

  // Exit immediately if all processes are done
  Promise.all([...processes.values()].map((p) => p.exited)).then(() => {
    process.exit(exitCode);
  });
}

// --- Signal Handlers ---

process.on("SIGINT", () => cleanup());
process.on("SIGTERM", () => cleanup());

// --- Main ---

const selected = parseArgs();

console.log(`
${c.green}${c.bold}🚀 Starting development servers${c.reset}
`);

for (const name of selected) {
  const { port } = services[name];
  info(`${name}: http://localhost:${port}`);
}

console.log();

for (const name of selected) {
  spawn(name);
}

// Keep alive
await new Promise(() => {});
