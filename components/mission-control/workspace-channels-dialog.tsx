"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import {
  getWorkspaceChannels,
  removeSnapshotChannelAccount,
  replaceSnapshotChannelRegistry,
  upsertSnapshotChannelAccount
} from "@/lib/openclaw/channel-bindings";
import type { MissionControlSnapshot } from "@/lib/openclaw/types";

export function WorkspaceChannelsDialog({
  snapshot,
  workspaceId,
  open,
  onOpenChange,
  onRefresh,
  onSnapshotChange
}: {
  snapshot: MissionControlSnapshot;
  workspaceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<void>;
  onSnapshotChange?: (updater: (snapshot: MissionControlSnapshot) => MissionControlSnapshot) => void;
}) {
  const workspace = useMemo(
    () => snapshot.workspaces.find((entry) => entry.id === workspaceId) ?? null,
    [snapshot.workspaces, workspaceId]
  );
  const workspaceAgents = useMemo(
    () => snapshot.agents.filter((agent) => agent.workspaceId === workspace?.id),
    [snapshot.agents, workspace?.id]
  );
  const workspaceChannels = useMemo(
    () => (workspace ? getWorkspaceChannels(snapshot, workspace.id) : []),
    [snapshot, workspace]
  );
  const telegramAccounts = useMemo(
    () =>
      snapshot.channelAccounts
        .filter((account) => account.type === "telegram")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [snapshot.channelAccounts]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<"existing" | "new">("existing");
  const [existingAddStatus, setExistingAddStatus] = useState<{
    accountId: string | null;
    kind: "idle" | "loading" | "success" | "error";
    message: string | null;
  }>({
    accountId: null,
    kind: "idle",
    message: null
  });
  const [deleteTarget, setDeleteTarget] = useState<MissionControlSnapshot["channelAccounts"][number] | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [newName, setNewName] = useState("");
  const [newToken, setNewToken] = useState("");
  const [newPrimaryAgentId, setNewPrimaryAgentId] = useState("");

  useEffect(() => {
    if (!open) {
      setNewName("");
      setNewToken("");
      setNewPrimaryAgentId("");
      setAddMode("existing");
      setIsSaving(false);
      setSavingMessage(null);
      setExistingAddStatus({
        accountId: null,
        kind: "idle",
        message: null
      });
      setDeleteTarget(null);
      setDeleteConfirmText("");
      return;
    }

    setAddMode(telegramAccounts.length > 0 ? "existing" : "new");
    setNewPrimaryAgentId((current) => current || workspaceAgents[0]?.id || "");
    setNewName("");
    setNewToken("");
  }, [open, telegramAccounts.length, workspaceAgents]);

  type ChannelMutationResult = {
    error?: string;
    registry?: MissionControlSnapshot["channelRegistry"];
    account?: MissionControlSnapshot["channelAccounts"][number];
  };

  const postWorkspaceChannel = async (payload: Record<string, unknown>): Promise<ChannelMutationResult> => {
    if (!workspace) {
      throw new Error("Workspace was not found.");
    }

    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/channels`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as ChannelMutationResult;
    if (!response.ok || result.error) {
      throw new Error(result.error || "OpenClaw could not update this channel right now.");
    }

    return result;
  };

  const patchWorkspaceChannel = async (payload: Record<string, unknown>): Promise<ChannelMutationResult> => {
    if (!workspace) {
      throw new Error("Workspace was not found.");
    }

    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/channels`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as ChannelMutationResult;
    if (!response.ok || result.error) {
      throw new Error(result.error || "OpenClaw could not update this channel right now.");
    }

    return result;
  };

  const deleteWorkspaceChannel = async (channelId: string): Promise<ChannelMutationResult> => {
    if (!workspace) {
      throw new Error("Workspace was not found.");
    }

    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/channels`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ channelId })
    });

    const result = (await response.json()) as ChannelMutationResult;
    if (!response.ok || result.error) {
      throw new Error(result.error || "OpenClaw could not update this channel right now.");
    }

    return result;
  };

  const deleteChannelEverywhere = async (channelId: string): Promise<ChannelMutationResult> => {
    if (!workspace) {
      throw new Error("Workspace was not found.");
    }

    const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/channels`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ channelId, scope: "global" })
    });

    const result = (await response.json()) as ChannelMutationResult;
    if (!response.ok || result.error) {
      throw new Error(result.error || "OpenClaw could not update this channel right now.");
    }

    return result;
  };

  const openDeleteConfirmation = (account: MissionControlSnapshot["channelAccounts"][number]) => {
    setDeleteTarget(account);
    setDeleteConfirmText("");
  };

  const closeDeleteConfirmation = () => {
    setDeleteTarget(null);
    setDeleteConfirmText("");
  };

  const beginSaving = (message: string) => {
    setIsSaving(true);
    setSavingMessage(message);
  };

  const endSaving = () => {
    setIsSaving(false);
    setSavingMessage(null);
  };

  const handleAddExisting = async (accountId: string, accountName: string) => {
    if (!workspace) {
      return;
    }

    beginSaving(`Adding ${accountName} to this workspace...`);
    setExistingAddStatus({
      accountId,
      kind: "loading",
      message: null
    });

    let succeeded = false;

    try {
      const result = await postWorkspaceChannel({
        channelId: accountId,
        type: "telegram",
        name: accountName,
        primaryAgentId: newPrimaryAgentId || null,
        agentId: newPrimaryAgentId || undefined
      });

      if (result.registry && onSnapshotChange) {
        onSnapshotChange((current) => replaceSnapshotChannelRegistry(current, result.registry!));
      }

      setExistingAddStatus({
        accountId,
        kind: "success",
        message: "Added to workspace."
      });
      succeeded = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown channel error.";
      setExistingAddStatus({
        accountId,
        kind: "error",
        message
      });
      toast.error("Channel add failed.", {
        description: message
      });
    } finally {
      endSaving();
    }

    if (succeeded) {
      toast.success("Telegram channel added to workspace.");
      void onRefresh().catch(() => {});
    }
  };

  const handleCreateNew = async () => {
    if (!workspace) {
      return;
    }

    if (!newName.trim() || !newToken.trim()) {
      toast.error("Channel name and bot token are required.");
      return;
    }

    beginSaving("Creating Telegram channel...");

    let succeeded = false;

    try {
      const result = await postWorkspaceChannel({
        type: "telegram",
        name: newName.trim(),
        token: newToken.trim(),
        primaryAgentId: newPrimaryAgentId || null,
        agentId: newPrimaryAgentId || undefined
      });
      setNewName("");
      setNewToken("");
      if (result.registry && onSnapshotChange) {
        onSnapshotChange((current) => {
          let next = replaceSnapshotChannelRegistry(current, result.registry!);
          if (result.account) {
            next = upsertSnapshotChannelAccount(next, result.account);
          }
          return next;
        });
      }
      succeeded = true;
    } catch (error) {
      toast.error("Channel creation failed.", {
        description: error instanceof Error ? error.message : "Unknown channel error."
      });
    } finally {
      endSaving();
    }

    if (succeeded) {
      toast.success("Telegram channel created.");
      void onRefresh().catch(() => {});
    }
  };

  const handlePrimaryChange = async (channelId: string, primaryAgentId: string) => {
    if (!workspace || !primaryAgentId) {
      return;
    }

    beginSaving("Updating primary agent...");

    let succeeded = false;

    try {
      const channel = workspaceChannels.find((entry) => entry.id === channelId);
      const workspaceBinding = channel?.workspaces.find((entry) => entry.workspaceId === workspace.id) ?? null;

      if (channel && workspaceBinding && !workspaceBinding.agentIds.includes(primaryAgentId)) {
        const bindResult = await patchWorkspaceChannel({
          action: "bind-agent",
          channelId,
          agentId: primaryAgentId,
          workspacePath: workspace.path
        });

        if (bindResult.registry && onSnapshotChange) {
          onSnapshotChange((current) => replaceSnapshotChannelRegistry(current, bindResult.registry!));
        }
      }

      const result = await patchWorkspaceChannel({
        action: "primary",
        channelId,
        primaryAgentId
      });

      if (result.registry && onSnapshotChange) {
        onSnapshotChange((current) => replaceSnapshotChannelRegistry(current, result.registry!));
      }

      succeeded = true;
    } catch (error) {
      toast.error("Primary update failed.", {
        description: error instanceof Error ? error.message : "Unknown channel error."
      });
    } finally {
      endSaving();
    }

    if (succeeded) {
      toast.success("Primary agent updated.");
      void onRefresh().catch(() => {});
    }
  };

  const handleDisconnect = async (channelId: string) => {
    if (!workspace) {
      return;
    }

    beginSaving("Removing channel from workspace...");

    let succeeded = false;

    try {
      const result = await deleteWorkspaceChannel(channelId);

      if (result.registry && onSnapshotChange) {
        onSnapshotChange((current) => replaceSnapshotChannelRegistry(current, result.registry!));
      }

      succeeded = true;
    } catch (error) {
      toast.error("Channel removal failed.", {
        description: error instanceof Error ? error.message : "Unknown channel error."
      });
    } finally {
      endSaving();
    }

    if (succeeded) {
      toast.success("Channel removed from workspace.");
      void onRefresh().catch(() => {});
    }
  };

  const deleteSummary = useMemo(() => {
    if (!deleteTarget) {
      return null;
    }

    const channel = snapshot.channelRegistry.channels.find((entry) => entry.id === deleteTarget.id) ?? null;
    const workspaceBindings = channel?.workspaces ?? [];
    const affectedWorkspaceDetails = workspaceBindings
      .map((binding) => {
        const workspaceEntry = snapshot.workspaces.find((entry) => entry.id === binding.workspaceId) ?? null;
        const agentNames = uniqueStrings(
          binding.agentIds.map((agentId) => snapshot.agents.find((agent) => agent.id === agentId)?.name ?? agentId)
        );
        const groupAgentNames = uniqueStrings(
          binding.groupAssignments
            .filter((assignment) => assignment.enabled !== false && assignment.agentId)
            .map(
              (assignment) =>
                snapshot.agents.find((agent) => agent.id === assignment.agentId)?.name ?? assignment.agentId ?? ""
            )
        );

        return {
          workspaceId: binding.workspaceId,
          workspaceName: workspaceEntry?.name ?? binding.workspaceId,
          agentNames: uniqueStrings([...agentNames, ...groupAgentNames]),
          groupRouteCount: binding.groupAssignments.filter((assignment) => assignment.enabled !== false).length
        };
      })
      .sort((left, right) => left.workspaceName.localeCompare(right.workspaceName));
    const affectedAgentIds = uniqueStrings([
      ...workspaceBindings.flatMap((binding) => binding.agentIds),
      ...workspaceBindings.flatMap((binding) =>
        binding.groupAssignments
          .filter((assignment) => assignment.enabled !== false && assignment.agentId)
          .map((assignment) => assignment.agentId as string)
      ),
      channel?.primaryAgentId ?? ""
    ]);
    const affectedAgentNames = uniqueStrings(
      affectedAgentIds.map((agentId) => snapshot.agents.find((agent) => agent.id === agentId)?.name ?? agentId)
    );
    const primaryAgentName = channel?.primaryAgentId
      ? snapshot.agents.find((agent) => agent.id === channel.primaryAgentId)?.name ?? channel.primaryAgentId
      : null;

    return {
      channel,
      workspaceBindings,
      affectedWorkspaceDetails,
      affectedAgentNames,
      primaryAgentName
    };
  }, [deleteTarget, snapshot]);

  const isDeleteConfirmationValid =
    deleteTarget !== null &&
    normalizeDeleteConfirmation(deleteConfirmText) === normalizeDeleteConfirmation(deleteTarget.name);

  const handleDeleteEverywhere = async () => {
    if (!deleteTarget || !isDeleteConfirmationValid) {
      return;
    }

    beginSaving(`Deleting ${deleteTarget.name} everywhere...`);

    let succeeded = false;

    try {
      const result = await deleteChannelEverywhere(deleteTarget.id);
      closeDeleteConfirmation();

      if (result.registry && onSnapshotChange) {
        onSnapshotChange((current) => {
          let next = replaceSnapshotChannelRegistry(current, result.registry!);
          next = removeSnapshotChannelAccount(next, deleteTarget.id);
          return next;
        });
      }

      succeeded = true;
    } catch (error) {
      toast.error("Channel deletion failed.", {
        description: error instanceof Error ? error.message : "Unknown channel error."
      });
    } finally {
      endSaving();
    }

    if (succeeded) {
      toast.success("Channel deleted everywhere.");
      void onRefresh().catch(() => {});
    }
  };

  const existingAccountIds = new Set(workspaceChannels.map((channel) => channel.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Workspace Channels</DialogTitle>
          <DialogDescription>Manage Telegram accounts for this workspace. Disconnect only detaches here; Delete removes the account everywhere.</DialogDescription>
        </DialogHeader>

        {isSaving && savingMessage ? (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.08] px-3 py-2">
            <div className="flex items-center gap-2 text-[11px] text-cyan-50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{savingMessage}</span>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Workspace channels</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Primary agent, bound agents, and disconnect live here.
                </p>
              </div>
              <Badge variant="muted" className="h-6 rounded-full px-2 text-[10px]">
                {workspaceChannels.length}
              </Badge>
            </div>

            <div className="mt-3">
              {workspaceChannels.length > 0 ? (
                <ScrollArea className="max-h-[290px] pr-1">
                  <div className="space-y-2">
                    {workspaceChannels.map((channel) => {
                      const workspaceBinding =
                        channel.workspaces.find((entry) => entry.workspaceId === workspace?.id) ?? null;
                      const primaryAgentId = channel.primaryAgentId ?? "";
                      const primaryAgentName = primaryAgentId
                        ? snapshot.agents.find((agent) => agent.id === primaryAgentId)?.name ?? primaryAgentId
                        : "Unset";
                      const boundAgentCount = workspaceBinding?.agentIds.length ?? 0;

                      return (
                        <div
                          key={channel.id}
                          className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-medium text-white">{channel.name}</p>
                                <Badge variant="muted" className="h-5 rounded-full px-2 text-[10px]">
                                  {channel.type}
                                </Badge>
                                <Badge className="h-5 rounded-full px-2 text-[10px]">
                                  {primaryAgentId ? "Global primary" : "Primary unset"}
                                </Badge>
                              </div>
                              <p className="truncate text-[11px] text-slate-400">
                                {channel.id} · primary {primaryAgentName} · {boundAgentCount} bound
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <select
                                id={`workspace-channel-primary-${channel.id}`}
                                value={primaryAgentId}
                                onChange={(event) => void handlePrimaryChange(channel.id, event.target.value)}
                                className="flex h-8 min-w-[170px] rounded-full border border-white/10 bg-white/5 px-3 text-[11px] text-white outline-none"
                                disabled={isSaving}
                              >
                                <option value="">Select primary</option>
                                {workspaceAgents.map((agent) => (
                                  <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                  </option>
                                ))}
                              </select>

                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 rounded-full px-3 text-[11px]"
                                disabled={isSaving}
                                onClick={() => handleDisconnect(channel.id)}
                              >
                                Disconnect
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-slate-400">
                  No channels have been added to this workspace yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Add Telegram</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Reuse a stored bot or create a new one for this workspace.
                </p>
              </div>
              <Badge variant="muted" className="h-6 rounded-full px-2 text-[10px]">
                {telegramAccounts.length} saved
              </Badge>
            </div>

            <Tabs className="mt-3" value={addMode} onValueChange={(value) => setAddMode(value as "existing" | "new")}>
              <TabsList className="h-10">
                <TabsTrigger className="h-8 rounded-xl px-3 text-[12px]" value="existing">
                  Existing
                </TabsTrigger>
                <TabsTrigger className="h-8 rounded-xl px-3 text-[12px]" value="new">
                  New
                </TabsTrigger>
              </TabsList>

              <TabsContent className="mt-3" value="existing">
                {telegramAccounts.length > 0 ? (
                  <ScrollArea className="max-h-[240px] pr-1">
                    <div className="space-y-2">
                      {telegramAccounts.map((account) => {
                        const alreadyAdded = existingAccountIds.has(account.id);

                        return (
                          <div
                            key={account.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-white">{account.name}</p>
                                <Badge variant="muted" className="h-5 rounded-full px-2 text-[10px]">
                                  telegram
                                </Badge>
                                {alreadyAdded ? (
                                  <Badge className="h-5 rounded-full px-2 text-[10px]">In workspace</Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-[11px] text-slate-400">{account.id}</p>
                              {existingAddStatus.accountId === account.id && existingAddStatus.kind !== "idle" ? (
                                <p
                                  className={
                                    existingAddStatus.kind === "error"
                                      ? "mt-1 text-[11px] text-rose-300"
                                      : existingAddStatus.kind === "success"
                                        ? "mt-1 text-[11px] text-emerald-300"
                                        : "mt-1 text-[11px] text-slate-400"
                                  }
                                >
                                  {existingAddStatus.kind === "loading"
                                    ? "Adding..."
                                    : existingAddStatus.message}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Button
                                type="button"
                                variant={alreadyAdded ? "secondary" : "default"}
                                size="sm"
                                className="h-8 rounded-full px-2.5 text-[11px] whitespace-nowrap"
                                disabled={isSaving || alreadyAdded}
                                onClick={() => handleAddExisting(account.id, account.name)}
                              >
                                {existingAddStatus.accountId === account.id && existingAddStatus.kind === "loading"
                                  ? "Adding..."
                                  : alreadyAdded
                                    ? "Added"
                                    : "Add"}
                              </Button>

                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8 rounded-full px-2.5 text-[11px] whitespace-nowrap"
                                disabled={isSaving}
                                onClick={() => openDeleteConfirmation(account)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-slate-400">
                    No stored Telegram accounts yet. Switch to <span className="text-white">New</span> to add one.
                  </div>
                )}
              </TabsContent>

              <TabsContent className="mt-3" value="new">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Channel name" htmlFor="workspace-channel-name">
                    <Input
                      id="workspace-channel-name"
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      placeholder="Support bot"
                    />
                  </FormField>
                  <FormField label="Bot token" htmlFor="workspace-channel-token">
                    <Input
                      id="workspace-channel-token"
                      value={newToken}
                      onChange={(event) => setNewToken(event.target.value)}
                      placeholder="123456:ABC..."
                    />
                  </FormField>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <FormField label="Primary agent" htmlFor="workspace-channel-primary">
                    <select
                      id="workspace-channel-primary"
                      value={newPrimaryAgentId}
                      onChange={(event) => setNewPrimaryAgentId(event.target.value)}
                      className="flex h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none"
                    >
                      <option value="">Select agent</option>
                      {workspaceAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <Button
                    type="button"
                    className="h-11 rounded-full px-4"
                  disabled={isSaving || !newName.trim() || !newToken.trim() || !newPrimaryAgentId}
                  onClick={handleCreateNew}
                >
                    {isSaving ? "Creating..." : "Create"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(nextOpen) => !nextOpen && closeDeleteConfirmation()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delete Telegram account</DialogTitle>
          <DialogDescription>
            This permanently removes the account from every workspace and deletes the OpenClaw channel account.
          </DialogDescription>
        </DialogHeader>

        {isSaving && savingMessage ? (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.08] px-3 py-2">
            <div className="flex items-center gap-2 text-[11px] text-cyan-50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{savingMessage}</span>
            </div>
          </div>
        ) : null}

        {deleteSummary ? (
          <div className="space-y-4">
            <div className="rounded-[20px] border border-rose-500/25 bg-rose-500/[0.08] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-rose-50">
                    Deleting {deleteTarget?.name} will remove access from every place it is used.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-rose-100/80">
                    {deleteSummary.workspaceBindings.length > 0
                      ? `It is currently connected to ${deleteSummary.workspaceBindings.length} workspace${
                          deleteSummary.workspaceBindings.length === 1 ? "" : "s"
                        } and ${deleteSummary.affectedAgentNames.length} agent${
                          deleteSummary.affectedAgentNames.length === 1 ? "" : "s"
                        }.`
                      : "It is not connected to any workspace yet, so this will only remove the stored account."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryPill label="Workspace links" value={String(deleteSummary.workspaceBindings.length)} />
              <SummaryPill label="Affected agents" value={String(deleteSummary.affectedAgentNames.length)} />
              <SummaryPill label="Primary" value={deleteSummary.primaryAgentName ?? "Unset"} />
            </div>

            {deleteSummary.affectedWorkspaceDetails.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Affected workspaces</p>
                <ScrollArea className="max-h-[220px] pr-1">
                  <div className="space-y-2">
                    {deleteSummary.affectedWorkspaceDetails.map((workspaceDetail) => (
                      <div
                        key={workspaceDetail.workspaceId}
                        className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{workspaceDetail.workspaceName}</p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {workspaceDetail.agentNames.length > 0
                                ? workspaceDetail.agentNames.join(", ")
                                : "No direct agent bindings"}
                            </p>
                          </div>
                          <Badge variant="muted" className="h-5 rounded-full px-2 text-[10px]">
                            {workspaceDetail.groupRouteCount} group routes
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : null}

            <div className="space-y-2">
              <FormField label={`Type ${deleteTarget?.name ?? ""} to confirm`} htmlFor="delete-channel-confirm">
                <Input
                  id="delete-channel-confirm"
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  placeholder={deleteTarget?.name ?? ""}
                />
              </FormField>
              <p className="text-[11px] text-slate-400">
                This action is permanent. The account, workspace bindings, and agent references will be removed.
              </p>
            </div>
          </div>
        ) : null}

          <DialogFooter>
            <Button variant="secondary" onClick={closeDeleteConfirmation}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={!isDeleteConfirmationValid || isSaving} onClick={() => void handleDeleteEverywhere()}>
              {isSaving ? "Deleting..." : "Delete everywhere"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function FormField({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SummaryPill({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeDeleteConfirmation(value: string) {
  return value.trim().toLowerCase();
}
