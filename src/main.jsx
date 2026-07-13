import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@aws-amplify/ui-react/styles.css'
import './lib/amplifyConfig'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
