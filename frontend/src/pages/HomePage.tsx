import { Link } from 'react-router-dom';
import './home.css';

export default function HomePage() {
  return (
    <div className="home">
      <div className="home__card">
        <p className="home__eyebrow">HR &amp; Payroll Platform</p>
        <h1 className="brand home__title">PeoplePay360</h1>
        <p className="home__tagline">
          An integrated human resource and payroll operations platform.
        </p>

        <Link to="/login" className="home__cta">
          Admin Login
        </Link>

        <p className="home__hint">Accounts are created by an administrator.</p>
      </div>
    </div>
  );
}
