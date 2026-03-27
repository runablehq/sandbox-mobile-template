import type { Subprocess } from "bun";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

type Step = {
  name: string;
  cwd: string;
  cmd: string[];
  color: string;
};

const steps: Step[] = [
  { name: "api", cwd: "packages/api", cmd: ["bun", "run", "build"], color: c.cyan },
  { name: "app", cwd: "packages/app", cmd: ["bunx", "expo", "export", "--platform", "web"], color: c.magenta },
];

async function run(step: Step): Promise<boolean> {
  console.log(`\n${step.color}[${step.name}]${c.reset} ${c.dim}Building...${c.reset}\n`);

  const proc = Bun.spawn(step.cmd, {
    cwd: step.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  // Stream output
  async function stream(source: ReadableStream<Uint8Array> | null) {
    if (!source) return;
    const reader = source.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (line.trim()) {
          console.log(`${step.color}[${step.name}]${c.reset} ${line}`);
        }
      }
    }
  }

  await Promise.all([stream(proc.stdout), stream(proc.stderr)]);
  const code = await proc.exited;

  if (code === 0) {
    console.log(`${step.color}[${step.name}]${c.reset} ${c.green}✓ Build successful${c.reset}`);
    return true;
  } else {
    console.log(`${step.color}[${step.name}]${c.reset} ${c.red}✖ Build failed (exit code ${code})${c.reset}`);
    return false;
  }
}

console.log(`${c.bold}🔨 Building all packages${c.reset}`);

for (const step of steps) {
  const success = await run(step);
  if (!success) {
    console.log(`\n${c.red}${c.bold}Build failed${c.reset}`);
    process.exit(1);
  }
}

console.log(`\n${c.green}${c.bold}✓ All builds successful${c.reset}`);
