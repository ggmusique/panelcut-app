import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { LangProvider } from './i18n';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><LangProvider><AuthProvider><App /></AuthProvider></LangProvider></React.StrictMode>);
