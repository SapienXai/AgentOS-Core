import { NextResponse } from "next/server";
import { z } from "zod";

import { deployWorkspacePlan } from "@/lib/openclaw/planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deploySchema = z.object({
  plan: z.any().optional()
});

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      planId: string;
    }>;
  }
) {
  try {
    const { planId } = await context.params;
    const input = deploySchema.parse(await request.json());
    const result = await deployWorkspacePlan(planId, input.plan);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to deploy planner workspace."
      },
      { status: 400 }
    );
  }
}
