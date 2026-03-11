"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Bot, FolderOpen, GitBranch, Globe, Rocket, Sparkles } from "lucide-react";

import { OperationProgress } from "@/components/mission-control/operation-progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WorkspaceWizardMode } from "@/hooks/use-workspace-wizard-draft";
import {
  getPlannerSectionForStage,
  getPlannerSectionHealth,
  plannerSectionMeta,
  summarizePlannerSection,
  type PlannerSectionId
} from "@/lib/openclaw/planner-presenters";
import type { MissionControlSnapshot, OperationProgressSnapshot, WorkspacePlan, WorkspaceTemplate } from "@/lib/openclaw/types";
import { WORKSPACE_TEMPLATE_OPTIONS } from "@/lib/openclaw/workspace-presets";
import type { WorkspaceWizardSourceAnalysis } from "@/lib/openclaw/workspace-wizard-inference";
import { cn } from "@/lib/utils";

type SurfaceTheme = "dark" | "light";

const templateLabels = Object.fromEntries(
  WORKSPACE_TEMPLATE_OPTIONS.map((option) => [option.value, option.label])
) as Record<WorkspaceTemplate, string>;

type WorkspaceWizardNotice = {
  tone: "muted" | "warning";
  title: string;
  description: string;
};

type DraftSectionKey =
  | "notice"
  | "progress"
  | "architect-readout"
  | "name"
  | "source"
  | "template"
  | "path"
  | "defaults"
  | "readiness"
  | "deploy-review"
  | `section-${PlannerSectionId}`;

type WorkspaceWizardDraftPaneProps = {
  className?: string;
  surfaceTheme: SurfaceTheme;
  mode: WorkspaceWizardMode;
  snapshot: MissionControlSnapshot;
  plan: WorkspacePlan | null;
  resolvedName: string;
  resolvedTemplate: WorkspaceTemplate;
  sourceAnalysis: WorkspaceWizardSourceAnalysis;
  workspacePath: string;
  notice: WorkspaceWizardNotice | null;
  progress: OperationProgressSnapshot | null;
};

export function WorkspaceWizardDraftPane({
  className,
  surfaceTheme,
  mode,
  snapshot,
  plan,
  resolvedName,
  resolvedTemplate,
  sourceAnalysis,
  workspacePath,
  notice,
  progress
}: WorkspaceWizardDraftPaneProps) {
  const isLight = surfaceTheme === "light";
  const sectionRefs = useRef<Partial<Record<DraftSectionKey, HTMLDivElement | null>>>({});
  const previousSnapshotRef = useRef<TrackedDraftSnapshot | null>(null);
  const [activeSection, setActiveSection] = useState<DraftSectionKey | null>(null);
  const trackedSnapshot = useMemo(
    () =>
      buildTrackedDraftSnapshot({
        mode,
        plan,
        notice,
        progress,
        resolvedName,
        resolvedTemplate,
        sourceAnalysis,
        workspacePath
      }),
    [mode, notice, plan, progress, resolvedName, resolvedTemplate, sourceAnalysis, workspacePath]
  );

  useEffect(() => {
    const previousSnapshot = previousSnapshotRef.current;
    previousSnapshotRef.current = trackedSnapshot;

    if (!previousSnapshot) {
      return;
    }

    const nextActiveSection = resolveTrackedDraftSection(previousSnapshot, trackedSnapshot);

    if (!nextActiveSection) {
      return;
    }

    setActiveSection(nextActiveSection);
  }, [trackedSnapshot]);

  useEffect(() => {
    if (!activeSection) {
      return;
    }

    const target = sectionRefs.current[activeSection];

    if (target) {
      globalThis.requestAnimationFrame(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      });
    }

    const timeout = globalThis.setTimeout(() => {
      setActiveSection((current) => (current === activeSection ? null : current));
    }, 2200);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [activeSection]);

  return (
    <aside
      className={cn(
        "min-h-0 border-t lg:border-l lg:border-t-0",
        isLight ? "border-[#ebe5dd] bg-[#f7f2eb]" : "border-white/10 bg-[rgba(5,9,18,0.92)]",
        className
      )}
    >
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4 md:p-5">
          <PaneHeader
            surfaceTheme={surfaceTheme}
            title={mode === "basic" ? "Workspace draft" : "Workspace blueprint"}
            subtitle={
              mode === "basic"
                ? "Architect is filling this live while the fast create path stays available."
                : "Live structured view of what Architect is shaping through conversation."
            }
          />

          {notice ? (
            <TrackedSection
              sectionKey="notice"
              activeSection={activeSection}
              surfaceTheme={surfaceTheme}
              register={(node) => {
                sectionRefs.current.notice = node;
              }}
            >
              <div
                className={cn(
                  "rounded-[18px] border px-4 py-3",
                  notice.tone === "warning"
                    ? isLight
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                    : isLight
                      ? "border-[#e3ddd4] bg-white text-[#3f3933]"
                      : "border-white/10 bg-white/[0.04] text-slate-200"
                )}
              >
                <p className={cn("text-[11px] uppercase tracking-[0.18em]", isLight ? "text-[#9c9389]" : "text-slate-500")}>
                  {notice.title}
                </p>
                <p className="mt-1 text-[13px] leading-6">{notice.description}</p>
              </div>
            </TrackedSection>
          ) : null}

          {progress ? (
            <TrackedSection
              sectionKey="progress"
              activeSection={activeSection}
              surfaceTheme={surfaceTheme}
              register={(node) => {
                sectionRefs.current.progress = node;
              }}
            >
              <OperationProgress
                progress={progress}
                className={cn(
                  isLight
                    ? "border-[#e5ded3] bg-white text-slate-900 [&_p]:text-inherit"
                    : "border-white/10 bg-slate-950/50"
                )}
              />
            </TrackedSection>
          ) : null}

          {mode === "basic" ? (
            <div className="space-y-3">
              {plan ? (
                <TrackedSection
                  sectionKey="architect-readout"
                  activeSection={activeSection}
                  surfaceTheme={surfaceTheme}
                  register={(node) => {
                    sectionRefs.current["architect-readout"] = node;
                  }}
                >
                  <div
                    className={cn(
                      "rounded-[22px] border p-4",
                      isLight ? "border-[#e5ddd2] bg-white" : "border-white/10 bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center rounded-full border",
                          isLight
                            ? "border-[#e7e0d6] bg-[#faf6f1] text-[#5e5750]"
                            : "border-white/10 bg-white/[0.05] text-slate-300"
                        )}
                      >
                        <Bot className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[11px] uppercase tracking-[0.18em]", isLight ? "text-[#a0978b]" : "text-slate-500")}>
                          Architect readout
                        </p>
                        <p className={cn("mt-1 text-[13px] leading-6", isLight ? "text-[#171410]" : "text-white")}>
                          {plan.architectSummary}
                        </p>

                        {plan.intake.confirmations.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            <p className={cn("text-[11px] uppercase tracking-[0.16em]", isLight ? "text-[#8d8276]" : "text-slate-500")}>
                              Next decisions
                            </p>
                            {plan.intake.confirmations.slice(0, 2).map((item) => (
                              <div
                                key={item}
                                className={cn(
                                  "rounded-[16px] border px-3 py-2 text-[12px] leading-5",
                                  isLight ? "border-[#e8e0d6] bg-[#faf6f1] text-[#5d554d]" : "border-white/10 bg-white/[0.05] text-slate-300"
                                )}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </TrackedSection>
              ) : null}

              <TrackedSection sectionKey="name" activeSection={activeSection} surfaceTheme={surfaceTheme} register={(node) => {
                sectionRefs.current.name = node;
              }}>
                <DraftCard
                  surfaceTheme={surfaceTheme}
                  icon={Sparkles}
                  title="Name"
                  value={resolvedName}
                  subtitle={plan ? "Updated from Architect's latest read of the conversation." : "Resolved from your quick setup."}
                />
              </TrackedSection>
              <TrackedSection sectionKey="source" activeSection={activeSection} surfaceTheme={surfaceTheme} register={(node) => {
                sectionRefs.current.source = node;
              }}>
                <DraftCard
                  surfaceTheme={surfaceTheme}
                  icon={sourceAnalysis.kind === "clone" ? GitBranch : sourceAnalysis.kind === "website" ? Globe : FolderOpen}
                  title="Source"
                  value={sourceAnalysis.label}
                  subtitle={plan ? "Source context Architect is currently using." : sourceAnalysis.hint}
                />
              </TrackedSection>
              <TrackedSection sectionKey="template" activeSection={activeSection} surfaceTheme={surfaceTheme} register={(node) => {
                sectionRefs.current.template = node;
              }}>
                <DraftCard
                  surfaceTheme={surfaceTheme}
                  icon={Sparkles}
                  title="Template"
                  value={templateLabels[resolvedTemplate]}
                  subtitle="Inferred from the live conversation and source context."
                />
              </TrackedSection>
              <TrackedSection sectionKey="path" activeSection={activeSection} surfaceTheme={surfaceTheme} register={(node) => {
                sectionRefs.current.path = node;
              }}>
                <DraftCard
                  surfaceTheme={surfaceTheme}
                  icon={FolderOpen}
                  title="Path"
                  value={workspacePath}
                  subtitle={`Root: ${snapshot.diagnostics.workspaceRoot}`}
                  mono
                />
              </TrackedSection>

              <TrackedSection sectionKey="defaults" activeSection={activeSection} surfaceTheme={surfaceTheme} register={(node) => {
                sectionRefs.current.defaults = node;
              }}>
                <div
                  className={cn(
                    "rounded-[22px] border p-4",
                    isLight ? "border-[#e5ddd2] bg-white" : "border-white/10 bg-white/[0.04]"
                  )}
                >
                  <p className={cn("text-[11px] uppercase tracking-[0.18em]", isLight ? "text-[#a0978b]" : "text-slate-500")}>
                    Fast-path defaults
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill surfaceTheme={surfaceTheme} label="Solo team" />
                    <Pill surfaceTheme={surfaceTheme} label="Balanced model" />
                    <Pill surfaceTheme={surfaceTheme} label="Kickoff mission" />
                  </div>
                  <p className={cn("mt-3 text-[13px] leading-6", isLight ? "text-[#70685f]" : "text-slate-300")}>
                    Need more control? Switch to Advanced and keep the same draft while Architect expands team, workflows, and deploy readiness.
                  </p>
                </div>
              </TrackedSection>
            </div>
          ) : plan ? (
            <div className="space-y-3">
              <TrackedSection sectionKey="readiness" activeSection={activeSection} surfaceTheme={surfaceTheme} register={(node) => {
                sectionRefs.current.readiness = node;
              }}>
                <div className={cn("rounded-[22px] border p-4", isLight ? "border-[#e5ddd2] bg-white" : "border-white/10 bg-white/[0.04]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={cn("text-[11px] uppercase tracking-[0.18em]", isLight ? "text-[#a0978b]" : "text-slate-500")}>Readiness</p>
                      <p className={cn("mt-1 text-[28px] font-semibold tracking-[-0.03em]", isLight ? "text-[#181612]" : "text-white")}>
                        {plan.readinessScore}%
                      </p>
                      <p className={cn("text-[13px] leading-6", isLight ? "text-[#6e665d]" : "text-slate-300")}>{plan.architectSummary}</p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex size-10 items-center justify-center rounded-full border",
                        isLight
                          ? "border-[#e5ddd2] bg-[#f5f0e8] text-[#6a635b]"
                          : "border-white/10 bg-white/[0.05] text-slate-300"
                      )}
                    >
                      <Bot className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </TrackedSection>

              {plannerSectionMeta.map((section) => {
                const health = getPlannerSectionHealth(plan, section.id);
                const Icon = section.icon;
                const sectionKey = `section-${section.id}` as const;

                return (
                  <TrackedSection
                    key={section.id}
                    sectionKey={sectionKey}
                    activeSection={activeSection}
                    surfaceTheme={surfaceTheme}
                    register={(node) => {
                      sectionRefs.current[sectionKey] = node;
                    }}
                  >
                    <div className={cn("rounded-[22px] border p-4", isLight ? "border-[#e5ddd2] bg-white" : "border-white/10 bg-white/[0.04]")}>
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "inline-flex size-9 shrink-0 items-center justify-center rounded-full border",
                            isLight
                              ? "border-[#e7e0d6] bg-[#faf6f1] text-[#5e5750]"
                              : "border-white/10 bg-white/[0.05] text-slate-300"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className={cn("text-[14px] font-semibold", isLight ? "text-[#171410]" : "text-white")}>{section.label}</p>
                            <StatusPill surfaceTheme={surfaceTheme} tone={health.variant} label={health.label} />
                          </div>
                          <p className={cn("mt-1 text-[13px] leading-6", isLight ? "text-[#70685f]" : "text-slate-300")}>
                            {summarizePlannerSection(plan, section.id)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </TrackedSection>
                );
              })}

              <TrackedSection sectionKey="deploy-review" activeSection={activeSection} surfaceTheme={surfaceTheme} register={(node) => {
                sectionRefs.current["deploy-review"] = node;
              }}>
                <div className={cn("rounded-[22px] border p-4", isLight ? "border-[#e5ddd2] bg-white" : "border-white/10 bg-white/[0.04]")}>
                  <div className="flex items-center gap-2">
                    <Rocket className={cn("h-4 w-4", isLight ? "text-[#5f5952]" : "text-slate-300")} />
                    <p className={cn("text-[14px] font-semibold", isLight ? "text-[#171410]" : "text-white")}>Deploy review</p>
                  </div>

                  {plan.deploy.blockers.length > 0 ? (
                    <ReadinessList
                      surfaceTheme={surfaceTheme}
                      title="Blockers"
                      tone="danger"
                      items={plan.deploy.blockers}
                    />
                  ) : null}

                  {plan.deploy.warnings.length > 0 ? (
                    <ReadinessList
                      surfaceTheme={surfaceTheme}
                      title="Warnings"
                      tone="warning"
                      items={plan.deploy.warnings}
                    />
                  ) : null}

                  {plan.deploy.blockers.length === 0 && plan.deploy.warnings.length === 0 ? (
                    <p className={cn("mt-3 text-[13px] leading-6", isLight ? "text-[#70685f]" : "text-slate-300")}>
                      Architect has not surfaced blockers or warnings yet. Request review when the blueprint feels directionally right.
                    </p>
                  ) : null}
                </div>
              </TrackedSection>
            </div>
          ) : (
            <div
              className={cn(
                "rounded-[22px] border border-dashed p-5",
                isLight ? "border-[#ddd5ca] bg-white/80" : "border-white/10 bg-white/[0.04]"
              )}
            >
              <p className={cn("text-[14px] font-medium", isLight ? "text-[#211d19]" : "text-white")}>Architect is preparing the blueprint.</p>
              <p className={cn("mt-1 text-[13px] leading-6", isLight ? "text-[#776f65]" : "text-slate-300")}>
                Once the first plan is ready, this pane will start reflecting the structured workspace draft.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

type TrackedDraftSnapshot = {
  mode: WorkspaceWizardMode;
  noticeSignature: string;
  progressSignature: string;
  basic: {
    architectSignature: string;
    nameSignature: string;
    sourceSignature: string;
    templateSignature: string;
    pathSignature: string;
  };
  advanced: {
    stage: WorkspacePlan["stage"] | null;
    readinessSignature: string;
    deploySignature: string;
    sectionSignatures: Record<PlannerSectionId, string>;
  };
};

function buildTrackedDraftSnapshot({
  mode,
  plan,
  notice,
  progress,
  resolvedName,
  resolvedTemplate,
  sourceAnalysis,
  workspacePath
}: Pick<
  WorkspaceWizardDraftPaneProps,
  "mode" | "plan" | "notice" | "progress" | "resolvedName" | "resolvedTemplate" | "sourceAnalysis" | "workspacePath"
>): TrackedDraftSnapshot {
  return {
    mode,
    noticeSignature: notice ? `${notice.tone}:${notice.title}:${notice.description}` : "",
    progressSignature: progress ? JSON.stringify(progress) : "",
    basic: {
      architectSignature: plan ? `${plan.architectSummary}:${plan.intake.confirmations.join("|")}` : "",
      nameSignature: resolvedName,
      sourceSignature: `${sourceAnalysis.kind}:${sourceAnalysis.label}:${sourceAnalysis.hint}:${sourceAnalysis.repoUrl ?? ""}:${sourceAnalysis.existingPath ?? ""}:${sourceAnalysis.websiteUrl ?? ""}`,
      templateSignature: resolvedTemplate,
      pathSignature: workspacePath
    },
    advanced: {
      stage: plan?.stage ?? null,
      readinessSignature: plan ? `${plan.readinessScore}:${plan.architectSummary}` : "",
      deploySignature: plan
        ? `${plan.intake.reviewRequested}:${plan.deploy.blockers.join("|")}:${plan.deploy.warnings.join("|")}`
        : "",
      sectionSignatures: Object.fromEntries(
        plannerSectionMeta.map((section) => [
          section.id,
          plan
            ? `${getPlannerSectionHealth(plan, section.id).label}:${getPlannerSectionHealth(plan, section.id).variant}:${summarizePlannerSection(plan, section.id)}`
            : ""
        ])
      ) as Record<PlannerSectionId, string>
    }
  };
}

function resolveTrackedDraftSection(
  previousSnapshot: TrackedDraftSnapshot,
  nextSnapshot: TrackedDraftSnapshot
): DraftSectionKey | null {
  if (previousSnapshot.mode !== nextSnapshot.mode) {
    return nextSnapshot.mode === "basic"
      ? nextSnapshot.basic.architectSignature
        ? "architect-readout"
        : "name"
      : nextSnapshot.advanced.stage
        ? (`section-${getPlannerSectionForStage(nextSnapshot.advanced.stage)}` as DraftSectionKey)
        : "readiness";
  }

  if (previousSnapshot.noticeSignature !== nextSnapshot.noticeSignature && nextSnapshot.noticeSignature) {
    return "notice";
  }

  if (previousSnapshot.progressSignature !== nextSnapshot.progressSignature && nextSnapshot.progressSignature) {
    return "progress";
  }

  if (nextSnapshot.mode === "basic") {
    if (
      previousSnapshot.basic.architectSignature !== nextSnapshot.basic.architectSignature &&
      nextSnapshot.basic.architectSignature
    ) {
      return "architect-readout";
    }

    if (previousSnapshot.basic.nameSignature !== nextSnapshot.basic.nameSignature) {
      return "name";
    }

    if (previousSnapshot.basic.sourceSignature !== nextSnapshot.basic.sourceSignature) {
      return "source";
    }

    if (previousSnapshot.basic.templateSignature !== nextSnapshot.basic.templateSignature) {
      return "template";
    }

    if (previousSnapshot.basic.pathSignature !== nextSnapshot.basic.pathSignature) {
      return "path";
    }

    return null;
  }

  if (previousSnapshot.advanced.deploySignature !== nextSnapshot.advanced.deploySignature && nextSnapshot.advanced.deploySignature) {
    return "deploy-review";
  }

  if (previousSnapshot.advanced.stage !== nextSnapshot.advanced.stage && nextSnapshot.advanced.stage) {
    return `section-${getPlannerSectionForStage(nextSnapshot.advanced.stage)}`;
  }

  if (
    previousSnapshot.advanced.readinessSignature !== nextSnapshot.advanced.readinessSignature &&
    nextSnapshot.advanced.readinessSignature
  ) {
    return "readiness";
  }

  for (const section of plannerSectionMeta) {
    if (previousSnapshot.advanced.sectionSignatures[section.id] !== nextSnapshot.advanced.sectionSignatures[section.id]) {
      return `section-${section.id}`;
    }
  }

  return null;
}

function TrackedSection({
  sectionKey,
  activeSection,
  surfaceTheme,
  register,
  children
}: {
  sectionKey: DraftSectionKey;
  activeSection: DraftSectionKey | null;
  surfaceTheme: SurfaceTheme;
  register: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  const isActive = activeSection === sectionKey;
  const isLight = surfaceTheme === "light";

  return (
    <div
      ref={register}
      className={cn(
        "scroll-mt-6 rounded-[26px] transition-all duration-500",
        isActive &&
          (isLight
            ? "ring-2 ring-[#d8b184]/70 shadow-[0_0_0_1px_rgba(216,177,132,0.18),0_18px_36px_rgba(102,78,47,0.16)]"
            : "ring-2 ring-cyan-300/45 shadow-[0_0_0_1px_rgba(103,232,249,0.14),0_18px_36px_rgba(6,182,212,0.16)]")
      )}
    >
      {children}
    </div>
  );
}

function PaneHeader({
  surfaceTheme,
  title,
  subtitle
}: {
  surfaceTheme: SurfaceTheme;
  title: string;
  subtitle: string;
}) {
  const isLight = surfaceTheme === "light";

  return (
    <div>
      <p className={cn("text-[11px] uppercase tracking-[0.18em]", isLight ? "text-[#8b7262]" : "text-slate-500")}>{title}</p>
      <p className={cn("mt-1 text-[13px] leading-6", isLight ? "text-[#705b4d]" : "text-slate-300")}>{subtitle}</p>
    </div>
  );
}

function DraftCard({
  surfaceTheme,
  icon: Icon,
  title,
  value,
  subtitle,
  mono = false
}: {
  surfaceTheme: SurfaceTheme;
  icon: typeof Sparkles;
  title: string;
  value: string;
  subtitle: string;
  mono?: boolean;
}) {
  const isLight = surfaceTheme === "light";

  return (
    <div className={cn("rounded-[22px] border p-4", isLight ? "border-[#e5ddd2] bg-white" : "border-white/10 bg-white/[0.04]")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full border",
            isLight ? "border-[#e7e0d6] bg-[#faf6f1] text-[#5e5750]" : "border-white/10 bg-white/[0.05] text-slate-300"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className={cn("text-[11px] uppercase tracking-[0.18em]", isLight ? "text-[#a0978b]" : "text-slate-500")}>{title}</p>
          <p
            className={cn(
              "mt-1 truncate text-[14px] font-medium",
              isLight ? "text-[#171410]" : "text-white",
              mono && "font-mono text-[12px]"
            )}
          >
            {value}
          </p>
          <p className={cn("mt-1 text-[12px] leading-5", isLight ? "text-[#776f65]" : "text-slate-400")}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function Pill({
  surfaceTheme,
  label
}: {
  surfaceTheme: SurfaceTheme;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em]",
        surfaceTheme === "light"
          ? "border-[#e4ddd3] bg-[#f6f1ea] text-[#6c645b]"
          : "border-white/10 bg-white/[0.05] text-slate-300"
      )}
    >
      {label}
    </span>
  );
}

function StatusPill({
  surfaceTheme,
  tone,
  label
}: {
  surfaceTheme: SurfaceTheme;
  tone: "muted" | "success" | "warning" | "danger";
  label: string;
}) {
  const isLight = surfaceTheme === "light";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]",
        tone === "muted" && (isLight ? "border-[#e4ddd3] bg-[#f7f2eb] text-[#746b61]" : "border-white/10 bg-white/[0.05] text-slate-300"),
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-700"
      )}
    >
      {label}
    </span>
  );
}

function ReadinessList({
  surfaceTheme,
  title,
  tone,
  items
}: {
  surfaceTheme: SurfaceTheme;
  title: string;
  tone: "warning" | "danger";
  items: string[];
}) {
  const isLight = surfaceTheme === "light";

  return (
    <div
      className={cn(
        "mt-3 rounded-[18px] border px-4 py-3",
        tone === "danger"
          ? isLight
            ? "border-rose-200 bg-rose-50"
            : "border-rose-400/25 bg-rose-400/10"
          : isLight
            ? "border-amber-200 bg-amber-50"
            : "border-amber-400/25 bg-amber-400/10"
      )}
    >
      <p className={cn("text-[11px] uppercase tracking-[0.18em]", isLight ? "text-[#9f958a]" : "text-slate-500")}>{title}</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item} className={cn("flex items-start gap-2 text-[13px] leading-6", isLight ? "text-[#403934]" : "text-slate-200")}>
            <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
