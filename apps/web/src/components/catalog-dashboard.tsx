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

type MenuKey = "overview" | "ingest" | "catalog" | "relations" | "diagram" | "chat";

const menuGroups: Array<{
  title: string;
  items: Array<{ key: MenuKey; label: string; description: string }>;
}> = [
  {
    title: "카탈로그",
    items: [
      { key: "overview", label: "대시보드", description: "문서, 시스템, 동기화 현황" },
      { key: "ingest", label: "문서 기반 입력", description: "운영매뉴얼 동기화와 적재" },
      { key: "catalog", label: "시스템 정보 조회", description: "검색, 필터, 상세 정보" },
    ],
  },
  {
    title: "분석",
    items: [
      { key: "relations", label: "시스템 연관도", description: "연계 시스템과 영향 관계" },
      { key: "diagram", label: "시스템 구성도", description: "인프라와 Mermaid 구성" },
    ],
  },
  {
    title: "AI Assistant",
    items: [
      { key: "chat", label: "챗봇 정보 생성", description: "질의 응답과 추천 시스템" },
    ],
  },
];

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
  const [activeMenu, setActiveMenu] = useState<MenuKey>("overview");
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
  const menuItems = menuGroups.flatMap((group) => group.items);

  const syncNow = () => {
    startTransition(async () => {
      const nextDashboard = await syncCatalog();
      setDashboard(nextDashboard);
      if (!nextDashboard.systems.find((system) => system.id === selectedSystemId)) {
        setSelectedSystemId(nextDashboard.systems[0]?.id ?? "");
      }
    });
  };

  const openSystemView = (systemId: string) => {
    setSelectedSystemId(systemId);
    setActiveMenu("catalog");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-5 py-6 lg:px-8 lg:py-8">
        <section className="hero-grid overflow-hidden rounded-[36px] border border-white/60 p-6 lg:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 backdrop-blur">
                sys-catalog
              </div>
              <p className="eyebrow">{menuItems.find((item) => item.key === activeMenu)?.label}</p>
              <h2 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-5xl">
                운영매뉴얼 기반 시스템 카탈로그
              </h2>
              <p className="max-w-3xl text-base leading-8 text-slate-700 lg:text-lg">문서 적재, 조회, 연관도, 구성도, 챗봇 기능을 한곳에서 탐색합니다.</p>
            </div>

            <div className="panel-surface space-y-4 p-5 lg:p-6">
              <p className="eyebrow">Selected System</p>
              <h3 className="text-2xl font-semibold text-slate-950">{selectedSystem?.name}</h3>
              <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-white px-3 py-1">{selectedSystem?.category}</span>
                <span className="rounded-full bg-white px-3 py-1">{selectedSystem?.revision}</span>
                <span className="rounded-full bg-white px-3 py-1">{new Intl.DateTimeFormat("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(dashboard.synced_at))}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel-surface p-4 lg:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Menu</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">기능 선택</h2>
            </div>
            <div className="feature-menu-strip" role="tablist" aria-label="기능 메뉴">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={activeMenu === item.key}
                  className={activeMenu === item.key ? "top-menu-button top-menu-button-active" : "top-menu-button"}
                  onClick={() => setActiveMenu(item.key)}
                >
                  <span className="top-menu-button__dot" aria-hidden="true" />
                  <span className="top-menu-button__text">
                    <span className="top-menu-button__label">{item.label}</span>
                    <span className="top-menu-button__meta">{item.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div key={activeMenu} className="screen-transition">
        {activeMenu === "overview" ? (
          <section className="grid gap-4 xl:grid-cols-[1.05fr_1.25fr_0.9fr]">
            <section className="panel-surface p-5 lg:p-6">
              <p className="eyebrow">Overview</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">서비스 개요</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="glass-stat">
                  <span className="glass-stat__label">동기화 문서</span>
                  <strong className="glass-stat__value">{dashboard.source_count}</strong>
                </div>
                <div className="glass-stat">
                  <span className="glass-stat__label">시스템 수</span>
                  <strong className="glass-stat__value">{dashboard.systems.length}</strong>
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
              <div className="mt-6 grid gap-3">
                {menuGroups.map((group) => (
                  <div key={group.title} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm font-semibold text-slate-950">{group.title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {group.items.map((item) => item.label).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel-surface p-5 lg:p-6">
              <p className="eyebrow">Selected System</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-950">{selectedSystem?.name}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{selectedSystem?.description}</p>
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedSystem?.stakeholders.map((stakeholder) => (
                  <div key={`${stakeholder.role}-${stakeholder.name}`} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{stakeholder.role}</p>
                    <p className="mt-2 text-base font-semibold text-slate-950">{stakeholder.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{stakeholder.department}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel-surface p-5 lg:p-6">
              <p className="eyebrow">Quick Access</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">바로가기</h2>
              <div className="mt-5 grid gap-3">
                <button type="button" className="quick-link-card" onClick={() => setActiveMenu("ingest")}>문서 기반 입력 열기</button>
                <button type="button" className="quick-link-card" onClick={() => setActiveMenu("catalog")}>시스템 조회 열기</button>
                <button type="button" className="quick-link-card" onClick={() => setActiveMenu("relations")}>연관도 분석 열기</button>
                <button type="button" className="quick-link-card" onClick={() => setActiveMenu("diagram")}>구성도 보기</button>
                <button type="button" className="quick-link-card" onClick={() => setActiveMenu("chat")}>챗봇 열기</button>
              </div>
            </section>
          </section>
        ) : null}

        {activeMenu === "ingest" ? (
          <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <section className="panel-surface space-y-4 p-5 lg:p-6">
              <p className="eyebrow">F1. Ingest</p>
              <h2 className="text-2xl font-semibold text-slate-950">운영매뉴얼 문서 기반 시스템 정보 입력</h2>
              <p className="text-sm leading-7 text-slate-600">
                docs 폴더에 있는 운영매뉴얼을 다시 읽어 시스템 카탈로그를 재구성합니다. 현재 구현은 docx 파싱과 규칙 기반 분류 MVP입니다.
              </p>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                onClick={syncNow}
                disabled={isPending}
              >
                {isPending ? "동기화 중..." : "docs 재동기화"}
              </button>
            </section>

            <section className="panel-surface p-5 lg:p-6">
              <p className="eyebrow">Source Documents</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">적재 대상 문서</h2>
              <div className="mt-5 grid gap-3 max-h-[420px] overflow-y-auto pr-1">
                {dashboard.systems.map((system) => (
                  <button
                    key={system.id}
                    type="button"
                    className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-950"
                    onClick={() => openSystemView(system.id)}
                  >
                    <p className="font-semibold text-slate-950">{system.document_name}</p>
                    <p className="mt-2 text-sm text-slate-600">{system.name} · {system.category}</p>
                  </button>
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {activeMenu === "catalog" ? (
          <section className="grid gap-4 xl:grid-cols-[1.05fr_1.35fr]">
            <div className="panel-surface flex flex-col gap-5 p-5 lg:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">F2. Catalog Search</p>
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
                onClick={() => openSystemView(system.id)}
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
          </div>
        ) : null}

        </section>
        ) : null}

        {activeMenu === "relations" && selectedSystem ? (
          <section className="panel-surface p-5 lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">F3. Relation Graph</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">시스템 간 연관도</h2>
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
                      isCenter ? "bg-slate-950 text-white" : "bg-white text-slate-900 hover:bg-amber-100"
                    }`}
                    style={{ left: `${x}%`, top: `${y}%`, maxWidth: isCenter ? "180px" : "150px" }}
                    onClick={() => openSystemView(node.id)}
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
        ) : null}

        {activeMenu === "diagram" && selectedSystem ? (
          <section className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
            <section className="panel-surface p-5 lg:p-6">
              <p className="eyebrow">F4. Diagram</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">시스템 구성도</h2>
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
            </section>

            <section className="panel-surface p-5 lg:p-6">
              <p className="eyebrow">Mermaid Source</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">구성도 DSL</h2>
              <div className="mt-5 rounded-[28px] bg-slate-950 p-5 text-xs leading-7 text-emerald-200">
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono">{selectedSystem.diagram_mermaid}</pre>
              </div>
            </section>
          </section>
        ) : null}

        {activeMenu === "chat" ? (
          <ChatPanel systems={dashboard.systems} onSelectSystem={openSystemView} />
        ) : null}
        </div>
    </div>
  );
}
