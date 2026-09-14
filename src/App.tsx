import { Toaster } from '@/components/ui/sonner'
import { Layout } from '@/app/Layout'
import { TooltipProvider } from '@/components/ui/tooltip'

function App() {
  return (
    <TooltipProvider delayDuration={0}>
      <Layout />
      <Toaster richColors position="top-center" />
    </TooltipProvider>
  )
}

export default App