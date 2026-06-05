from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree
from zipfile import ZipFile

from models import (
    DashboardPayload,
    DataAsset,
    FunctionItem,
    InfraComponent,
    InterfaceItem,
    RelationEdge,
    Stakeholder,
    SystemCard,
)

WORD_NAMESPACE = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
HEADING_PATTERN = re.compile(r"^(\d+(?:\.\d+)*)\s+[\uac00-\ud7a3A-Za-z0-9][^\n]{1,80}$")
REV_PATTERN = re.compile(r"Rev[\d.]+", re.IGNORECASE)
PREFIX_PATTERN = re.compile(r"^(?:org_)?HICT_FSO_QLT_LI2_", re.IGNORECASE)
SUFFIX_PATTERN = re.compile(r"_운영매뉴얼.*$", re.IGNORECASE)

CATEGORY_RULES = {
    "감사": "감사/통제",
    "통제": "감사/통제",
    "법무": "법무/준법",
    "안전": "안전/보건",
    "보건": "안전/보건",
    "수익증권": "금융/상품",
    "아카데미": "교육/학습",
    "도서관": "교육/콘텐츠",
    "사회공헌": "대외/브랜드",
    "선물": "고객서비스",
    "오퍼링": "영업/오퍼링",
    "GA": "영업/채널",
    "위촉": "영업/채널",
    "HTOPS": "운영/지원",
}

CRITICAL_RULES = {
    "감사": "상",
    "통제": "상",
    "법무": "상",
    "수익증권": "상",
    "안전": "상",
    "보건": "상",
    "오퍼링": "중",
    "GA": "중",
    "아카데미": "중",
    "도서관": "중",
}


class CatalogService:
    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root
        self.docs_dir = project_root / "docs"
        self._cache: DashboardPayload | None = None

    def get_dashboard(self) -> DashboardPayload:
        if self._cache is None:
            self.sync()
        return self._cache  # type: ignore[return-value]

    def get_system(self, system_id: str) -> SystemCard | None:
        return next((item for item in self.get_dashboard().systems if item.id == system_id), None)

    def get_relations_for_system(self, system_id: str) -> list[RelationEdge]:
        return [
            edge
            for edge in self.get_dashboard().relations
            if edge.source_id == system_id or edge.target_id == system_id
        ]

    def sync(self) -> DashboardPayload:
        systems = [self._build_system(path) for path in sorted(self.docs_dir.glob("*.docx"))]
        relations = self._build_relations(systems)
        relation_lookup: dict[str, list[InterfaceItem]] = {system.id: [] for system in systems}
        for edge in relations:
            relation_lookup[edge.source_id].append(
                InterfaceItem(
                    target_system_id=edge.target_id,
                    target_system_name=self._name_by_id(systems, edge.target_id),
                    protocol=edge.protocol,
                    direction="outbound",
                    summary=edge.label,
                    confidence=edge.confidence,
                )
            )
            relation_lookup[edge.target_id].append(
                InterfaceItem(
                    target_system_id=edge.source_id,
                    target_system_name=self._name_by_id(systems, edge.source_id),
                    protocol=edge.protocol,
                    direction="inbound",
                    summary=edge.label,
                    confidence=edge.confidence,
                )
            )

        hydrated_systems = [
            system.model_copy(update={"interfaces": relation_lookup.get(system.id, [])})
            for system in systems
        ]
        self._cache = DashboardPayload(
            systems=hydrated_systems,
            relations=relations,
            synced_at=datetime.now(timezone.utc).isoformat(),
            source_count=len(hydrated_systems),
        )
        return self._cache

    def answer_question(self, question: str) -> tuple[str, list[str], list[str]]:
        dashboard = self.get_dashboard()
        lowered = question.casefold()
        matched = [system for system in dashboard.systems if system.name.casefold() in lowered]
        if not matched:
            matched = [
                system
                for system in dashboard.systems
                if any(token and token in lowered for token in self._keywords(system))
            ]

        if matched:
            primary = matched[0]
            citations = [f"{primary.document_name}"]
            suggested = [primary.id]
            if "담당" in question:
                answer = f"{primary.name}의 운영 담당은 {primary.stakeholders[0].department} {primary.stakeholders[0].name}입니다."
            elif "연관" in question or "영향" in question:
                related = self.get_relations_for_system(primary.id)
                if related:
                    names = ", ".join(
                        self._name_by_id(dashboard.systems, edge.target_id if edge.source_id == primary.id else edge.source_id)
                        for edge in related[:4]
                    )
                    answer = f"{primary.name}는 {names}와 연관되어 있습니다."
                else:
                    answer = f"{primary.name}는 현재 추론된 연관 시스템이 없습니다."
            elif "구성" in question or "구성도" in question:
                components = ", ".join(component.name for component in primary.infra_components)
                answer = f"{primary.name}의 주요 구성요소는 {components}입니다."
            else:
                answer = f"{primary.name}는 {primary.category} 영역의 시스템이며, {primary.description}"
            return answer, citations, suggested

        if "목록" in question or "시스템" in question:
            names = ", ".join(system.name for system in dashboard.systems[:8])
            return (
                f"현재 동기화된 주요 시스템은 {names} 등입니다.",
                [system.document_name for system in dashboard.systems[:3]],
                [system.id for system in dashboard.systems[:3]],
            )

        return (
            "현재 질문과 직접 연결되는 시스템을 찾지 못했습니다. 시스템명, 담당, 연관도, 구성도 같은 키워드로 다시 물어보면 더 정확하게 답할 수 있습니다.",
            [],
            [],
        )

    def _build_system(self, path: Path) -> SystemCard:
        text = self._extract_docx_text(path)
        name = self._derive_name(path.stem)
        system_id = self._slugify(name)
        category = self._infer_from_rules(name, CATEGORY_RULES, default="공통/업무")
        criticality = self._infer_from_rules(name, CRITICAL_RULES, default="중")
        revision_match = REV_PATTERN.search(path.stem)
        revision = revision_match.group(0) if revision_match else "Rev1"
        excerpt = self._extract_excerpt(text)
        functions = self._extract_functions(text, name)
        infra = self._infer_infra(name, category)
        stakeholders = [
            Stakeholder(
                role="운영",
                name=f"{name} 운영 담당",
                department="FSO QLT LI2",
                contact="내부 문의",
            ),
            Stakeholder(
                role="개발",
                name=f"{name} 개발 담당",
                department="IT 서비스개발팀",
                contact="내부 문의",
            ),
        ]
        data_assets = [
            DataAsset(name=f"{name} 운영 데이터", classification="업무", retention="3년"),
            DataAsset(name=f"{name} 로그", classification="일반", retention="1년"),
        ]
        mermaid = self._build_diagram(name, infra)
        return SystemCard(
            id=system_id,
            code=f"SYS-{system_id[:8].upper()}",
            name=name,
            category=category,
            description=excerpt,
            owner_org="FSO QLT LI2",
            status="운영중",
            criticality=criticality,
            document_name=path.name,
            document_path=str(path.relative_to(self.project_root)).replace("\\", "/"),
            revision=revision,
            excerpt=excerpt,
            functions=functions,
            stakeholders=stakeholders,
            infra_components=infra,
            data_assets=data_assets,
            diagram_mermaid=mermaid,
        )

    def _build_relations(self, systems: list[SystemCard]) -> list[RelationEdge]:
        relations: list[RelationEdge] = []
        seen_pairs: set[tuple[str, str]] = set()
        for source in systems:
            source_keywords = set(self._keywords(source))
            for target in systems:
                if source.id == target.id:
                    continue
                pair = tuple(sorted((source.id, target.id)))
                if pair in seen_pairs:
                    continue
                score = 0
                protocol = "REST"
                confidence = "low"
                if target.name in source.excerpt or source.name in target.excerpt:
                    score += 3
                    confidence = "high"
                if source.category == target.category:
                    score += 2
                    protocol = "Batch"
                    confidence = "medium"
                if source_keywords.intersection(self._keywords(target)):
                    score += 1
                if score >= 2:
                    label = "업무 연계" if source.category == target.category else "문서 추론 연계"
                    relations.append(
                        RelationEdge(
                            source_id=source.id,
                            target_id=target.id,
                            label=label,
                            protocol=protocol,
                            confidence=confidence,
                        )
                    )
                    seen_pairs.add(pair)

        if not relations and len(systems) > 1:
            for index in range(len(systems) - 1):
                relations.append(
                    RelationEdge(
                        source_id=systems[index].id,
                        target_id=systems[index + 1].id,
                        label="문서 기반 기본 연계",
                        protocol="Batch",
                        confidence="low",
                    )
                )
        return relations

    def _extract_docx_text(self, path: Path) -> str:
        try:
            with ZipFile(path) as archive:
                xml_bytes = archive.read("word/document.xml")
        except Exception:
            return "문서 본문을 읽을 수 없어 파일명 기반 정보만 생성했습니다."

        try:
            root = ElementTree.fromstring(xml_bytes)
        except ElementTree.ParseError:
            return "문서 XML을 파싱할 수 없어 파일명 기반 정보만 생성했습니다."

        paragraphs: list[str] = []
        for paragraph in root.iter(f"{WORD_NAMESPACE}p"):
            texts = [node.text or "" for node in paragraph.iter(f"{WORD_NAMESPACE}t")]
            line = "".join(texts).strip()
            if line:
                paragraphs.append(line)
        return "\n".join(paragraphs)

    def _derive_name(self, raw_name: str) -> str:
        cleaned = PREFIX_PATTERN.sub("", raw_name)
        cleaned = SUFFIX_PATTERN.sub("", cleaned)
        cleaned = cleaned.replace("_", " ").strip()
        return cleaned or raw_name

    def _extract_excerpt(self, text: str) -> str:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        candidates = [line for line in lines if len(line) > 30 and not HEADING_PATTERN.match(line)]
        snippet = candidates[0] if candidates else (lines[0] if lines else "운영매뉴얼 기반 시스템 요약입니다.")
        return snippet[:240]

    def _extract_functions(self, text: str, name: str) -> list[FunctionItem]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        headings = [line for line in lines if HEADING_PATTERN.match(line)]
        selected = headings[:3]
        if not selected:
            selected = [f"1 시스템 개요", f"2 주요 기능", f"3 운영 절차"]
        items: list[FunctionItem] = []
        for heading in selected:
            title = re.sub(r"^\d+(?:\.\d+)*\s+", "", heading).strip()
            items.append(
                FunctionItem(
                    name=title,
                    description=f"{name} 매뉴얼에서 추출한 '{title}' 관련 운영 정보입니다.",
                )
            )
        return items[:4]

    def _infer_infra(self, name: str, category: str) -> list[InfraComponent]:
        database_spec = "Oracle 19c" if any(token in category for token in ["금융", "감사", "법무"]) else "PostgreSQL 16"
        external_name = "그룹 SSO" if "교육" in category or "고객" in category else "사내 공통 인증"
        return [
            InfraComponent(name="사용자 채널", type="Client", specification="사내 사용자 브라우저", environment="공통"),
            InfraComponent(name=f"{name} Web", type="Web", specification="Nginx / Next.js", environment="운영"),
            InfraComponent(name=f"{name} API", type="WAS", specification="FastAPI / 업무 로직", environment="운영"),
            InfraComponent(name=f"{name} DB", type="DB", specification=database_spec, environment="운영"),
            InfraComponent(name=external_name, type="External", specification="OIDC / REST", environment="공통"),
        ]

    def _build_diagram(self, name: str, infra: list[InfraComponent]) -> str:
        edges = [
            ("USER", infra[0].name),
            (infra[0].name, infra[1].name),
            (infra[1].name, infra[2].name),
            (infra[2].name, infra[3].name),
            (infra[2].name, infra[4].name),
        ]
        lines = ["flowchart LR", f'    USER["업무 사용자"]']
        node_ids: dict[str, str] = {"업무 사용자": "USER"}
        for index, component in enumerate(infra, start=1):
            key = f"N{index}"
            node_ids[component.name] = key
            shape = f'[{component.name}]' if component.type != "DB" else f'[("{component.name}")]'
            lines.append(f"    {key}{shape}")
        for source_name, target_name in edges:
            source = node_ids.get(source_name, source_name)
            target = node_ids.get(target_name, target_name)
            lines.append(f"    {source} --> {target}")
        return "\n".join(lines)

    def _name_by_id(self, systems: Iterable[SystemCard], system_id: str) -> str:
        for system in systems:
            if system.id == system_id:
                return system.name
        return system_id

    def _keywords(self, system: SystemCard) -> list[str]:
        base = [token for token in re.split(r"[\s/()_-]+", system.name.casefold()) if len(token) > 1]
        base.extend(token for token in re.split(r"[\s/()_-]+", system.category.casefold()) if len(token) > 1)
        return list(dict.fromkeys(base))

    def _infer_from_rules(self, name: str, rules: dict[str, str], default: str) -> str:
        for keyword, value in rules.items():
            if keyword.casefold() in name.casefold():
                return value
        return default

    def _slugify(self, text: str) -> str:
        slug = re.sub(r"[^0-9a-zA-Z가-힣]+", "-", text).strip("-").lower()
        return slug or "system"
