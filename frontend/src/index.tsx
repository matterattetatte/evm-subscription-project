import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import AppKitProvider from '@/providers/AppKitProviders'

const container = document.getElementById('root')
const root = createRoot(container!)

root.render(
  <StrictMode>
    <AppKitProvider>
      <App />
    </AppKitProvider>
  </StrictMode>
)
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}
