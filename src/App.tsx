import { useEffect } from 'react'
import { GearboxSelector } from './pages/GearboxSelector'

function App() {
  // Lock application to light theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  return <GearboxSelector />;
}

export default App
