import logo from '../assets/logo.jpg';
import './LandingPage.css';

interface LandingPageProps {
  onStart: () => void;
}

const TIPS = [
  'צילום באור יום - חובה',
  'לא להצטלם עם שיער רטוב ❌',
  'הימנעי משמש ישירה',
  'נקי את עדשת המצלמה',
  'ודאי שכל השיער נראה בתמונה',
  'הסירי כובעים ואביזרי שיער',
];

/**
 * Welcome screen. Camera permission is intentionally NOT requested here — it is
 * only requested after the user taps "התחילי", per the flow requirements.
 */
export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="landing fade-in">
      <div className="landing__brand">
        <img className="landing__logo" src={logo} alt="Yarin Sasson" />
      </div>

      <header className="landing__header">
        <h1 className="landing__title">מערכת התאמת תוספות שיער</h1>
        <p className="landing__subtitle">
          כדי שנוכל להתאים עבורך את התוספות בצורה המדויקת ביותר, נבקש לצלם מספר
          תמונות שיער ברורות מזוויות שונות.
        </p>
      </header>

      <section className="landing__tips card" aria-label="טיפים לצילום מוצלח">
        <h2 className="landing__tips-title">לתמונות מושלמות</h2>
        <ul className="landing__tips-list">
          {TIPS.map((tip) => (
            <li key={tip} className="landing__tip">
              <span className="landing__tip-check" aria-hidden="true">
                ✓
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className="btn btn-primary landing__cta" onClick={onStart}>
        התחילי
      </button>

      <p className="landing__privacy">
        התמונות נשמרות במכשיר שלך בלבד ואינן נשלחות לשום שרת.
      </p>
    </div>
  );
}
