from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class FunctionItem(BaseModel):
    name: str
    description: str


class Stakeholder(BaseModel):
    role: str
    name: str
    department: str
    contact: str


class InfraComponent(BaseModel):
    name: str
    type: Literal["Client", "Web", "WAS", "DB", "External", "Batch", "Security"]
    specification: str
    environment: Literal["운영", "개발", "공통"]


class DataAsset(BaseModel):
    name: str
    classification: Literal["개인정보", "업무", "일반"]
    retention: str


class InterfaceItem(BaseModel):
    target_system_id: str
    target_system_name: str
    protocol: str
    direction: str
    summary: str
    confidence: Literal["high", "medium", "low"]


class SystemCard(BaseModel):
    id: str
    code: str
    name: str
    category: str
    description: str
    owner_org: str
    status: str
    criticality: Literal["상", "중", "하"]
    document_name: str
    document_path: str
    revision: str
    excerpt: str
    functions: list[FunctionItem] = Field(default_factory=list)
    stakeholders: list[Stakeholder] = Field(default_factory=list)
    infra_components: list[InfraComponent] = Field(default_factory=list)
    interfaces: list[InterfaceItem] = Field(default_factory=list)
    data_assets: list[DataAsset] = Field(default_factory=list)
    diagram_mermaid: str


class RelationEdge(BaseModel):
    source_id: str
    target_id: str
    label: str
    protocol: str
    confidence: Literal["high", "medium", "low"]


class DashboardPayload(BaseModel):
    systems: list[SystemCard]
    relations: list[RelationEdge]
    synced_at: str
    source_count: int


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[str] = Field(default_factory=list)
    suggested_system_ids: list[str] = Field(default_factory=list)
