"use client";

import { ArrowUp, LoaderCircle } from "lucide-react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

type SurfaceTheme = "dark" | "light";

type WizardComposerProps = {
  surfaceTheme: SurfaceTheme;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  disabled?: boolean;
  isBusy?: boolean;
  helperText?: string;
  toolbar?: ReactNode;
  className?: string;
};

export function WizardComposer({
  surfaceTheme,
  value,
  placeholder,
  onChange,
  onSubmit,
  disabled = false,
  isBusy = false,
  helperText,
  toolbar,
  className
}: WizardComposerProps) {
  const canSubmit = Boolean(value.trim()) && !disabled;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    await onSubmit();
  };

  const handleKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    await onSubmit();
  };

  const isLight = surfaceTheme === "light";

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-[24px] border p-3",
        isLight
          ? "border-[#dfd9d1] bg-white shadow-[0_24px_80px_rgba(56,47,38,0.08)]"
          : "border-white/10 bg-[rgba(7,12,22,0.92)] shadow-[0_24px_80px_rgba(0,0,0,0.38)]",
        className
      )}
    >
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "min-h-[44px] max-h-[200px] w-full resize-none border-0 bg-transparent px-2 py-1 text-[15px] leading-6 outline-none",
          isLight ? "text-[#191714] placeholder:text-[#9b948c]" : "text-slate-100 placeholder:text-slate-500"
        )}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-h-8 items-center gap-2">
          {toolbar}
          {helperText ? (
            <p className={cn("text-[11px]", isLight ? "text-[#8b837a]" : "text-slate-400")}>{helperText}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed",
            isLight
              ? "bg-[#161514] text-white hover:bg-[#26231f] disabled:bg-[#d5cec5] disabled:text-[#8d857c]"
              : "bg-cyan-300 text-slate-950 hover:bg-cyan-200 disabled:bg-white/[0.08] disabled:text-slate-500"
          )}
        >
          {isBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
        </button>
      </div>
    </form>
  );
}
