import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';

// Create root element
const root = createRoot(document.getElementById('root'));

// Render the app
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 