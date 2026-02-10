import { render } from 'preact';
import App from './ui/App';
import './styles.css';

const boot = document.getElementById('boot');
const setBootMessage = (title: string, subtitle: string) => {
  if (!boot) return;
  const titleEl = boot.querySelector('.boot-title');
  const subtitleEl = boot.querySelector('.boot-subtitle');
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
};

window.addEventListener('error', (event) => {
  setBootMessage('Something went wrong', event.message || 'App failed to load.');
});
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason || 'App failed to load.');
  setBootMessage('Something went wrong', message);
});

const root = document.getElementById('app');
if (root) {
  try {
    render(<App />, root);
    document.body.classList.add('app-ready');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setBootMessage('Something went wrong', message);
  }
}
