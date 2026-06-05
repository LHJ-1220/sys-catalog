"use client";

import { useState, useTransition } from "react";

import { askCatalog } from "@/lib/api";
import type { ChatResponse, SystemCard } from "@/lib/types";

type ChatPanelProps = {
  systems: SystemCard[];
  onSelectSystem: (systemId: string) => void;
};

const quickQuestions = [
  "디지털감사시스템 담당 조직 알려줘",
  "법무관리시스템 연관 시스템은 뭐야?",
  "내부통제시스템 구성도 요약해줘",
];

export function ChatPanel({ systems, onSelectSystem }: ChatPanelProps) {
  const [question, setQuestion] = useState(quickQuestions[0]);
  const [response, setResponse] = useState<ChatResponse>({
    answer: "운영매뉴얼 기반 카탈로그에 질문하면 담당, 연관도, 구성 정보를 바로 요약합니다.",
    citations: systems.slice(0, 2).map((system) => system.document_name),
    suggested_system_ids: systems.slice(0, 2).map((system) => system.id),
  });
  const [isPending, startTransition] = useTransition();

  const submitQuestion = (value: string) => {
    startTransition(async () => {
      const nextResponse = await askCatalog(value);
      setResponse(nextResponse);
      const nextId = nextResponse.suggested_system_ids[0];
      if (nextId) {
        onSelectSystem(nextId);
      }
    });
  };

  return (
    <section className="panel-surface flex h-full flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">AI Catalog Chat</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">챗봇 기반 시스템 정보 생성</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
          {isPending ? "답변 생성 중" : "RAG Ready"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickQuestions.map((item) => (
          <button
            key={item}
            type="button"
            className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            onClick={() => {
              setQuestion(item);
              submitQuestion(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">질문 입력</span>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-h-32 rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-slate-950"
          placeholder="예: 수익증권 시스템 담당자와 연관 시스템을 알려줘"
        />
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          onClick={() => submitQuestion(question)}
          disabled={isPending || !question.trim()}
        >
          {isPending ? "질문 분석 중..." : "질문하기"}
        </button>
      </div>

      <div className="rounded-[28px] bg-slate-950 p-5 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <p className="text-sm leading-7 text-slate-200">{response.answer}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          {response.citations.map((citation) => (
            <span key={citation} className="rounded-full border border-slate-700 px-3 py-1">
              {citation}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {response.suggested_system_ids.map((systemId) => {
          const system = systems.find((item) => item.id === systemId);
          if (!system) {
            return null;
          }
          return (
            <button
              key={systemId}
              type="button"
              className="rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-200"
              onClick={() => onSelectSystem(systemId)}
            >
              {system.name} 보기
            </button>
          );
        })}
      </div>
    </section>
  );
}
