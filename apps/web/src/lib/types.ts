export type FunctionItem = {
  name: string;
  description: string;
};

export type Stakeholder = {
  role: string;
  name: string;
  department: string;
  contact: string;
};

export type InfraComponent = {
  name: string;
  type: "Client" | "Web" | "WAS" | "DB" | "External" | "Batch" | "Security";
  specification: string;
  environment: "운영" | "개발" | "공통";
};

export type DataAsset = {
  name: string;
  classification: "개인정보" | "업무" | "일반";
  retention: string;
};

export type InterfaceItem = {
  target_system_id: string;
  target_system_name: string;
  protocol: string;
  direction: string;
  summary: string;
  confidence: "high" | "medium" | "low";
};

export type SystemCard = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  owner_org: string;
  status: string;
  criticality: "상" | "중" | "하";
  document_name: string;
  document_path: string;
  revision: string;
  excerpt: string;
  functions: FunctionItem[];
  stakeholders: Stakeholder[];
  infra_components: InfraComponent[];
  interfaces: InterfaceItem[];
  data_assets: DataAsset[];
  diagram_mermaid: string;
};

export type RelationEdge = {
  source_id: string;
  target_id: string;
  label: string;
  protocol: string;
  confidence: "high" | "medium" | "low";
};

export type DashboardPayload = {
  systems: SystemCard[];
  relations: RelationEdge[];
  synced_at: string;
  source_count: number;
};

export type ChatResponse = {
  answer: string;
  citations: string[];
  suggested_system_ids: string[];
};
