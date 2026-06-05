"use client";

import { useDeferredValue, useState, useTransition } from "react";

import { ChatPanel } from "@/components/chat-panel";
import { syncCatalog } from "@/lib/api";
import type { DashboardPayload, RelationEdge, SystemCard } from "@/lib/types";

type CatalogDashboardProps = {
  initialData: DashboardPayload;
};

type RelationNode = {
  id: string;
  name: string;
  category: string;
};

function confidenceLabel(confidence: RelationEdge["confidence"]) {
  if (confidence === "high") return "검증";
  if (confidence === "medium") return "보정 필요";
  return "추론";
}

function buildRelationNodes(system: SystemCard, systems: SystemCard[], relations: RelationEdge[]) {
  const relatedEdges = relations.filter(
    (edge) => edge.source_id === system.id || edge.target_id === system.id,
  );

  const relatedNodes: RelationNode[] = [
    { id: system.id, name: system.name, category: system.category },
    ...relatedEdges.map((edge) => {
      const otherId = edge.source_id === system.id ? edge.target_id : edge.source_id;
      const target = systems.find((item) => item.id === otherId);
      return {
        id: otherId,
        name: target?.name ?? otherId,
        category: target?.category ?? "연계",
      };
    }),
  ];

  const uniqueNodes = Array.from(new Map(relatedNodes.map((node) => [node.id, node])).values());
  return { relatedEdges, uniqueNodes };
}

export function CatalogDashboard({ initialData }: CatalogDashboardProps) {
  const [dashboard, setDashboard] = useState(initialData);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedSystemId, setSelectedSystemId] = useState(initialData.systems[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const categories = [
    "전체",
    ...Array.from(new Set(dashboard.systems.map((system) => system.category))),
  ];

  const filteredSystems = dashboard.systems.filter((system) => {
    const matchesCategory = selectedCategory === "전체" || system.category === selectedCategory;
    const haystack = `${system.name} ${system.category} ${system.description} ${system.document_name}`.toLowerCase();
    const matchesQuery = haystack.includes(deferredQuery.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const selectedSystem =
    dashboard.systems.find((system) => system.id === selectedSystemId) ?? filteredSystems[0] ?? dashboard.systems[0];

  const relationGraph = selectedSystem
    ? buildRelationNodes(selectedSystem, dashboard.systems, dashboard.relations)
    : { relatedEdges: [], uniqueNodes: [] };

  const syncNow = () => {
    startTransition(async () => {
      const nextDashboard = await syncCatalog();
      setDashboard(nextDashboard);
      if (!nextDashboard.systems.find((system) => system.id === selectedSystemId)) {
        setSelectedSystemId(nextDashboard.systems[0]?.id ?? "");
      }
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-8 px-5 py-6 lg:px-8 lg:py-8">
      <section className="hero-grid overflow-hidden rounded-[36px] border border-white/60 p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.5fr_0.8fr] lg:items-end">
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 backdrop-blur">
              AI System Catalog MVP
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-6xl">
                운영매뉴얼을 받아 구조화하고, 바로 검색하고, 연관도까지 보여주는 카탈로그 앱
              </h1>
              <p className="max-w-3xl text-base leading-8 text-slate-700 lg:text-lg">
                docs 폴더의 운영매뉴얼을 동기화해 시스템 카드, 연관 그래프, 구성도, 챗봇 응답을 한 화면에서 확인합니다.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="glass-stat">
                <span className="glass-stat__label">동기화 문서</span>
                <strong className="glass-stat__value">{dashboard.source_count}</strong>
              </div>
              <div className="glass-stat">
                <span className="glass-stat__label">연계 엣지</span>
                <strong className="glass-stat__value">{dashboard.relations.length}</strong>
              </div>
              <div className="glass-stat">
                <span className="glass-stat__label">최근 동기화</span>
                <strong className="glass-stat__value text-lg">
                  {new Intl.DateTimeFormat("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(dashboard.synced_at))}
                </strong>
              </div>
            </div>
          </div>

          <div className="panel-surface space-y-4 p-5 lg:p-6">
            <p className="eyebrow">Sync Control</p>
            <h2 className="text-2xl font-semibold text-slate-950">문서 동기화</h2>
            <p className="text-sm leading-7 text-slate-600">
              FastAPI가 docs 폴더를 읽어 시스템 메타데이터를 재구성합니다. API가 꺼져 있으면 샘플 데이터가 유지됩니다.
            </p>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              onClick={syncNow}
              disabled={isPending}
            >
              {isPending ? "동기화 중..." : "docs 재동기화"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1.3fr_0.95fr]">
        <div className="panel-surface flex flex-col gap-5 p-5 lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Catalog Search</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">시스템 정보 조회</h2>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
              하이브리드 검색 준비
            </span>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="시스템명, 카테고리, 문서명으로 검색"
            className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedCategory === category
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-slate-950"
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="grid gap-3 overflow-y-auto pr-1 xl:max-h-[620px]">
            {filteredSystems.map((system) => (
              <button
                key={system.id}
                type="button"
                className={`rounded-[28px] border p-4 text-left transition ${
                  selectedSystem?.id === system.id
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
                    : "border-slate-200 bg-white text-slate-900 hover:border-slate-950"
                }`}
                onClick={() => setSelectedSystemId(system.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">{system.category}</p>
                    <h3 className="mt-2 text-lg font-semibold">{system.name}</h3>
                  </div>
                  <span className="rounded-full border border-current/20 px-3 py-1 text-xs">{system.criticality}</span>
                </div>
                <p className="mt-3 text-sm leading-7 opacity-80">{system.excerpt}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {system.functions.slice(0, 2).map((item) => (
                    <span key={item.name} className="rounded-full bg-current/8 px-3 py-1 text-xs">
                      {item.name}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedSystem ? (
          <div className="flex flex-col gap-4">
            <section className="panel-surface p-5 lg:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">System Detail</p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-950">{selectedSystem.name}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{selectedSystem.description}</p>
                </div>
                <div className="flex flex-col gap-2 text-sm text-slate-600">
                  <span>문서: {selectedSystem.document_name}</span>
                  <span>Rev: {selectedSystem.revision}</span>
                  <span>소관: {selectedSystem.owner_org}</span>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedSystem.stakeholders.map((stakeholder) => (
                  <div key={`${stakeholder.role}-${stakeholder.name}`} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{stakeholder.role}</p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{stakeholder.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{stakeholder.department}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">주요 기능</h3>
                  <div className="mt-3 space-y-3">
                    {selectedSystem.functions.map((item) => (
                      <div key={item.name} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                        <p className="font-semibold text-slate-950">{item.name}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">데이터 자산</h3>
                  <div className="mt-3 space-y-3">
                    {selectedSystem.data_assets.map((asset) => (
                      <div key={asset.name} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-950">{asset.name}</p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{asset.classification}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">보관 기간: {asset.retention}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 2xl:grid-cols-[1fr_0.92fr]">
              <section className="panel-surface p-5 lg:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Relation Graph</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">시스템 간 연관도</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {relationGraph.relatedEdges.length} edges
                  </span>
                </div>
                <div className="relative mt-5 min-h-[340px] overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_42%),linear-gradient(180deg,#fff,#f8fafc)]">
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {relationGraph.relatedEdges.map((edge, index) => {
                      const sourceIndex = relationGraph.uniqueNodes.findIndex((node) => node.id === edge.source_id);
                      const targetIndex = relationGraph.uniqueNodes.findIndex((node) => node.id === edge.target_id);
                      const sourceAngle = (Math.PI * 2 * sourceIndex) / Math.max(relationGraph.uniqueNodes.length, 1);
                      const targetAngle = (Math.PI * 2 * targetIndex) / Math.max(relationGraph.uniqueNodes.length, 1);
                      const sourceX = sourceIndex === 0 ? 50 : 50 + Math.cos(sourceAngle) * 34;
                      const sourceY = sourceIndex === 0 ? 50 : 50 + Math.sin(sourceAngle) * 34;
                      const targetX = targetIndex === 0 ? 50 : 50 + Math.cos(targetAngle) * 34;
                      const targetY = targetIndex === 0 ? 50 : 50 + Math.sin(targetAngle) * 34;
                      return (
                        <line
                          key={`${edge.source_id}-${edge.target_id}-${index}`}
                          x1={sourceX}
                          y1={sourceY}
                          x2={targetX}
                          y2={targetY}
                          stroke={edge.confidence === "high" ? "#0f172a" : edge.confidence === "medium" ? "#f59e0b" : "#94a3b8"}
                          strokeDasharray={edge.protocol === "Batch" ? "4 3" : undefined}
                          strokeWidth={edge.confidence === "high" ? 2.2 : 1.6}
                        />
                      );
                    })}
                  </svg>
                  {relationGraph.uniqueNodes.map((node, index) => {
                    const angle = (Math.PI * 2 * index) / Math.max(relationGraph.uniqueNodes.length, 1);
                    const isCenter = index === 0;
                    const x = isCenter ? 50 : 50 + Math.cos(angle) * 34;
                    const y = isCenter ? 50 : 50 + Math.sin(angle) * 34;
                    return (
                      <button
                        key={node.id}
                        type="button"
                        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-3 text-center text-xs font-semibold shadow-lg transition ${
                          isCenter
                            ? "bg-slate-950 text-white"
                            : "bg-white text-slate-900 hover:bg-amber-100"
                        }`}
                        style={{ left: `${x}%`, top: `${y}%`, maxWidth: isCenter ? "180px" : "150px" }}
                        onClick={() => setSelectedSystemId(node.id)}
                      >
                        {node.name}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-3">
                  {relationGraph.relatedEdges.map((edge) => {
                    const counterParty = edge.source_id === selectedSystem.id ? edge.target_id : edge.source_id;
                    const target = dashboard.systems.find((item) => item.id === counterParty);
                    return (
                      <div key={`${edge.source_id}-${edge.target_id}`} className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        <div>
                          <p className="font-semibold text-slate-950">{target?.name ?? counterParty}</p>
                          <p className="mt-1 text-xs text-slate-500">{edge.label}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{edge.protocol}</span>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-950">{confidenceLabel(edge.confidence)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="panel-surface p-5 lg:p-6">
                <p className="eyebrow">System Diagram</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">시스템 구성도</h3>
                <div className="mt-5 grid gap-3">
                  {selectedSystem.infra_components.map((component) => (
                    <div key={component.name} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-950">{component.name}</p>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{component.type}</span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{component.specification}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-[28px] bg-slate-950 p-5 text-xs leading-7 text-emerald-200">
                  <p className="mb-2 text-sm font-semibold text-white">Mermaid DSL</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono">{selectedSystem.diagram_mermaid}</pre>
                </div>
              </section>
            </section>
          </div>
        ) : null}

        <ChatPanel systems={dashboard.systems} onSelectSystem={setSelectedSystemId} />
      </section>
    </div>
  );
}
