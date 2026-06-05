from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from catalog_service import CatalogService
from models import ChatRequest, ChatResponse, DashboardPayload, SystemCard

project_root = Path(__file__).resolve().parents[2]
service = CatalogService(project_root=project_root)

app = FastAPI(
    title="System Catalog API",
    version="0.1.0",
    description="운영매뉴얼 기반 시스템 카탈로그 MVP API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def load_catalog() -> None:
    service.sync()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/dashboard", response_model=DashboardPayload)
def get_dashboard() -> DashboardPayload:
    return service.get_dashboard()


@app.post("/api/ingest/sync", response_model=DashboardPayload)
def sync_catalog() -> DashboardPayload:
    return service.sync()


@app.get("/api/systems", response_model=list[SystemCard])
def list_systems() -> list[SystemCard]:
    return service.get_dashboard().systems


@app.get("/api/systems/{system_id}", response_model=SystemCard)
def get_system(system_id: str) -> SystemCard:
    system = service.get_system(system_id)
    if system is None:
        raise HTTPException(status_code=404, detail="System not found")
    return system


@app.get("/api/systems/{system_id}/relations")
def get_relations(system_id: str) -> dict[str, object]:
    system = service.get_system(system_id)
    if system is None:
        raise HTTPException(status_code=404, detail="System not found")
    return {
        "system": system,
        "relations": service.get_relations_for_system(system_id),
    }


@app.get("/api/systems/{system_id}/diagram")
def get_diagram(system_id: str) -> dict[str, str]:
    system = service.get_system(system_id)
    if system is None:
        raise HTTPException(status_code=404, detail="System not found")
    return {"system_id": system.id, "mermaid": system.diagram_mermaid}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    answer, citations, suggested = service.answer_question(request.question)
    return ChatResponse(answer=answer, citations=citations, suggested_system_ids=suggested)
