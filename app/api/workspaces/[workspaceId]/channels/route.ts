import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createTelegramChannelAccount,
  disconnectWorkspaceChannel,
  deleteWorkspaceChannelEverywhere,
  getMissionControlSnapshot,
  setWorkspaceChannelGroups,
  setWorkspaceChannelPrimary,
  upsertWorkspaceChannel,
  bindWorkspaceChannelAgent,
  unbindWorkspaceChannelAgent
} from "@/lib/openclaw/service";
import type { WorkspaceChannelGroupAssignment } from "@/lib/openclaw/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const groupAssignmentSchema = z.object({
  chatId: z.string().min(1),
  agentId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  enabled: z.boolean().optional()
});

const createChannelSchema = z.object({
  channelId: z.string().optional(),
  type: z.enum(["telegram", "slack", "discord", "googlechat"]),
  name: z.string().min(1),
  token: z.string().optional(),
  primaryAgentId: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  groupAssignments: z.array(groupAssignmentSchema).optional()
});

const patchChannelSchema = z.object({
  channelId: z.string().min(1),
  action: z.enum(["bind-agent", "unbind-agent", "primary", "groups"]),
  agentId: z.string().nullable().optional(),
  primaryAgentId: z.string().nullable().optional(),
  groupAssignments: z.array(groupAssignmentSchema).optional()
});

const deleteChannelSchema = z.object({
  channelId: z.string().min(1),
  scope: z.enum(["workspace", "global"]).optional()
});

export async function GET(_request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params;
  let snapshot = await getMissionControlSnapshot();
  let workspace = snapshot.workspaces.find((entry) => entry.id === workspaceId);

  if (!workspace) {
    snapshot = await getMissionControlSnapshot({ force: true });
    workspace = snapshot.workspaces.find((entry) => entry.id === workspaceId);
  }

  if (!workspace) {
    return NextResponse.json({ error: "Workspace was not found." }, { status: 404 });
  }

  const channels = snapshot.channelRegistry.channels.filter((channel) =>
    channel.workspaces.some((binding) => binding.workspaceId === workspaceId)
  );

  return NextResponse.json({
    workspaceId,
    channels,
    channelAccounts: snapshot.channelAccounts
  });
}

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await context.params;
    let snapshot = await getMissionControlSnapshot();
    let workspace = snapshot.workspaces.find((entry) => entry.id === workspaceId);

    if (!workspace) {
      snapshot = await getMissionControlSnapshot({ force: true });
      workspace = snapshot.workspaces.find((entry) => entry.id === workspaceId);
    }

    if (!workspace) {
      throw new Error("Workspace was not found.");
    }

    const input = createChannelSchema.parse(await request.json());
    const channelId = input.channelId?.trim();
    const primaryAgentId = input.primaryAgentId?.trim() || null;
    const agentIds = input.agentId ? [input.agentId.trim()] : [];
    const groupAssignments = normalizeGroupAssignments(input.groupAssignments ?? []);

    if (input.type === "telegram" && input.token && !channelId) {
      const created = await createTelegramChannelAccount({
        name: input.name,
        token: input.token
      });

      const registry = await upsertWorkspaceChannel({
        workspaceId,
        workspacePath: workspace.path,
        channelId: created.id,
        type: "telegram",
        name: input.name,
        primaryAgentId,
        agentIds,
        groupAssignments
      });

      return NextResponse.json({
        account: created,
        registry
      });
    }

    if (!channelId) {
      throw new Error("Channel id is required.");
    }

    const registry = await upsertWorkspaceChannel({
      workspaceId,
      workspacePath: workspace.path,
      channelId,
      type: input.type,
      name: input.name,
      primaryAgentId,
      agentIds,
      groupAssignments
    });

    return NextResponse.json({
      registry
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create channel."
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await context.params;
    let snapshot = await getMissionControlSnapshot();
    let workspace = snapshot.workspaces.find((entry) => entry.id === workspaceId);

    if (!workspace) {
      snapshot = await getMissionControlSnapshot({ force: true });
      workspace = snapshot.workspaces.find((entry) => entry.id === workspaceId);
    }

    if (!workspace) {
      throw new Error("Workspace was not found.");
    }

    const input = patchChannelSchema.parse(await request.json());

    if (input.action === "primary") {
      const registry = await setWorkspaceChannelPrimary({
        channelId: input.channelId,
        primaryAgentId: input.primaryAgentId ?? null
      });

      return NextResponse.json({ registry });
    }

    if (input.action === "groups") {
      const registry = await setWorkspaceChannelGroups({
        channelId: input.channelId,
        workspaceId,
        groupAssignments: normalizeGroupAssignments(input.groupAssignments ?? [])
      });

      return NextResponse.json({ registry });
    }

    if (input.action === "bind-agent") {
      if (!input.agentId) {
        throw new Error("Agent id is required.");
      }

      const registry = await bindWorkspaceChannelAgent({
        channelId: input.channelId,
        workspaceId,
        workspacePath: workspace.path,
        agentId: input.agentId
      });

      return NextResponse.json({ registry });
    }

    if (!input.agentId) {
      throw new Error("Agent id is required.");
    }

    const registry = await unbindWorkspaceChannelAgent({
      channelId: input.channelId,
      workspaceId,
      agentId: input.agentId
    });

    return NextResponse.json({ registry });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update channel."
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await context.params;
    let snapshot = await getMissionControlSnapshot();
    let workspace = snapshot.workspaces.find((entry) => entry.id === workspaceId);

    if (!workspace) {
      snapshot = await getMissionControlSnapshot({ force: true });
      workspace = snapshot.workspaces.find((entry) => entry.id === workspaceId);
    }

    if (!workspace) {
      throw new Error("Workspace was not found.");
    }

    const input = deleteChannelSchema.parse(await request.json());
    const registry =
      input.scope === "global"
        ? await deleteWorkspaceChannelEverywhere({
            channelId: input.channelId
          })
        : await disconnectWorkspaceChannel({
            workspaceId,
            channelId: input.channelId
          });

    return NextResponse.json({ registry });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete channel."
      },
      { status: 400 }
    );
  }
}

function normalizeGroupAssignments(assignments: Array<z.infer<typeof groupAssignmentSchema>>): WorkspaceChannelGroupAssignment[] {
  return assignments.map((assignment) => ({
    chatId: assignment.chatId,
    agentId: assignment.agentId ?? null,
    title: assignment.title ?? null,
    enabled: assignment.enabled !== false
  }));
}
