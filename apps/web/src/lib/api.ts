import { fallbackDashboard } from "@/lib/fallback-data";
import type { ChatResponse, DashboardPayload } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  try {
    return await requestJson<DashboardPayload>("/api/dashboard");
  } catch {
    return fallbackDashboard;
  }
}

export async function syncCatalog(): Promise<DashboardPayload> {
  return requestJson<DashboardPayload>("/api/ingest/sync", { method: "POST", body: JSON.stringify({}) });
}

export async function askCatalog(question: string): Promise<ChatResponse> {
  try {
    return await requestJson<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  } catch {
    return {
      answer: "API에 연결되지 않아 샘플 데이터 기준으로만 표시 중입니다. 백엔드를 실행하면 문서 기반 응답으로 전환됩니다.",
      citations: fallbackDashboard.systems.slice(0, 2).map((system) => system.document_name),
      suggested_system_ids: fallbackDashboard.systems.slice(0, 2).map((system) => system.id),
    };
  }
}
