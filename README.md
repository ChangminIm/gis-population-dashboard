# 시군구별 인구 통계 대시보드

통계청 SGIS 오픈플랫폼 API를 활용한 시군구별 인구 통계 지도 대시보드입니다.

## 주요 기능

- 전국 시도 → 시군구 드릴다운 코로플레스 지도
- 인구 수 / 인구 밀도 (명/㎢) 전환 시각화
- Natural Breaks (Jenks) 7단계 분류
- YlOrRd 색상 스키마
- 연도별 인구 추이 차트 (2015~2023)
- 지역 클릭 시 상세 통계 표시

## 기술 스택

| 역할 | 기술 |
|------|------|
| 백엔드 | Python Flask (SGIS API 프록시 + 좌표 변환) |
| 프론트엔드 | React + Vite |
| 지도 | React-Leaflet |
| 차트 | Recharts |
| 스타일 | Tailwind CSS |
| 좌표 변환 | pyproj (EPSG:5179 → WGS84) |

## 시작하기

### 1. SGIS API 키 발급

[SGIS 오픈플랫폼 개발자센터](https://sgis.kostat.go.kr/developer) 에서 회원가입 후 서비스 신청

### 2. 백엔드 설정

```bash
cd backend
pip install -r requirements.txt

# .env.example을 복사하여 API 키 입력
cp .env.example .env
# .env 파일을 열어 실제 키 값 입력
```

### 3. 프론트엔드 설정

```bash
cd frontend
npm install
```

### 4. 실행

```bash
# 백엔드 (터미널 1)
cd backend
python app.py

# 프론트엔드 (터미널 2)
cd frontend
npm run dev
```

브라우저에서 http://localhost:5173 접속

## 배포 (Vercel)

백엔드와 프론트엔드를 각각 별도 Vercel 프로젝트로 배포합니다.

### 백엔드
- Vercel 환경변수에 `SGIS_CONSUMER_KEY`, `SGIS_CONSUMER_SECRET` 설정

### 프론트엔드
- `frontend/vite.config.js`의 proxy target을 배포된 백엔드 URL로 변경
