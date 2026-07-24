import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

// Change these to your real support channels before going live.
const WHATSAPP_NUMBER = '233240000000'; // e.g. 233 24 000 0000
const SUPPORT_EMAIL = 'hello@int.app';

const FEATURES = [
  { icon: '🧾', title: 'Sell from any phone', text: 'A fast tablet/phone till that works even with no internet — sales sync when you’re back online.' },
  { icon: '💰', title: 'Know your money', text: 'Cash on hand, who owes you, and profit — always up to date, in Ghana cedis.' },
  { icon: '🤝', title: 'Your AI COO', text: 'INT watches your shop and tells you what to do: chase a debt, restock, or celebrate a good day.' },
  { icon: '📩', title: 'Capture MoMo', text: 'Paste a MoMo or bank message and INT records it as cash-in or an expense.' },
  { icon: '📦', title: 'Snap to add stock', text: 'Take a photo of a shelf or delivery and INT lists the items for you.' },
  { icon: '🔔', title: 'Daily briefings', text: 'A morning and evening summary of your business — even when you’re away.' },
];

const STEPS = [
  { n: '1', title: 'Create your shop', text: 'Sign up with your name, shop name and a password. Takes a minute.' },
  { n: '2', title: 'Add your products', text: 'Type them in, or snap a photo and let INT do it. Set prices and costs once.' },
  { n: '3', title: 'Start selling', text: 'Ring up sales at the till. INT tracks cash, stock, debts and profit for you.' },
];

const FAQS = [
  { q: 'Does it work without internet?', a: 'Yes. The till works fully offline — sales are saved on the device and sync automatically once you’re back online.' },
  { q: 'Is my data safe?', a: 'Your shop’s data is private to your account. It’s stored securely and never shared with other shops.' },
  { q: 'Do I need a computer?', a: 'No. INT runs on any phone or tablet. Add it to your home screen and it works like an app.' },
  { q: 'What does it cost?', a: 'You can start free. AI features (chat, insights, photo scans) run on credits you can top up later.' },
  { q: 'Can my workers use it?', a: 'Yes — add cashiers with their own PIN. You stay the owner; they just run the till.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const signup = () => navigate('/login?signup=1');
  const signin = () => navigate('/login');
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi INT, I’d like to know more.')}`;

  return (
    <div className="lp">
      <header className="lp__nav">
        <div className="lp__logo">INT<span>.</span></div>
        <button className="lp__nav-btn" onClick={signin}>Sign in</button>
      </header>

      <section className="lp__hero">
        <div className="lp__orb" aria-hidden />
        <h1 className="lp__title">Your shop’s AI business partner</h1>
        <p className="lp__subtitle">
          INT helps you sell, track your money, and know exactly how your shop is doing —
          right from your phone. Built for shops in Ghana.
        </p>
        <div className="lp__cta">
          <button className="lp__btn lp__btn--primary" onClick={signup}>Create your shop</button>
          <button className="lp__btn" onClick={signin}>I already have an account</button>
        </div>
        <p className="lp__hero-note">Free to start · Works offline · No computer needed</p>
      </section>

      <section className="lp__section">
        <h2 className="lp__h2">Everything you need to run your shop</h2>
        <div className="lp__features">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp__feature">
              <div className="lp__feature-icon" aria-hidden>{f.icon}</div>
              <div className="lp__feature-title">{f.title}</div>
              <div className="lp__feature-text">{f.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp__section lp__section--alt">
        <h2 className="lp__h2">Up and running in 3 steps</h2>
        <div className="lp__steps">
          {STEPS.map((s) => (
            <div key={s.n} className="lp__step">
              <div className="lp__step-n">{s.n}</div>
              <div>
                <div className="lp__step-title">{s.title}</div>
                <div className="lp__step-text">{s.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="lp__center"><button className="lp__btn lp__btn--primary" onClick={signup}>Create your shop</button></div>
      </section>

      <section className="lp__section">
        <h2 className="lp__h2">Questions?</h2>
        <div className="lp__faqs">
          {FAQS.map((f) => (
            <details key={f.q} className="lp__faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp__contact">
        <h2 className="lp__h2">Need a hand?</h2>
        <p className="lp__contact-text">We’re happy to help you get set up — we can even do it for you.</p>
        <div className="lp__cta">
          <a className="lp__btn lp__btn--wa" href={waLink} target="_blank" rel="noreferrer">💬 Chat on WhatsApp</a>
          <a className="lp__btn" href={`mailto:${SUPPORT_EMAIL}`}>Email us</a>
        </div>
      </section>

      <footer className="lp__footer">
        <div className="lp__logo">INT<span>.</span></div>
        <div className="lp__footer-text">Your shop’s AI business partner · Made for Ghana 🇬🇭</div>
        <button className="lp__nav-btn" onClick={signup}>Create your shop</button>
      </footer>
    </div>
  );
}
