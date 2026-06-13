// 공공조달관리사 소개 (학생/교수 공용)
export default function StudyIntro() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">공공조달관리사</h2>
      <p className="text-sm text-gray-600 leading-relaxed">
        공공조달관리사는 국가·공공기관의 조달 업무(계획·계약·관리)에 필요한 전문 역량을 검증하는 자격입니다.
        본 학습 메뉴에서는 과목별 핵심 개념을 <b>플래시카드</b>로 익히고, <b>Q&A</b>로 함께 학습할 수 있습니다.
      </p>
      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">학습 과목(예시)</p>
        <ul className="text-sm text-gray-600 space-y-1 list-disc pl-5">
          <li>공공조달의 이해</li>
          <li>공공조달 계획분석</li>
          <li>공공계약관리</li>
          <li>공공조달 관리실무</li>
        </ul>
        <p className="text-xs text-gray-400 mt-2">※ 실제 과목·토픽·카드는 관리자가 등록한 내용으로 제공됩니다.</p>
      </div>
    </div>
  )
}
