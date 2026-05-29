import { AnimatePresence } from 'framer-motion'
import LockScreen from './components/lockscreen/LockScreen'
import { ThemeProvider } from './theme/ThemeProvider'

function App() {
  return (
    <ThemeProvider>
      <div className="relative w-full h-full overflow-hidden">
        <AnimatePresence mode="wait">
          <LockScreen key="lock-screen" />
        </AnimatePresence>
      </div>
    </ThemeProvider>
  )
}

export default App
