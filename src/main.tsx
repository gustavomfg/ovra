import { createRoot } from 'react-dom/client'

import App from '@/App'
import '@/styles/global.css'

// No StrictMode: several React Bits shaders release their WebGL context on unmount, so the
// dev-only mount → unmount → mount cycle leaves them drawing into a lost (white) context.
createRoot(document.getElementById('root')!).render(<App />)
