"use client";

import { Check, ChevronRight, FolderGit2, GitBranch, LoaderCircle, Plus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  DEFAULT_WORKSPACE_RULES,
  buildDefaultWorkspaceAgents,
  buildWorkspaceFolderPreview,
  buildWorkspaceScaffoldPreview,
  WORKSPACE_MODEL_PROFILE_OPTIONS,
  WORKSPACE_SOURCE_OPTIONS,
  WORKSPACE_TEAM_PRESET_OPTIONS,
  WORKSPACE_TEMPLATE_OPTIONS
} from "@/lib/openclaw/workspace-presets";
import type {
  MissionControlSnapshot,
  WorkspaceAgentBlueprintInput,
  WorkspaceCreateInput,
  WorkspaceCreateResult,
  WorkspaceModelProfile,
  WorkspaceSourceMode,
  WorkspaceTeamPreset,
  WorkspaceTemplate
} from "@/lib/openclaw/types";
import { cn } from "@/lib/utils";

const wizardSteps = [
  {
    key: "basics",
    label: "Basics",
    description: "Name, brief, source, and template"
  },
  {
    key: "team",
    label: "Team",
    description: "Agent preset, model, and specialists"
  },
  {
    key: "rules",
    label: "Rules",
    description: "Policies, docs, and memory"
  },
  {
    key: "review",
    label: "Review",
    description: "Confirm what will be created"
  }
] as const;

type WizardStepIndex = 0 | 1 | 2 | 3;

type WorkspaceCreateDialogProps = {
  snapshot: MissionControlSnapshot;
  onRefresh: () => Promise<void>;
  onWorkspaceCreated: (workspaceId: string) => void;
  trigger?: ReactNode;
};

export function WorkspaceCreateDialog({
  snapshot,
  onRefresh,
  onWorkspaceCreated,
  trigger
}: WorkspaceCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStepIndex>(0);
  const [showAdvancedSource, setShowAdvancedSource] = useState(false);
  const [draft, setDraft] = useState<WorkspaceCreateInput>(() => createInitialDraft());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setShowAdvancedSource(false);
      setDraft(createInitialDraft());
    }
  }, [open]);

  const sourceMode = draft.sourceMode ?? "empty";
  const template = draft.template ?? "software";
  const teamPreset = draft.teamPreset ?? "core";
  const modelProfile = draft.modelProfile ?? "balanced";
  const rules = {
    ...DEFAULT_WORKSPACE_RULES,
    ...(draft.rules ?? {})
  };
  const agents = draft.agents ?? buildDefaultWorkspaceAgents(template, teamPreset);
  const enabledAgents = agents.filter((agent) => agent.enabled);
  const scaffoldFiles = buildWorkspaceScaffoldPreview(template, rules);
  const scaffoldFolders = buildWorkspaceFolderPreview(rules);
  const stepIsValid = validateStep(step, {
    draft,
    enabledAgentsCount: enabledAgents.length
  });

  const updateDraft = (next: Partial<WorkspaceCreateInput>) => {
    setDraft((current) => ({
      ...current,
      ...next
    }));
  };

  const updateTemplate = (nextTemplate: WorkspaceTemplate) => {
    setDraft((current) => ({
      ...current,
      template: nextTemplate,
      agents: buildDefaultWorkspaceAgents(nextTemplate, current.teamPreset ?? "core")
    }));
  };

  const updateTeamPreset = (nextTeamPreset: WorkspaceTeamPreset) => {
    setDraft((current) => ({
      ...current,
      teamPreset: nextTeamPreset,
      agents: buildDefaultWorkspaceAgents(current.template ?? "software", nextTeamPreset)
    }));
  };

  const updateAgent = (index: number, next: Partial<WorkspaceAgentBlueprintInput>) => {
    setDraft((current) => {
      const nextAgents = [...(current.agents ?? [])];
      nextAgents[index] = {
        ...nextAgents[index],
        ...next
      };

      if (next.isPrimary) {
        nextAgents.forEach((agent, agentIndex) => {
          if (agentIndex !== index) {
            nextAgents[agentIndex] = {
              ...agent,
              isPrimary: false
            };
          }
        });
      }

      if (!nextAgents.some((agent) => agent.enabled && agent.isPrimary)) {
        const firstEnabledIndex = nextAgents.findIndex((agent) => agent.enabled);

        if (firstEnabledIndex >= 0) {
          nextAgents[firstEnabledIndex] = {
            ...nextAgents[firstEnabledIndex],
            isPrimary: true
          };
        }
      }

      return {
        ...current,
        agents: nextAgents
      };
    });
  };

  const createWorkspace = async () => {
    setIsCreating(true);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...draft,
          rules,
          agents
        })
      });

      const result = (await response.json()) as WorkspaceCreateResult & { error?: string };

      if (!response.ok || result.error) {
        throw new Error(result.error || "OpenClaw could not create the workspace.");
      }

      toast.success("Workspace created in OpenClaw.", {
        description: `${result.agentIds.length} agent${result.agentIds.length === 1 ? "" : "s"} created at ${result.workspacePath}`
      });

      if (result.kickoffError) {
        toast.message("Workspace created, but kickoff needs attention.", {
          description: result.kickoffError
        });
      }

      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" size="sm" className="h-7 rounded-full px-2 text-[11px]">
            <Plus className="mr-1.5 h-3 w-3" />
            Create workspace
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[86vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a rich OpenClaw workspace</DialogTitle>
          <DialogDescription>
            Bootstrap a full workspace scaffold, local agent state, shared docs, memory, and a specialist team with minimal input.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 lg:grid-cols-[220px,minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
            <div className="space-y-2">
              {wizardSteps.map((wizardStep, index) => {
                const state =
                  index === step ? "active" : index < step ? "complete" : "upcoming";

                return (
                  <button
                    key={wizardStep.key}
                    type="button"
                    onClick={() => {
                      if (index <= step) {
                        setStep(index as WizardStepIndex);
                      }
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[18px] border px-3 py-3 text-left transition-colors",
                      state === "active" && "border-cyan-300/30 bg-cyan-400/10",
                      state === "complete" && "border-white/10 bg-white/[0.03]",
                      state === "upcoming" && "border-white/5 bg-transparent opacity-75"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold",
                        state === "active" && "border-cyan-300/40 bg-cyan-300/15 text-cyan-100",
                        state === "complete" && "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
                        state === "upcoming" && "border-white/10 bg-white/[0.04] text-slate-300"
                      )}
                    >
                      {state === "complete" ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="space-y-1">
                      <span className="block text-sm font-medium text-white">{wizardStep.label}</span>
                      <span className="block text-xs text-slate-400">{wizardStep.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-[18px] border border-white/10 bg-slate-950/60 p-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Workspace preview</p>
              <p className="mt-2 font-display text-lg text-white">{draft.name?.trim() || "Untitled workspace"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="muted">{template}</Badge>
                <Badge variant="muted">{sourceMode}</Badge>
                <Badge variant="muted">{teamPreset}</Badge>
              </div>
              <p className="mt-3 text-xs text-slate-400">{workspacePathPreview(draft.name, draft.directory, sourceMode, draft.existingPath)}</p>
            </div>
          </aside>

          <div className="space-y-5 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,32,0.86),rgba(8,13,24,0.82))] p-4">
            {step === 0 ? (
              <BasicsStep
                draft={draft}
                showAdvancedSource={showAdvancedSource}
                onShowAdvancedSource={setShowAdvancedSource}
                onUpdateDraft={updateDraft}
                onUpdateTemplate={updateTemplate}
              />
            ) : null}

            {step === 1 ? (
              <TeamStep
                draft={draft}
                snapshot={snapshot}
                teamPreset={teamPreset}
                modelProfile={modelProfile}
                agents={agents}
                enabledAgents={enabledAgents}
                onUpdateDraft={updateDraft}
                onUpdateTeamPreset={updateTeamPreset}
                onUpdateAgent={updateAgent}
              />
            ) : null}

            {step === 2 ? (
              <RulesStep
                rules={rules}
                scaffoldFiles={scaffoldFiles}
                scaffoldFolders={scaffoldFolders}
                onUpdateRule={(ruleKey, value) =>
                  updateDraft({
                    rules: {
                      ...rules,
                      [ruleKey]: value
                    }
                  })
                }
              />
            ) : null}

            {step === 3 ? (
              <ReviewStep
                draft={draft}
                agents={agents}
                rules={rules}
                scaffoldFiles={scaffoldFiles}
                scaffoldFolders={scaffoldFolders}
              />
            ) : null}
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <div className="text-xs text-slate-400">
            {enabledAgents.length} agent{enabledAgents.length === 1 ? "" : "s"} enabled
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button variant="secondary" onClick={() => (step === 0 ? setOpen(false) : setStep((step - 1) as WizardStepIndex))}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep((step + 1) as WizardStepIndex)}
                disabled={!stepIsValid}
              >
                Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={createWorkspace} disabled={!stepIsValid || isCreating}>
                {isCreating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Create workspace
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BasicsStep({
  draft,
  showAdvancedSource,
  onShowAdvancedSource,
  onUpdateDraft,
  onUpdateTemplate
}: {
  draft: WorkspaceCreateInput;
  showAdvancedSource: boolean;
  onShowAdvancedSource: (value: boolean) => void;
  onUpdateDraft: (next: Partial<WorkspaceCreateInput>) => void;
  onUpdateTemplate: (template: WorkspaceTemplate) => void;
}) {
  const sourceMode = draft.sourceMode ?? "empty";
  const template = draft.template ?? "software";

  return (
    <>
      <SectionIntro
        eyebrow="Step 1"
        title="Define the workspace"
        description="Collect only the inputs that shape the scaffold. Everything else gets good defaults."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <FieldBlock label="Workspace name" htmlFor="workspace-name">
          <Input
            id="workspace-name"
            value={draft.name}
            onChange={(event) => onUpdateDraft({ name: event.target.value })}
            placeholder="AgentOS launch lane"
          />
        </FieldBlock>

        <FieldBlock label="What are you building?" htmlFor="workspace-brief">
          <Textarea
            id="workspace-brief"
            value={draft.brief ?? ""}
            onChange={(event) => onUpdateDraft({ brief: event.target.value })}
            placeholder="A short brief, goal, or project framing for the agents"
            className="min-h-[88px]"
          />
        </FieldBlock>
      </div>

      <div className="space-y-3">
        <SectionLabel>Start from</SectionLabel>
        <div className="grid gap-3 lg:grid-cols-3">
          {WORKSPACE_SOURCE_OPTIONS.map((option) => (
            <SelectableCard
              key={option.value}
              title={option.label}
              description={option.description}
              selected={sourceMode === option.value}
              onClick={() => onUpdateDraft({ sourceMode: option.value })}
              icon={option.value === "clone" ? GitBranch : FolderGit2}
            />
          ))}
        </div>
      </div>

      {sourceMode === "clone" ? (
        <FieldBlock label="Repository URL" htmlFor="workspace-repo-url">
          <Input
            id="workspace-repo-url"
            value={draft.repoUrl ?? ""}
            onChange={(event) => onUpdateDraft({ repoUrl: event.target.value })}
            placeholder="https://github.com/org/repo.git"
          />
        </FieldBlock>
      ) : null}

      {sourceMode === "existing" ? (
        <FieldBlock label="Existing folder" htmlFor="workspace-existing-path">
          <Input
            id="workspace-existing-path"
            value={draft.existingPath ?? ""}
            onChange={(event) => onUpdateDraft({ existingPath: event.target.value })}
            placeholder="/absolute/path/to/existing/workspace"
          />
        </FieldBlock>
      ) : null}

      {sourceMode !== "existing" ? (
        <div className="rounded-[18px] border border-white/10 bg-white/[0.02] p-3">
          <button
            type="button"
            className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400"
            onClick={() => onShowAdvancedSource(!showAdvancedSource)}
          >
            {showAdvancedSource ? "Hide advanced path controls" : "Show advanced path controls"}
          </button>

          {showAdvancedSource ? (
            <div className="mt-3">
              <FieldBlock label="Directory override" htmlFor="workspace-directory">
                <Input
                  id="workspace-directory"
                  value={draft.directory ?? ""}
                  onChange={(event) => onUpdateDraft({ directory: event.target.value })}
                  placeholder="Optional absolute path or custom folder name"
                />
              </FieldBlock>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <SectionLabel>Template</SectionLabel>
        <div className="grid gap-3 lg:grid-cols-2">
          {WORKSPACE_TEMPLATE_OPTIONS.map((option) => (
            <SelectableCard
              key={option.value}
              title={option.label}
              description={option.description}
              selected={template === option.value}
              onClick={() => onUpdateTemplate(option.value)}
              icon={Sparkles}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function TeamStep({
  draft,
  snapshot,
  teamPreset,
  modelProfile,
  agents,
  enabledAgents,
  onUpdateDraft,
  onUpdateTeamPreset,
  onUpdateAgent
}: {
  draft: WorkspaceCreateInput;
  snapshot: MissionControlSnapshot;
  teamPreset: WorkspaceTeamPreset;
  modelProfile: WorkspaceModelProfile;
  agents: WorkspaceAgentBlueprintInput[];
  enabledAgents: WorkspaceAgentBlueprintInput[];
  onUpdateDraft: (next: Partial<WorkspaceCreateInput>) => void;
  onUpdateTeamPreset: (teamPreset: WorkspaceTeamPreset) => void;
  onUpdateAgent: (index: number, next: Partial<WorkspaceAgentBlueprintInput>) => void;
}) {
  return (
    <>
      <SectionIntro
        eyebrow="Step 2"
        title="Shape the team"
        description="Pick a team preset, set the base model, and optionally fine-tune specialist agents."
      />

      <div className="space-y-3">
        <SectionLabel>Team preset</SectionLabel>
        <div className="grid gap-3 lg:grid-cols-3">
          {WORKSPACE_TEAM_PRESET_OPTIONS.map((option) => (
            <SelectableCard
              key={option.value}
              title={option.label}
              description={option.description}
              selected={teamPreset === option.value}
              onClick={() => onUpdateTeamPreset(option.value)}
              icon={Sparkles}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <FieldBlock label="Base model" htmlFor="workspace-model">
          <select
            id="workspace-model"
            value={draft.modelId ?? ""}
            onChange={(event) => onUpdateDraft({ modelId: event.target.value || undefined })}
            className="flex h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none"
          >
            <option value="">Use OpenClaw default</option>
            {snapshot.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.id}
              </option>
            ))}
          </select>
        </FieldBlock>

        <div className="space-y-3">
          <SectionLabel>Model profile</SectionLabel>
          <div className="grid gap-3 lg:grid-cols-3">
            {WORKSPACE_MODEL_PROFILE_OPTIONS.map((option) => (
              <SelectableCard
                key={option.value}
                title={option.label}
                description={option.description}
                selected={modelProfile === option.value}
                onClick={() => onUpdateDraft({ modelProfile: option.value })}
                icon={Sparkles}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Specialist agents</p>
            <p className="mt-1 text-sm text-slate-300">
              {enabledAgents.length} agent{enabledAgents.length === 1 ? "" : "s"} will be created.
            </p>
          </div>
          {teamPreset === "custom" ? <Badge variant="warning">Custom editing</Badge> : <Badge variant="muted">Preset locked</Badge>}
        </div>

        <div className="mt-4 grid gap-3">
          {agents.map((agent, index) => (
            <div
              key={`${agent.id}-${index}`}
              className={cn(
                "rounded-[18px] border px-3 py-3",
                agent.enabled ? "border-white/10 bg-white/[0.04]" : "border-white/5 bg-transparent opacity-70"
              )}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{agent.role}</p>
                    {agent.isPrimary ? <Badge variant="default">Primary</Badge> : null}
                    {agent.skillId ? <Badge variant="muted">{agent.skillId}</Badge> : null}
                  </div>
                  <p className="text-xs text-slate-400">
                    {agent.theme ? `${agent.theme} theme` : "No explicit theme"}{agent.emoji ? ` · ${agent.emoji}` : ""}
                  </p>
                </div>

                {teamPreset === "custom" ? (
                  <div className="grid gap-3 lg:w-[420px] lg:grid-cols-[120px,minmax(0,1fr),minmax(0,1fr)]">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={agent.enabled}
                        onChange={(event) => onUpdateAgent(index, { enabled: event.target.checked })}
                        className="h-4 w-4 rounded border-white/15 bg-white/5"
                      />
                      Enabled
                    </label>
                    <Input
                      value={agent.name}
                      onChange={(event) => onUpdateAgent(index, { name: event.target.value })}
                      placeholder="Agent name"
                    />
                    <select
                      value={agent.modelId ?? ""}
                      onChange={(event) =>
                        onUpdateAgent(index, {
                          modelId: event.target.value || undefined
                        })
                      }
                      className="flex h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none"
                    >
                      <option value="">Use base model</option>
                      {snapshot.models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.id}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant={agent.isPrimary ? "default" : "secondary"}
                      size="sm"
                      className="lg:col-span-3 lg:justify-start"
                      onClick={() => onUpdateAgent(index, { isPrimary: true, enabled: true })}
                    >
                      Mark as primary
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function RulesStep({
  rules,
  scaffoldFiles,
  scaffoldFolders,
  onUpdateRule
}: {
  rules: typeof DEFAULT_WORKSPACE_RULES;
  scaffoldFiles: string[];
  scaffoldFolders: string[];
  onUpdateRule: (ruleKey: keyof typeof DEFAULT_WORKSPACE_RULES, value: boolean) => void;
}) {
  return (
    <>
      <SectionIntro
        eyebrow="Step 3"
        title="Choose the guardrails"
        description="These defaults shape how much context and automation the workspace gets from day one."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <RuleCard
          label="Workspace-only file access"
          description="Configure created agents with fs.workspaceOnly so file work stays grounded in this workspace."
          checked={rules.workspaceOnly}
          onCheckedChange={(value) => onUpdateRule("workspaceOnly", value)}
        />
        <RuleCard
          label="Generate starter docs"
          description="Create docs, deliverables, and template-specific reference files to reduce first-task friction."
          checked={rules.generateStarterDocs}
          onCheckedChange={(value) => onUpdateRule("generateStarterDocs", value)}
        />
        <RuleCard
          label="Generate memory system"
          description="Create MEMORY.md plus durable blueprint and decisions files for cross-session continuity."
          checked={rules.generateMemory}
          onCheckedChange={(value) => onUpdateRule("generateMemory", value)}
        />
        <RuleCard
          label="Run kickoff mission after create"
          description="Ask the primary agent to inspect the new workspace and refine the starter scaffold."
          checked={rules.kickoffMission}
          onCheckedChange={(value) => onUpdateRule("kickoffMission", value)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PreviewList
          title="Folders"
          items={scaffoldFolders}
          badge={`${scaffoldFolders.length}`}
        />
        <PreviewList
          title="Files"
          items={scaffoldFiles}
          badge={`${scaffoldFiles.length}`}
        />
      </div>
    </>
  );
}

function ReviewStep({
  draft,
  agents,
  rules,
  scaffoldFiles,
  scaffoldFolders
}: {
  draft: WorkspaceCreateInput;
  agents: WorkspaceAgentBlueprintInput[];
  rules: typeof DEFAULT_WORKSPACE_RULES;
  scaffoldFiles: string[];
  scaffoldFolders: string[];
}) {
  const enabledAgents = agents.filter((agent) => agent.enabled);

  return (
    <>
      <SectionIntro
        eyebrow="Step 4"
        title="Review the bootstrap"
        description="This is the exact shape of the workspace that will be created."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <SummaryCard title="Workspace" value={draft.name?.trim() || "Untitled workspace"}>
          <p>{workspacePathPreview(draft.name, draft.directory, draft.sourceMode ?? "empty", draft.existingPath)}</p>
          <p>Template: {draft.template ?? "software"}</p>
          <p>Source: {draft.sourceMode ?? "empty"}</p>
        </SummaryCard>
        <SummaryCard title="Runtime defaults" value={draft.modelId || "OpenClaw default model"}>
          <p>Model profile: {draft.modelProfile ?? "balanced"}</p>
          <p>Kickoff mission: {rules.kickoffMission ? "enabled" : "disabled"}</p>
          <p>Workspace-only tools: {rules.workspaceOnly ? "enabled" : "disabled"}</p>
        </SummaryCard>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-white">Agents to create</p>
          <Badge variant="default">{enabledAgents.length}</Badge>
        </div>
        <div className="mt-4 grid gap-3">
          {enabledAgents.map((agent) => (
            <div key={`${agent.id}-${agent.name}`} className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{agent.name}</p>
                  <p className="text-xs text-slate-400">
                    {agent.role}
                    {agent.skillId ? ` · ${agent.skillId}` : ""}
                    {agent.modelId ? ` · ${agent.modelId}` : ""}
                  </p>
                </div>
                {agent.isPrimary ? <Badge variant="success">Primary</Badge> : <Badge variant="muted">Specialist</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PreviewList title="Folders" items={scaffoldFolders} badge={`${scaffoldFolders.length}`} />
        <PreviewList title="Files" items={scaffoldFiles} badge={`${scaffoldFiles.length}`} />
      </div>
    </>
  );
}

function SelectableCard({
  title,
  description,
  selected,
  onClick,
  icon: Icon
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  icon: typeof Sparkles;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[20px] border p-4 text-left transition-colors",
        selected
          ? "border-cyan-300/30 bg-cyan-400/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full border",
            selected
              ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
              : "border-white/10 bg-slate-950/60 text-slate-300"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="space-y-1">
          <span className="block text-sm font-medium text-white">{title}</span>
          <span className="block text-xs leading-5 text-slate-400">{description}</span>
        </span>
      </div>
    </button>
  );
}

function RuleCard({
  label,
  description,
  checked,
  onCheckedChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "rounded-[20px] border p-4 text-left transition-colors",
        checked ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border",
            checked ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-slate-950/60 text-transparent"
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
        <span className="space-y-1">
          <span className="block text-sm font-medium text-white">{label}</span>
          <span className="block text-xs leading-5 text-slate-400">{description}</span>
        </span>
      </div>
    </button>
  );
}

function PreviewList({
  title,
  items,
  badge
}: {
  title: string;
  items: string[];
  badge: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">{title}</p>
        <Badge variant="muted">{badge}</Badge>
      </div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item} className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs text-slate-300">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  children
}: {
  title: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{title}</p>
      <p className="mt-2 font-display text-lg text-white">{value}</p>
      <div className="mt-3 space-y-1 text-sm text-slate-400">{children}</div>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
      <h3 className="mt-2 font-display text-2xl text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
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
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{children}</p>;
}

function validateStep(
  step: WizardStepIndex,
  params: {
    draft: WorkspaceCreateInput;
    enabledAgentsCount: number;
  }
) {
  const namePresent = params.draft.name?.trim().length > 0;

  if (!namePresent) {
    return false;
  }

  if ((params.draft.sourceMode ?? "empty") === "clone" && !params.draft.repoUrl?.trim()) {
    return false;
  }

  if ((params.draft.sourceMode ?? "empty") === "existing" && !params.draft.existingPath?.trim()) {
    return false;
  }

  if (step >= 1 && params.enabledAgentsCount === 0) {
    return false;
  }

  return true;
}

function createInitialDraft(): WorkspaceCreateInput {
  return {
    name: "",
    brief: "",
    sourceMode: "empty",
    template: "software",
    teamPreset: "core",
    modelProfile: "balanced",
    rules: { ...DEFAULT_WORKSPACE_RULES },
    agents: buildDefaultWorkspaceAgents("software", "core")
  };
}

function workspacePathPreview(
  name: string | undefined,
  directory: string | undefined,
  sourceMode: WorkspaceSourceMode,
  existingPath: string | undefined
) {
  if (sourceMode === "existing") {
    return existingPath?.trim() || "Existing folder path will be used";
  }

  if (directory?.trim()) {
    return directory.trim();
  }

  const slug = (name || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `~/Documents/Shared/projects/${slug || "workspace"}`;
}
