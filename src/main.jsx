import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClientProvider} from '@tanstack/react-query';
import {ReactQueryDevtools} from '@tanstack/react-query-devtools';
import App from './App';
import './styles.css';
import './tailwind.css';
import {queryClient} from './queryClient';
import {AuthProvider} from './context/AuthContext';
import {ThemeProvider} from './context/ThemeContext';
import {MarketplaceProvider} from './context/MarketplaceContext';
import {LanguageProvider} from './context/LanguageContext';
import {ToastProvider} from './components/Toast';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
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
      <ReactQueryDevtools initialIsOpen={false}/>
    </QueryClientProvider>
  </React.StrictMode>
);
