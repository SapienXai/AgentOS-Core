import {
  createPlannerContextSource,
  createPlannerMessage,
  enrichWorkspacePlan
} from "@/lib/openclaw/planner-core";
import type { WorkspacePlan, WorkspaceCreateInput } from "@/lib/openclaw/types";
import { DEFAULT_WORKSPACE_RULES } from "@/lib/openclaw/workspace-presets";
import {
  analyzeWorkspaceWizardSourceInput,
  inferWorkspaceWizardTemplate,
  resolveWorkspaceWizardName,
  type WorkspaceWizardBasicDraft
} from "@/lib/openclaw/workspace-wizard-inference";

const basicSourceId = "workspace-wizard-basic-source";
const basicImportPrefix = "Imported quick setup assumptions:";

export const quickCreateRules = {
  ...DEFAULT_WORKSPACE_RULES,
  workspaceOnly: true,
  generateStarterDocs: true,
  generateMemory: true,
  kickoffMission: true
} satisfies NonNullable<WorkspaceCreateInput["rules"]>;

export function applyBasicInputToWorkspacePlan(
  plan: WorkspacePlan,
  draft: WorkspaceWizardBasicDraft
) {
  const next = structuredClone(plan);
  const sourceAnalysis = analyzeWorkspaceWizardSourceInput(draft.source);
  const resolvedName = resolveWorkspaceWizardName(draft);
  const goal = draft.goal.trim();

  next.intake.mode = next.intake.mode || "guided";
  next.intake.started = Boolean(goal || draft.source.trim());

  if (goal) {
    if (!next.intake.initialPrompt) {
      next.intake.initialPrompt = goal;
    }

    next.intake.latestPrompt = goal;
    next.company.mission = goal;

    if (!next.product.offer.trim()) {
      next.product.offer = goal;
    }
  }

  next.workspace.name = resolvedName;
  next.workspace.sourceMode = sourceAnalysis.createSourceMode;
  next.workspace.repoUrl = sourceAnalysis.repoUrl;
  next.workspace.existingPath = sourceAnalysis.existingPath;
  next.workspace.template = inferWorkspaceWizardTemplate(`${goal}\n${draft.source}`);
  next.workspace.modelProfile = next.workspace.modelProfile || "balanced";

  next.intake.sources = next.intake.sources.filter((source) => source.id !== basicSourceId);

  if (sourceAnalysis.kind !== "empty") {
    next.intake.sources.unshift(
      createPlannerContextSource({
        id: basicSourceId,
        kind:
          sourceAnalysis.kind === "clone"
            ? "repo"
            : sourceAnalysis.kind === "existing"
              ? "folder"
              : sourceAnalysis.kind === "website"
                ? "website"
                : "prompt",
        label: sourceAnalysis.label,
        summary: sourceAnalysis.hint,
        details: [sourceAnalysis.hint],
        url: sourceAnalysis.repoUrl ?? sourceAnalysis.websiteUrl
      })
    );
  }

  return enrichWorkspacePlan(next);
}

export function appendBasicModeImportNote(plan: WorkspacePlan, draft: WorkspaceWizardBasicDraft) {
  const next = structuredClone(plan);
  const goal = draft.goal.trim();
  const source = draft.source.trim();

  next.conversation = next.conversation.filter(
    (message) => !(message.role === "system" && message.author === "Workspace Wizard" && message.text.startsWith(basicImportPrefix))
  );

  if (!goal && !source) {
    return enrichWorkspacePlan(next);
  }

  const segments = [
    goal ? `goal: ${goal}` : null,
    source ? `source: ${source}` : null,
    `fast-path name: ${resolveWorkspaceWizardName(draft)}`
  ].filter(Boolean);

  next.conversation.push(
    createPlannerMessage(
      "system",
      "Workspace Wizard",
      `${basicImportPrefix} ${segments.join(" · ")}`
    )
  );

  return enrichWorkspacePlan(next);
}

export function buildWorkspaceCreateInputFromPlan(plan: WorkspacePlan): WorkspaceCreateInput {
  return {
    name: plan.workspace.name,
    brief: buildWorkspaceCreateBriefFromPlan(plan),
    directory: plan.workspace.directory,
    modelId: plan.workspace.modelId,
    sourceMode: plan.workspace.sourceMode,
    repoUrl: plan.workspace.repoUrl,
    existingPath: plan.workspace.existingPath,
    template: plan.workspace.template,
    teamPreset: "solo",
    modelProfile: plan.workspace.modelProfile || "balanced",
    rules: quickCreateRules
  };
}

export function buildWorkspaceCreateBriefFromPlan(plan: WorkspacePlan) {
  const lines = [
    plan.company.mission.trim() || plan.product.offer.trim(),
    plan.company.name.trim() ? `Company: ${plan.company.name.trim()}` : null,
    plan.product.scopeV1.length > 0 ? `Scope: ${plan.product.scopeV1.join(", ")}` : null,
    ...plan.intake.sources.flatMap((source) => {
      if (source.id !== basicSourceId) {
        return [];
      }

      if (source.kind === "repo" && source.url) {
        return [`Bootstrap source: clone ${source.url}`];
      }

      if (source.kind === "folder") {
        return [`Bootstrap source: existing folder ${source.summary}`];
      }

      if (source.kind === "website" && source.url) {
        return [`Reference website: ${source.url}`];
      }

      if (source.kind === "prompt") {
        return [`Additional context: ${source.summary}`];
      }

      return [];
    })
  ];

  return lines.filter((value): value is string => Boolean(value?.trim())).join("\n");
}

export function hasAdvancedWorkspaceDetails(plan: WorkspacePlan | null) {
  if (!plan) {
    return false;
  }

  return (
    plan.team.persistentAgents.filter((agent) => agent.enabled).length > 1 ||
    plan.operations.workflows.some((workflow) => workflow.enabled) ||
    plan.operations.automations.some((automation) => automation.enabled) ||
    plan.operations.channels.some((channel) => channel.enabled && channel.type !== "internal") ||
    plan.operations.hooks.some((hook) => hook.enabled)
  );
}
