// /api/health — 백엔드(Vercel Function) 동작·라우팅 확인용. 의존성 없음.
// 배포 후 https://smartpps.vercel.app/api/health 가 {ok:true} 면 /api 정상.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    ok: true,
    service: 'smartpps-api',
    time: new Date().toISOString(),
    env: {
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    },
  })
}
