import type { RuntimeRecord } from "@/lib/openclaw/types";

const missionRuntimeSlackMs = 1_500;

function normalizeMissionText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function matchesMissionText(candidate: string, mission: string) {
  const normalizedMission = normalizeMissionText(mission);
  const normalizedCandidate = normalizeMissionText(candidate);

  if (!normalizedMission || !normalizedCandidate) {
    return false;
  }

  return normalizedCandidate === normalizedMission || normalizedCandidate.startsWith(`${normalizedMission} `);
}

function extractRuntimeMissionText(runtime: RuntimeRecord) {
  const mission =
    typeof runtime.metadata.mission === "string"
      ? runtime.metadata.mission
      : typeof runtime.metadata.turnPrompt === "string"
        ? runtime.metadata.turnPrompt
        : null;

  if (!mission) {
    return null;
  }

  const normalized = normalizeMissionText(mission);
  return normalized.length > 0 ? normalized : null;
}

export function matchesMissionRuntime(
  runtime: RuntimeRecord,
  mission: string,
  options: {
    agentId?: string | null;
    submittedAt?: number | null;
  } = {}
) {
  if (options.agentId && runtime.agentId !== options.agentId) {
    return false;
  }

  if (typeof options.submittedAt === "number" && (runtime.updatedAt ?? 0) < options.submittedAt - missionRuntimeSlackMs) {
    return false;
  }

  const runtimeMission = extractRuntimeMissionText(runtime);

  if (!runtimeMission) {
    return false;
  }

  return matchesMissionText(runtimeMission, mission);
}
