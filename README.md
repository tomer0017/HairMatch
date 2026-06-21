# מערכת התאמת תוספות

אפליקציית ווב פרימיום בעברית (RTL, mobile-first) לצילום מודרך של תמונות שיער
לפני התאמת תוספות. המערכת מנחה את הלקוחה לצלם חמש תמונות מזוויות שונות, בודקת את
איכות כל תמונה מקומית בדפדפן, ומאפשרת לשתף את התמונות לספר דרך תפריט השיתוף של
המכשיר (למשל וואטסאפ).

> כל העיבוד מתבצע במכשיר בלבד. **שום תמונה אינה נשלחת לשרת, נשמרת בענן או
> נשמרת במסד נתונים.**

## תכונות

- **צילום מודרך** — חמישה שלבים עם כותרת, הנחיה והדגמה ויזואלית.
- **בדיקת איכות מקומית** (Canvas API):
  - תמונה חשוכה מדי (בהירות ממוצעת)
  - תמונה בהירה מדי / נשרפת (white clipping)
  - תמונה מטושטשת (Laplacian variance)
  - רזולוציה נמוכה מדי
- **מסך סיכום** עם רשת תמונות, אפשרות לצלם כל תמונה מחדש.
- **שיתוף** דרך Web Share API (`navigator.canShare`), עם נפילה חיננית להורדת
  קבצים בודדים או הורדת ZIP (JSZip) כשהשיתוף הישיר אינו נתמך.

## סטאק טכנולוגי

React · TypeScript · Vite · Modern CSS · Browser Camera API · Canvas API ·
Web Share API · JSZip. ללא backend, ללא בסיס נתונים, ללא אימות.

## הרצה מקומית

```bash
npm install
npm run dev
```

> **חשוב:** גישה למצלמה דורשת הקשר מאובטח. `npm run dev` עובד על `localhost`.
> כדי לבדוק ממכשיר נייד אמיתי יש להגיש דרך HTTPS (למשל באמצעות פריסה או טאנל).

## בנייה לפרודקשן

```bash
npm run build      # מפיק תיקיית dist/
npm run preview    # תצוגה מקומית של תוצרי הבנייה
```

## פריסה

הפרויקט מוכן לפריסה מיידית ב‑**Vercel** או ב‑**Netlify** (קיימים
`vercel.json` ו‑`netlify.toml`). מספיק לחבר את הריפו — אין צורך במשתני סביבה.

## מבנה הפרויקט

```
src/
  components/   LandingPage, ProgressBar, CameraCapture, PhotoInstructions,
                QualityFeedback, FinalReview, ShareActions, StepCard, PoseGuide
  hooks/        useCamera, usePhotoValidation
  utils/        imageAnalysis, brightness, sharpness, fileHelpers
  pages/        Landing, CaptureFlow, Review
  config/       steps (הגדרת חמשת שלבי הצילום)
  types/        טיפוסים משותפים
  styles/       global.css (מערכת העיצוב)
```

## מגבלות דפדפן

- **Web Share API עם קבצים** זמין בעיקר ב‑Safari ו‑Chrome בנייד ומעל HTTPS.
  כשאינו נתמך מוצגת חלופת הורדה.
- **getUserMedia** דורש הקשר מאובטח (HTTPS / localhost).
- בדיקות האיכות הן היוריסטיות ומכוונות בסלחנות כדי להימנע מפסילות שווא.
