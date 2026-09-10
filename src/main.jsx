import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App';
import './styles.css';
import {AuthProvider} from './context/AuthContext';
import {ThemeProvider} from './context/ThemeContext';
import {MarketplaceProvider} from './context/MarketplaceContext';
import {LanguageProvider} from './context/LanguageContext';
import {ToastProvider} from './components/Toast';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <MarketplaceProvider>
              <BrowserRouter>
                <App/>
              </BrowserRouter>
            </MarketplaceProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ToastProvider>
  </React.StrictMode>
);
