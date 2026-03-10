"use client";

import { FolderOpen, GitBranch, Globe, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OperationProgress } from "@/components/mission-control/operation-progress";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { consumeNdjsonStream } from "@/lib/ndjson";
import {
  buildWorkspaceCreateProgressTemplate,
  createPendingOperationProgressSnapshot
} from "@/lib/openclaw/operation-progress";
import { DEFAULT_WORKSPACE_RULES, WORKSPACE_TEMPLATE_OPTIONS } from "@/lib/openclaw/workspace-presets";
import { compactPath } from "@/lib/openclaw/presenters";
import type {
  MissionControlSnapshot,
  OperationProgressSnapshot,
  WorkspaceCreateInput,
  WorkspaceCreateResult,
  WorkspaceCreateStreamEvent,
  WorkspaceSourceMode,
  WorkspaceTemplate
} from "@/lib/openclaw/types";
import { cn } from "@/lib/utils";

type WorkspaceCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAdvanced: () => void;
  snapshot: MissionControlSnapshot;
  onRefresh: () => Promise<void>;
  onWorkspaceCreated: (workspaceId: string) => void;
};

type QuickCreateDraft = {
  name: string;
  goal: string;
  source: string;
};

type SourceAnalysis = {
  kind: "empty" | "clone" | "existing" | "website" | "context";
  createSourceMode: WorkspaceSourceMode;
  label: string;
  hint: string;
  repoUrl?: string;
  existingPath?: string;
  websiteUrl?: string;
  contextText?: string;
};

const quickCreateRules = {
  ...DEFAULT_WORKSPACE_RULES,
  workspaceOnly: true,
  generateStarterDocs: true,
  generateMemory: true,
  kickoffMission: true
} satisfies NonNullable<WorkspaceCreateInput["rules"]>;

const templateLabels = Object.fromEntries(
  WORKSPACE_TEMPLATE_OPTIONS.map((option) => [option.value, option.label])
) as Record<WorkspaceTemplate, string>;

const ignoredNameTokens = new Set([
  "a",
  "an",
  "and",
  "autonomous",
  "automate",
  "automated",
  "automation",
  "build",
  "create",
  "for",
  "from",
  "in",
  "launch",
  "new",
  "of",
  "on",
  "project",
  "run",
  "runs",
  "set",
  "setup",
  "start",
  "that",
  "the",
  "to",
  "up",
  "workspace"
]);

export function WorkspaceCreateDialog({
  open,
  onOpenChange,
  onOpenAdvanced,
  snapshot,
  onRefresh,
  onWorkspaceCreated
}: WorkspaceCreateDialogProps) {
  const [draft, setDraft] = useState<QuickCreateDraft>(createInitialDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState<OperationProgressSnapshot | null>(null);
  const [nameWasEdited, setNameWasEdited] = useState(false);

  useEffect(() => {
    if (!open) {
      setDraft(createInitialDraft());
      setNameWasEdited(false);
      setCreateProgress(null);
    }
  }, [open]);

  const sourceAnalysis = useMemo(() => analyzeSourceInput(draft.source), [draft.source]);
  const inferredTemplate = useMemo(
    () => inferTemplateFromText(`${draft.goal}\n${draft.source}`),
    [draft.goal, draft.source]
  );
  const resolvedName = useMemo(() => {
    const manualName = draft.name.trim();
    if (manualName) {
      return manualName;
    }

    return inferWorkspaceName(draft.source, draft.goal) || "New Workspace";
  }, [draft.goal, draft.name, draft.source]);

  useEffect(() => {
    if (nameWasEdited) {
      return;
    }

    const inferredName = inferWorkspaceName(draft.source, draft.goal);
    setDraft((current) => {
      if ((current.name || "") === (inferredName || "")) {
        return current;
      }

      return {
        ...current,
        name: inferredName || ""
      };
    });
  }, [draft.goal, draft.source, nameWasEdited]);

  const canCreate = Boolean(draft.goal.trim() && resolvedName.trim());
  const workspacePath = workspacePathPreview(
    snapshot.diagnostics.workspaceRoot,
    resolvedName,
    sourceAnalysis
  );
  const initialCreateProgress = useMemo(
    () =>
      createPendingOperationProgressSnapshot(
        buildWorkspaceCreateProgressTemplate({
          sourceMode: sourceAnalysis.createSourceMode,
          agentCount: 1,
          kickoffMission: quickCreateRules.kickoffMission
        })
      ),
    [sourceAnalysis.createSourceMode]
  );

  const createWorkspace = async () => {
    if (!canCreate) {
      return;
    }

    setIsCreating(true);
    setCreateProgress(initialCreateProgress);

    try {
      const requestBody: WorkspaceCreateInput & { stream: true } = {
        name: resolvedName,
        brief: buildQuickCreateBrief(draft.goal, sourceAnalysis),
        sourceMode: sourceAnalysis.createSourceMode,
        repoUrl: sourceAnalysis.repoUrl,
        existingPath: sourceAnalysis.existingPath,
        template: inferredTemplate,
        teamPreset: "solo",
        modelProfile: "balanced",
        rules: quickCreateRules,
        stream: true
      };

      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "OpenClaw could not create the workspace.");
      }

      let createdResult: WorkspaceCreateResult | null = null;
      let createError: string | null = null;

      await consumeNdjsonStream<WorkspaceCreateStreamEvent>(response, async (event) => {
        if (event.type === "progress") {
          setCreateProgress(event.progress);
          return;
        }

        if (event.progress) {
          setCreateProgress(event.progress);
        }

        if (event.ok) {
          createdResult = event.result;
        } else {
          createError = event.error;
        }
      });

      if (createError || !createdResult) {
        throw new Error(createError || "OpenClaw could not create the workspace.");
      }

      const result = createdResult as WorkspaceCreateResult;

      toast.success("Workspace created.", {
        description: `${result.agentIds.length} agent${result.agentIds.length === 1 ? "" : "s"} created at ${result.workspacePath}`
      });

      if (result.kickoffError) {
        toast.message("Workspace created, but kickoff needs attention.", {
          description: result.kickoffError
        });
      }

      onOpenChange(false);
      await onRefresh();
      onWorkspaceCreated(result.workspaceId);
    } catch (error) {
      toast.error("Workspace creation failed.", {
        description: error instanceof Error ? error.message : "Unknown workspace error."
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[84vh] max-w-2xl gap-3 overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Start with a short goal. Add a repo, website, or existing folder if helpful.
          </DialogDescription>
        </DialogHeader>

        {isCreating ? (
          <OperationProgress
            progress={createProgress ?? initialCreateProgress}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <FieldBlock label="Workspace name" htmlFor="workspace-name">
                <Input
                  id="workspace-name"
                  value={draft.name}
                  onChange={(event) => {
                    setNameWasEdited(true);
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value
                    }));
                  }}
                  placeholder={resolvedName}
                />
                <p className="text-xs text-slate-400">Optional. If blank, it will be inferred.</p>
              </FieldBlock>

              <FieldBlock label="Source" htmlFor="workspace-source">
                <Input
                  id="workspace-source"
                  value={draft.source}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      source: event.target.value
                    }))
                  }
                  placeholder="Repo URL, website URL, or existing folder path"
                />
                <p className="text-xs text-slate-400">Git clones, paths attach, websites become context.</p>
              </FieldBlock>
            </div>

            <FieldBlock label="What should this workspace do?" htmlFor="workspace-goal">
              <Textarea
                id="workspace-goal"
                value={draft.goal}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    goal: event.target.value
                  }))
                }
                placeholder="Example: Run the Telegram community for key2web3.com, keep handoffs clean, and prepare the first operating setup."
                className="min-h-[112px] max-h-[180px]"
              />
            </FieldBlock>

            <div className="rounded-[18px] border border-white/10 bg-slate-950/45 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Auto setup</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="muted" className="px-2 py-0 text-[10px] tracking-[0.12em]">
                    Solo
                  </Badge>
                  <Badge variant="muted" className="px-2 py-0 text-[10px] tracking-[0.12em]">
                    Balanced
                  </Badge>
                  <Badge variant="muted" className="px-2 py-0 text-[10px] tracking-[0.12em]">
                    Kickoff
                  </Badge>
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <SummaryRow
                  icon={Sparkles}
                  title="Name"
                  value={resolvedName}
                />
                <SummaryRow
                  icon={sourceAnalysis.kind === "clone" ? GitBranch : sourceAnalysis.kind === "website" ? Globe : FolderOpen}
                  title="Start from"
                  value={sourceAnalysis.label}
                  hint={sourceAnalysis.hint}
                />
                <SummaryRow
                  icon={Sparkles}
                  title="Template"
                  value={templateLabels[inferredTemplate]}
                />
                <SummaryRow
                  icon={FolderOpen}
                  title="Path"
                  value={workspacePath}
                  mono
                />
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                Need more control? Advanced setup opens the full planner for team, workflow, automation, and channel design.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-slate-400">Create now bootstraps immediately.</p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button size="sm" variant="secondary" onClick={onOpenAdvanced} disabled={isCreating}>
              Advanced setup
            </Button>
            <Button size="sm" onClick={createWorkspace} disabled={!canCreate || isCreating}>
              {isCreating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Create now
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({
  icon: Icon,
  title,
  value,
  hint,
  mono = false
}: {
  icon: typeof Sparkles;
  title: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-200">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <p className={cn("mt-1 truncate text-sm text-white", mono && "font-mono text-[11px]")}>{value}</p>
          {hint ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

function FieldBlock({
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
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function createInitialDraft(): QuickCreateDraft {
  return {
    name: "",
    goal: "",
    source: ""
  };
}

function buildQuickCreateBrief(goal: string, source: SourceAnalysis) {
  const lines = [goal.trim()];

  if (source.kind === "clone" && source.repoUrl) {
    lines.push(`Bootstrap source: clone ${source.repoUrl}`);
  }

  if (source.kind === "existing" && source.existingPath) {
    lines.push(`Bootstrap source: existing folder ${source.existingPath}`);
  }

  if (source.kind === "website" && source.websiteUrl) {
    lines.push(`Reference website: ${source.websiteUrl}`);
  }

  if (source.kind === "context" && source.contextText) {
    lines.push(`Additional context: ${source.contextText}`);
  }

  return lines.filter(Boolean).join("\n");
}

function analyzeSourceInput(rawValue: string): SourceAnalysis {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return {
      kind: "empty",
      createSourceMode: "empty",
      label: "Fresh workspace",
      hint: "Mission Control will scaffold a new project folder."
    };
  }

  if (isLikelyExistingPath(trimmed)) {
    return {
      kind: "existing",
      createSourceMode: "existing",
      label: "Existing folder",
      hint: trimmed,
      existingPath: trimmed
    };
  }

  if (isLikelySshRepositoryUrl(trimmed)) {
    return {
      kind: "clone",
      createSourceMode: "clone",
      label: "Clone repository",
      hint: trimmed,
      repoUrl: trimmed
    };
  }

  const normalizedUrl = normalizeUrlCandidate(trimmed);
  if (normalizedUrl) {
    if (isLikelyRepositoryUrl(normalizedUrl)) {
      return {
        kind: "clone",
        createSourceMode: "clone",
        label: "Clone repository",
        hint: normalizedUrl,
        repoUrl: normalizedUrl
      };
    }

    return {
      kind: "website",
      createSourceMode: "empty",
      label: "Fresh workspace + website",
      hint: normalizedUrl,
      websiteUrl: normalizedUrl
    };
  }

  return {
    kind: "context",
    createSourceMode: "empty",
    label: "Fresh workspace + context",
    hint: "The pasted source will be attached to the brief.",
    contextText: trimmed
  };
}

function inferWorkspaceName(source: string, goal: string) {
  const sourceName = inferNameFromSource(source);
  if (sourceName) {
    return sourceName;
  }

  const quotedName = goal.match(/["“]([^"”]+)["”]/)?.[1]?.trim();
  if (quotedName) {
    return quotedName;
  }

  const tokens = goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !ignoredNameTokens.has(part))
    .slice(0, 4);

  if (tokens.length === 0) {
    return "";
  }

  return tokens
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function inferNameFromSource(source: string) {
  const trimmed = source.trim();
  if (!trimmed) {
    return undefined;
  }

  if (isLikelySshRepositoryUrl(trimmed)) {
    return inferNameFromRepositoryPath(trimmed.split(":").at(-1) ?? "");
  }

  const normalizedUrl = normalizeUrlCandidate(trimmed);
  if (normalizedUrl) {
    if (isLikelyRepositoryUrl(normalizedUrl)) {
      return inferNameFromRepositoryPath(new URL(normalizedUrl).pathname);
    }

    return inferNameFromUrl(normalizedUrl);
  }

  if (isLikelyExistingPath(trimmed)) {
    return inferNameFromRepositoryPath(trimmed);
  }

  return undefined;
}

function inferTemplateFromText(text: string): WorkspaceTemplate {
  const lower = text.toLowerCase();

  if (/\b(telegram|discord|community|channel automation|campaign|content|marketing|growth|seo|newsletter)\b/.test(lower)) {
    return "content";
  }

  if (/\b(frontend|ui|website|landing page|design system|dashboard)\b/.test(lower)) {
    return "frontend";
  }

  if (/\b(backend|api|service|microservice|worker|cron|queue|sdk)\b/.test(lower)) {
    return "backend";
  }

  if (/\b(research|investigation|analysis|benchmark|thesis)\b/.test(lower)) {
    return "research";
  }

  return "software";
}

function workspacePathPreview(workspaceRoot: string, workspaceName: string, source: SourceAnalysis) {
  if (source.kind === "existing" && source.existingPath) {
    return source.existingPath;
  }

  const slug = (workspaceName || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${compactPath(workspaceRoot)}/${slug || "workspace"}`;
}

function isLikelyExistingPath(value: string) {
  return value.startsWith("/") || value.startsWith("./") || value.startsWith("../");
}

function isLikelySshRepositoryUrl(value: string) {
  return /^git@[^:]+:[^/].+/.test(value);
}

function normalizeUrlCandidate(value: string) {
  if (value.includes("@")) {
    return null;
  }

  const cleaned = value.replace(/[),.;!?]+$/g, "");
  const candidate = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;

  try {
    const url = new URL(candidate);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

function isLikelyRepositoryUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    return host === "github.com" || host === "gitlab.com" || host === "bitbucket.org" || pathname.endsWith(".git");
  } catch {
    return false;
  }
}

function inferNameFromUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "");
    const [rawName] = hostname.split(".");

    if (!rawName) {
      return undefined;
    }

    return rawName
      .split(/[-_]+/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return undefined;
  }
}

function inferNameFromRepositoryPath(value: string) {
  const normalized = value
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/\.git$/i, "");

  if (!normalized) {
    return undefined;
  }

  return normalized
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
