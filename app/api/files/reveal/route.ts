import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const revealSchema = z.object({
  path: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const payload = revealSchema.parse(await request.json());
    const targetPath = path.resolve(payload.path);

    if (!path.isAbsolute(targetPath)) {
      throw new Error("File path must be absolute.");
    }

    await access(targetPath);
    await revealFile(targetPath);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to reveal file."
      },
      { status: 400 }
    );
  }
}

async function revealFile(targetPath: string) {
  if (process.platform === "darwin") {
    await execFileAsync("open", ["-R", targetPath]);
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("explorer.exe", ["/select,", targetPath]);
    return;
  }

  await execFileAsync("xdg-open", [path.dirname(targetPath)]);
}
