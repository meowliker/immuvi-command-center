import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const scriptPath = path.join(process.cwd(), "team-skill", "install-skill.sh");
  const script = await readFile(scriptPath, "utf8");

  return new Response(script, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
