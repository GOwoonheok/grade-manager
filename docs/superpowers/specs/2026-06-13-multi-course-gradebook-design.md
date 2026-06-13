# 연도·학기·과목별 성적관리 재설계 — 분석 (개발 보류)

- 날짜: 2026-06-13
- 상태: **방향·핵심결정 합의 / 단계 로드맵 확정 / P1 스펙은 착수 전(보류)**
- 한 줄: 단일 과목 가정을 벗어나, 연도·학기·과목(course offering)별로 성적·답안지를 관리.

## 확정 결정
1. **학생 식별 = 사람 + 수강등록(enrollment) 분리**: 한 학생 = 계정 1개, 여러 과목에 enrollment. 점수·답안지는 enrollment 귀속. 학생은 한 번 로그인해 모든 수강 과목을 봄.
2. **권한 = 다중 교수(과목별 소유)**: 과목마다 담당 교수(owner). 교수는 자기 과목만 보고/수정.

## 현재 구조의 한계
- `students` = 로그인+프로필+**그 과목 점수**, `class_settings` = **전역 가중치 1세트**, `answer_sheets` = student별, 통계 = "전체 학생". → 과목이 둘 이상이면 구분 불가.

## 목표 데이터 모델
```
profiles  (사람/계정 — 로그인)
  id(auth uid) · login_id(학번/교번, unique) · name · department · role(student|professor)

courses  (과목 개설)
  id · owner_id→profiles(교수) · year · semester · subject_name
     · midterm_w · final_w · attendance_w · created_at
  UNIQUE(owner_id, year, semester, subject_name)

enrollments  (수강등록 — 점수가 여기)
  id · course_id→courses · student_id→profiles
     · midterm · final · attendance · created_at
  UNIQUE(course_id, student_id)

answer_sheets   (enrollment 기준으로 재연결)
  id · enrollment_id→enrollments · exam_type · path · created_at
```

## 권한(RLS) — 헬퍼: is_professor(), owns_course(course_id)
| 테이블 | 학생 | 교수 |
|---|---|---|
| profiles | 본인 | 전체 읽기(수강등록용) + 학생 생성 |
| courses | 수강 중인 과목 | 자신이 owner인 과목 |
| enrollments | 본인 | 자기 과목 |
| answer_sheets | 본인 enrollment | 자기 과목 enrollment |

- ⚠️ privacy 결정: 교수가 타 과목 학생을 학번으로 찾아 등록(공용 학생 디렉터리) 허용 여부. enrollment 모델 장점을 살리려면 공용 디렉터리 권장(점수는 비공개).

## 기존 데이터 마이그레이션 (Expand→Contract, 무중단)
1. profiles ← students(식별 필드)
2. courses ← 1행: 2026·2학기·"전자조달시스템의 이해", owner=PROF001, 가중치=class_settings(40/40/20)
3. enrollments ← role='student' 점수
4. answer_sheets ← student_id를 enrollment_id로 재연결
5. (안정화 후) 레거시 제거

## UI 변화
- 교수: 로그인 → 내 과목 목록(+과목 생성: 연도/학기/과목명/가중치) → 과목 선택 → 그 과목 한정 명단·점수·엑셀·답안지.
- 학생: 로그인 → 내 과목 목록 → 과목 선택 → 그 과목 점수·답안지·반평균.

## 이행 전략 (채택: A)
- **A. 단계적 Expand/Contract** ✅: 새 테이블 추가 → 기존 데이터 이전 → UI 단계 전환 → 레거시 제거. 위험 분산, 앱 무중단.
- B. 빅뱅: 한 번에 전부. 깔끔하나 위험.
- C. 최소 바느질: course_id만 추가. 정규화 어정쩡, ①결정과 충돌 → 비채택.

## 단계 로드맵 (각 단계 = 별도 스펙→계획→구현)
| 단계 | 내용 |
|---|---|
| P1 | 스키마 + RLS + 기존 2026 데이터 이전 (앱 호환 유지) |
| P2 | 교수 과목 관리/선택 UI + 과목별 명단·점수·가중치 |
| P3 | 학생 다과목 UI(내 과목 → 과목별 성적) |
| P4 | 답안지 enrollment 재연결 + 과목별 (현재 답안지 기능 이전) |
| P5 | 레거시 제거(class_settings, students 점수 컬럼 등) |

## 개발 전 확정할 미결
1. semester 표기(1/2 정수 권장)
2. 공용 학생 디렉터리 여부(권한/프라이버시)
3. 다중 교수 계정 온보딩 방법(관리자 화면 필요 여부)
4. 답안지 스토리지 경로/RLS(다중 교수에서 "내 과목 객체" 판정) — P4에서 설계

## 선행 권고
- 현재 `feature/answer-sheet-photos` 브랜치(완성·검증)를 먼저 main에 병합한 뒤 이 재설계를 시작. P4에서 답안지를 enrollment 기준으로 이전.
