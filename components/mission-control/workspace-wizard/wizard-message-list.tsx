"use client";

import { Bot, Sparkles } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SurfaceTheme = "dark" | "light";

export type WizardMessageRecord = {
  id: string;
  role: "assistant" | "user" | "system";
  author?: string;
  text: string;
};

type WizardMessageListProps = {
  surfaceTheme: SurfaceTheme;
  messages: WizardMessageRecord[];
  emptyState?: ReactNode;
  auxiliary?: ReactNode;
  className?: string;
};

export function WizardMessageList({
  surfaceTheme,
  messages,
  emptyState,
  auxiliary,
  className
}: WizardMessageListProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      block: "end"
    });
  }, [messages]);

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 px-2 py-4 md:gap-6 md:px-4">
        {emptyState}
        {auxiliary}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} surfaceTheme={surfaceTheme} />
        ))}

        <div ref={endRef} className="h-6 w-full shrink-0" />
      </div>
    </ScrollArea>
  );
}

function MessageBubble({
  message,
  surfaceTheme
}: {
  message: WizardMessageRecord;
  surfaceTheme: SurfaceTheme;
}) {
  const isLight = surfaceTheme === "light";

  if (message.role === "system") {
    return (
      <div
        className={cn(
          "mx-auto w-full max-w-3xl rounded-[18px] border px-4 py-3 text-[13px] leading-6",
          isLight
            ? "border-[#e3ddd4] bg-[#f5f0e8] text-[#5b544d]"
            : "border-white/10 bg-white/[0.05] text-slate-300"
        )}
      >
        <p className={cn("text-[11px] uppercase tracking-[0.18em]", isLight ? "text-[#8b8074]" : "text-slate-500")}>
          {message.author || "Workspace Wizard"}
        </p>
        <p className="mt-1">{message.text}</p>
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full items-start gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser ? (
        <div
          className={cn(
            "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border",
            isLight
              ? "border-[#e6dfd4] bg-white text-[#5f5a53]"
              : "border-white/10 bg-white/[0.05] text-slate-300"
          )}
        >
          {message.author === "Architect" ? <Bot className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        </div>
      ) : null}

      <div
        className={cn(
          "max-w-[min(100%,720px)]",
          isUser
            ? isLight
              ? "rounded-[22px] bg-[#191714] px-4 py-2.5 text-white"
              : "rounded-[22px] bg-cyan-300 px-4 py-2.5 text-slate-950"
            : isLight
              ? "px-0 py-0 text-[#1b1815]"
              : "px-0 py-0 text-slate-100"
        )}
      >
        {!isUser && message.author ? (
          <p className={cn("mb-1 text-[11px] uppercase tracking-[0.18em]", isLight ? "text-[#8f857a]" : "text-slate-500")}>
            {message.author}
          </p>
        ) : null}
        <p className={cn("whitespace-pre-wrap text-[15px] leading-7", isUser && "leading-6")}>{message.text}</p>
      </div>
    </div>
  );
}
