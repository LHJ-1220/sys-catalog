# sys-catalog

운영매뉴얼 `.docx` 문서를 기반으로 시스템 정보를 구조화하고 조회할 수 있는 AI 기반 시스템 카탈로그 앱입니다.

현재 저장소에는 다음 MVP가 포함되어 있습니다.

- 운영매뉴얼 문서 기반 시스템 정보 동기화
- 시스템 정보 조회
- 시스템 간 연관도 표시
- 시스템 구성도 표시
- 챗봇 기반 질의 응답 화면

## 개요

`sys-catalog`는 `docs/` 폴더에 있는 운영매뉴얼 문서를 읽어 시스템 카탈로그 형태로 가공하고, 웹 화면에서 기능별로 탐색할 수 있게 구성한 프로젝트입니다.

프런트엔드는 Next.js, 백엔드는 FastAPI로 구성되어 있으며, 현재 버전은 실제 `docx` 파싱 + 규칙 기반 분류/연계 추론 MVP입니다.

## 주요 기능

### F1. 운영매뉴얼 문서 기반 시스템 정보 입력

- `docs/` 폴더의 `.docx` 문서를 스캔
- 문서명과 본문을 기준으로 시스템명, 분류, 개정 정보 추출
- 카탈로그 데이터로 동기화

### F2. 시스템 정보 조회

- 시스템명 / 카테고리 / 문서명 기반 검색
- 시스템 상세 정보 표시
- 담당 조직, 주요 기능, 데이터 자산 조회

### F3. 시스템 간 연관도 출력

- 문서 기반 시스템 관계 추론
- 선택한 시스템 기준 관계 노드와 엣지 시각화
- 프로토콜, 신뢰도, 연계 설명 표시

### F4. 시스템 구성도 출력

- 시스템별 인프라 구성요소 조회
- Mermaid DSL 기반 구성도 문자열 표시

### F5. 챗봇 기반 시스템 정보 생성

- 시스템 정보 질의 응답
- 추천 시스템으로 바로 이동
- 추후 RAG/LLM 연동 확장 가능 구조

## 기술 스택

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Backend: FastAPI, Pydantic
- Parsing: `python-docx`, `ZipFile + Word XML`
- Runtime: Node.js, Python 3.13 환경에서 검증

## 프로젝트 구조

```text
system-catalog/
├─ apps/
│  ├─ api/           # FastAPI 백엔드
│  └─ web/           # Next.js 프런트엔드
├─ design/           # 설계 문서
├─ docs/             # 원본 운영매뉴얼(.docx)
└─ README.md
```

## 실행 방법

### 1. 백엔드 실행

저장소 루트에서 실행합니다.

```powershell
python -m pip install -r apps/api/requirements.txt
$env:PYTHONPATH = "c:\Users\26_ICT_Performance\workspace\system-catalog\apps\api"
python -m uvicorn main:app --app-dir apps/api --host 127.0.0.1 --port 8000
```

백엔드 기본 주소:

- `http://127.0.0.1:8000`

### 2. 프런트엔드 실행

별도 터미널에서 실행합니다.

```powershell
Push-Location apps/web
$env:NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:8000"
npm install
npm run dev
Pop-Location
```

프런트 기본 주소:

- `http://localhost:3000`

## 빌드 및 검증

### 프런트 빌드

```powershell
Push-Location apps/web
npm run build
Pop-Location
```

### 프런트 린트

```powershell
Push-Location apps/web
npm run lint
Pop-Location
```

### 백엔드 동기화 확인

```powershell
$env:PYTHONPATH = "c:\Users\26_ICT_Performance\workspace\system-catalog\apps\api"
python -c "from main import service; dashboard = service.sync(); print(len(dashboard.systems))"
```

## 주요 API

- `GET /api/health` : 서버 상태 확인
- `GET /api/dashboard` : 전체 대시보드 데이터 조회
- `POST /api/ingest/sync` : `docs/` 폴더 재동기화
- `GET /api/systems` : 시스템 목록 조회
- `GET /api/systems/{system_id}` : 시스템 상세 조회
- `GET /api/systems/{system_id}/relations` : 시스템 관계 조회
- `GET /api/systems/{system_id}/diagram` : Mermaid 구성도 조회
- `POST /api/chat` : 챗봇 질의

## 현재 구현 범위

현재 버전은 설계서 전체를 모두 구현한 운영 버전이 아니라, 화면과 API 흐름을 검증하기 위한 MVP입니다.

구현됨:

- `docs/` 문서 스캔 및 시스템 카드 생성
- 기능별 상단 메뉴 UI
- 시스템 조회 / 연관도 / 구성도 / 챗봇 화면
- 화면 전환 애니메이션

미구현 또는 후속 확장:

- 실제 LLM 기반 구조화 추출
- 벡터 검색 / RAG
- DB 영속화
- 사용자 인증 / 권한 관리
- 문서 업로드 UI와 승인 워크플로

## 설계 문서

상세 설계는 `design/설계서.md`를 참고합니다.

## 참고

- 현재 `docs/` 폴더 기준으로 시스템 카탈로그 데이터가 생성됩니다.
- 백엔드가 실행되지 않아도 프런트에는 예비 데이터가 표시되도록 구성되어 있습니다.
