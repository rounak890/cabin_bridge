import { useEffect, useState } from 'react';
import { useApp } from './context/AppContext';
import Home from './pages/Home';
import Passenger from './pages/Passenger';
import Crew from './pages/Crew';
import Metrics from './pages/Metrics';
import About from './pages/About';
import Demo from './pages/Demo';
import UrgentButton from './components/UrgentButton';
import OfflineBanner from './components/OfflineBanner';

export default function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || location.pathname || '/');
  const { wsStatus, settings } = useApp();
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(1) || location.pathname || '/');
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const wrongWorkspace = (route.startsWith('/passenger') && settings.role !== 'passenger') ||
    (route.startsWith('/crew') && settings.role !== 'crew');
  const page = wrongWorkspace ? <Home /> : route.startsWith('/passenger') ? <Passenger /> : route.startsWith('/crew') ? <Crew /> :
    route.startsWith('/metrics') ? <Metrics /> : route.startsWith('/about') ? <About /> :
    route.startsWith('/demo') ? <Demo /> : <Home />;
  const showNavigation = settings.languageChosen && Boolean(settings.role);
  return <div className="app-shell">
    <header className={`nav ${showNavigation ? '' : 'nav-welcome'}`}><a className="nav-logo" href="#/">✈ CabinBridge</a>
      {showNavigation && <><nav className="nav-links" aria-label="Main navigation">
        <a className="nav-link" href={settings.role === 'crew' ? '#/crew' : '#/passenger'}>{settings.role === 'crew' ? 'Crew workspace' : 'Passenger workspace'}</a>
        <a className="nav-link" href="#/">Switch workspace</a><a className="nav-link" href="#/metrics">Metrics</a><a className="nav-link" href="#/about">About</a>
      </nav><span className={`connection-chip ${wsStatus}`}>{wsStatus}</span></>}
    </header>
    <OfflineBanner />
    {route.startsWith('/passenger') && settings.role === 'passenger' && <div className="urgent-dock"><UrgentButton /></div>}
    <main>{page}</main>
  </div>;
}
