import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Github, Minus, Square, Maximize2, X } from 'lucide-react'

export default function WindowFrame({ children }) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const m = await window.api.window.isMaximized()
        setIsMaximized(!!m)
      } catch {}
    })()
  }, [])

  async function handleToggleMaximize() {
    try {
      await window.api.window.toggleMaximize()
      const m = await window.api.window.isMaximized()
      setIsMaximized(!!m)
    } catch {}
  }

  return (
    <div className="w-screen h-screen relative overflow-hidden   flex flex-col ">
      <div className="flex items-center justify-between py-1 px-2 border-b bg-background select-none _move">
        <div className="flex items-center gap-2 _move">
          <div className="text-sm font-medium _move pointer-events-none">Account Manager By Mohanna Nabhan</div>
          <Github
            className="size-7 rounded-full bg-primary/20 _no_move border border-primary/50 p-1.5 cursor-pointer text-white hover:text-foreground"
            aria-label="GitHub"
            onClick={() => window.api.links.openExternal('https://github.com/MohannaNabhan')}
          />
        </div>
        <div className="ml-auto flex items-center gap-1 h-full _no_move">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Minimizar"
            onClick={() => window.api.window.minimize()}
            className="!px-4"
          >
            <Minus className="size-4" />
          </Button>
          {/*<Button
            variant="ghost"
            size="icon-sm"
            aria-label={isMaximized ? 'Restaurar' : 'Maximizar'}
            onClick={handleToggleMaximize}
          >
            {isMaximized ? <Square className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>*/}
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label="Cerrar"
            onClick={() => window.api.window.close()}
            className="!px-4"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <div className="  relative">{children}</div>
    </div>
  )
}
