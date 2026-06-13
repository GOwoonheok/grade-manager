# 조달관리사 플래시카드 학습 서비스 — 설계 (개발 보류)

- 날짜: 2026-06-13
- 상태: **설계만**. 개발은 추후. (성적관리와 별개 서브시스템)
- 한 줄: 같은 로그인으로, 승인된 학생이 조달관리사 4과목을 플래시카드로 자가학습.

## 확정 결정 (브레인스토밍)
1. **학습 메커니즘**: 단순 플래시카드(앞=문제/개념, 뒤=정답/설명, "안다/모른다" 진도). 추후 SRS/퀴즈로 확장.
2. **콘텐츠 투입**: **개별 카드 저작 UI** 우선. 엑셀 **다운로드(내보내기/양식)** 는 추후.
3. **저작 권한**: **전용 관리자(admin) 역할 신설** (기존 student/professor와 별개).
4. **카드 이미지**: 허용(앞/뒤 이미지 선택).
5. **학습 대상**: 특정 대상만 — **승인 구조**(학생이 신청 → 관리자 승인, 또는 관리자가 직접 등록=즉시 승인).

## 데이터 모델
```
profiles.role  ∈ ('student','professor','admin')   ← 'admin' 추가

decks (학습 과목 = 조달관리사 4과목; admin이 추가/관리)
  id · name · sort_order · created_at

cards (과목별 카드; admin 저작)
  id · deck_id→decks · front_text · back_text
     · front_image_path? · back_image_path?   (이미지 선택)
     · sort_order · created_at

card_marks (학생별 진도, 최소 상태)
  student_id→profiles · card_id→cards · status('known'|'unknown') · updated_at
  UNIQUE(student_id, card_id)

study_members (학습 접근 승인)
  id · student_id→profiles · status('pending'|'approved'|'rejected')
     · requested_at · decided_at · decided_by→profiles
  UNIQUE(student_id)        ← v1은 프로그램(4과목 전체) 단위 접근
```
- **접근 단위**: v1은 프로그램(조달관리사 전체) 단위. 과목별 접근이 필요하면 study_members에 deck_id를 추가해 확장.
- **이미지 저장**: Storage 버킷 `flashcard-images`. 답안지와 달리 **민감정보 아님 → 공개(public) 버킷** 권장(서명URL 불필요, getPublicUrl). admin만 업로드, 누구나 조회.

## 권한 (RLS) — 헬퍼: is_admin(), is_study_member()(승인된 study_members 존재)
| 테이블 | 학생 | 관리자(admin) |
|---|---|---|
| decks · cards | **승인된** 학생만 읽기 | 전체 읽기/쓰기(저작) |
| card_marks | 본인 것만 읽기/쓰기 | (통계용 읽기 선택) |
| study_members | 본인 행 읽기 + 본인 신청(insert, status=pending) | 전체 읽기 + 승인/거부(update) + 직접 등록(insert approved) |
| storage(flashcard-images) | 공개 읽기 | admin 쓰기 |

## 화면(UI)
- **학생 "공부하기"**:
  - 미신청 → "학습 신청" 버튼(study_members pending 생성)
  - 승인 대기 → "승인 대기중"
  - 승인됨 → 과목(4) 선택 → **카드 학습**(앞면 → 탭하면 뒤면 → 안다/모른다 → 다음), 진도 "32/120 익힘"
- **관리자(admin)**:
  - **카드 저작**: 과목(deck) 관리 + 카드 추가/수정/삭제(앞/뒤 텍스트 + 이미지 업로드)
  - **신청 승인**: study_members 목록 → 승인/거부, 또는 학생 직접 등록

## 기존 시스템과의 관계
- `profiles`(로그인) 공유. 성적관리(courses/enrollments)와 **독립**.
- 학생 메인에 "공부하기" 진입점 추가. 학습 과목(4)과 성적 과목은 무관.
- 'admin' 계정 온보딩: 초기엔 professor처럼 수동(SQL). 추후 관리자 화면.

## 확장 경로 (지금 안 함)
- card_marks → review_state(복습일정·간격) = **SRS(간격반복)**
- quizzes/questions/attempts = **모의고사**
- study_members에 deck_id = **과목별 접근**
- 엑셀 다운로드/업로드(콘텐츠 양식·이관)

## 개발 전 확정할 미결(설계 보완용)
- 'admin'과 'professor'를 한 사람이 겸할 수 있나(역할 단일 vs 복수)?
- 신청 시 학생이 신청 사유/대상 과목을 고르나, 단순 신청인가?
- 이미지 용량/형식 정책(답안지처럼 축소 적용 여부).
- 진도("안다/모른다") 외에 학습 통계(일자별 학습량 등) 필요 여부.
