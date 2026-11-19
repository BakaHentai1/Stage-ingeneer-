import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/unbounded/500.css';
import '@fontsource/unbounded/700.css';
import './styles.css';
import { App } from './app';

registerSW({ immediate: true });
render(<App />, document.getElementById('app')!);
