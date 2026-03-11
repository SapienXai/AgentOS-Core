"use client";

import { Bot, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkspaceWizardMode } from "@/hooks/use-workspace-wizard-draft";

type SurfaceTheme = "dark" | "light";

type HeaderBadge = {
  id: string;
  label: string;
  tone?: "muted" | "success" | "warning" | "danger";
};

type WorkspaceWizardHeaderProps = {
  surfaceTheme: SurfaceTheme;
  mode: WorkspaceWizardMode;
  onModeChange: (mode: WorkspaceWizardMode) => void;
  onNewDraft: () => void | Promise<void>;
  badges: HeaderBadge[];
};

export function WorkspaceWizardHeader({
  surfaceTheme,
  mode,
  onModeChange,
  onNewDraft,
  badges
}: WorkspaceWizardHeaderProps) {
  const isLight = surfaceTheme === "light";

  return (
    <div
      className={cn(
        "relative z-[1] border-b px-4 py-3 md:px-5",
        isLight
          ? "border-[#e7e1d8] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,237,0.94))]"
          : "border-white/10 bg-[linear-gradient(180deg,rgba(10,16,29,0.96),rgba(6,11,21,0.94))]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center rounded-full border shadow-[0_8px_24px_rgba(56,47,38,0.08)]",
                isLight
                  ? "border-[#e3ddd4] bg-white text-[#4c4640]"
                  : "border-white/10 bg-white/[0.05] text-slate-200 shadow-[0_16px_36px_rgba(0,0,0,0.28)]"
              )}
            >
              <Bot className="h-4 w-4" />
            </span>

            <div className="min-w-0">
              <p className={cn("text-[11px] uppercase tracking-[0.22em]", isLight ? "text-[#7f6554]" : "text-slate-500")}>
                Architect
              </p>
              <h2
                className={cn(
                  "truncate text-[18px] font-semibold tracking-[-0.02em]",
                  isLight ? "text-[#2d2118]" : "text-white"
                )}
              >
                Create workspace
              </h2>
              <p className={cn("text-[13px]", isLight ? "text-[#604c3f]" : "text-slate-300")}>
                One wizard, two depths. Basic stays fast; Advanced keeps the same draft and design language.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              "inline-flex rounded-full border p-1",
              isLight ? "border-[#e4ddd3] bg-[#f4efe7]" : "border-white/10 bg-white/[0.04]"
            )}
          >
            <ModeButton
              surfaceTheme={surfaceTheme}
              active={mode === "basic"}
              label="Basic"
              onClick={() => onModeChange("basic")}
            />
            <ModeButton
              surfaceTheme={surfaceTheme}
              active={mode === "advanced"}
              label="Advanced"
              onClick={() => onModeChange("advanced")}
            />
          </div>

          <button
            type="button"
            onClick={onNewDraft}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] transition-colors",
              isLight
                ? "border-[#dfd8ce] bg-white text-[#38322d] hover:bg-[#f5f1ea]"
                : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            New draft
          </button>
        </div>
      </div>

      {badges.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {badges.map((badge) => (
            <span
              key={badge.id}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em]",
                badge.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                badge.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
                badge.tone === "danger" && "border-rose-200 bg-rose-50 text-rose-700",
                (!badge.tone || badge.tone === "muted") &&
                  (isLight
                    ? "border-[#e4ddd3] bg-white text-[#5f5348]"
                    : "border-white/10 bg-white/[0.05] text-slate-300")
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ModeButton({
  surfaceTheme,
  active,
  label,
  onClick
}: {
  surfaceTheme: SurfaceTheme;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const isLight = surfaceTheme === "light";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-w-[92px] items-center justify-center rounded-full px-3 py-1.5 text-[13px] transition-colors",
        active
          ? isLight
            ? "bg-white text-[#151310] shadow-sm"
            : "bg-[#0f1726] text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)]"
          : isLight
            ? "text-[#6d584a] hover:text-[#2d2824]"
            : "text-slate-400 hover:text-slate-100"
      )}
    >
      {label}
    </button>
  );
}
