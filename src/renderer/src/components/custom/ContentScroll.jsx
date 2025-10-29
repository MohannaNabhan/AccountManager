import { useRef, useEffect, useState } from 'react'

function ContentScroll({
  children,
  mainClass,
  className,
  onNearBottom,
  onBottom,
  onTop,
  ...props
}) {
  const divRef = useRef(null)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)

  useEffect(() => {
    const div = divRef.current
    if (!div) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = div
      setShowTopFade(scrollTop > 10) // Show fade if scrolled more than 10px
      setShowBottomFade(scrollTop < scrollHeight - clientHeight - 10) // Show fade if not at the bottom
      if (onBottom && scrollTop >= scrollHeight - clientHeight - 10) {
        if (onBottom instanceof Function) onBottom()
      }
      if (onTop && scrollTop <= 10) {
        if (onTop instanceof Function) onTop()
      }
      if (onNearBottom && scrollTop >= scrollHeight - clientHeight - 100) {
        if (onNearBottom instanceof Function) onNearBottom()
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      handleScroll() // Recalculate on size changes
    })

    div.addEventListener('scroll', handleScroll)
    resizeObserver.observe(div)

    handleScroll() // Initial check

    return () => {
      div.removeEventListener('scroll', handleScroll)
      resizeObserver.unobserve(div)
    }
  }, [children]) // Rerun when children change

  return (
    <div className={`h-full w-full _no_move relative ${mainClass}`}>
      {/* Top Fade */}
      {showTopFade && (
        <div className="h-12 left-0 top-0 absolute w-full bg-gradient-to-b from-background to-transparent pointer-events-none z-[50]"></div>
      )}
      {/* Bottom Fade */}
      {showBottomFade && (
        <div className="h-14 left-0 bottom-0 absolute w-full bg-gradient-to-t from-background to-transparent pointer-events-none z-[50]"></div>
      )}
      {/* Content */}
      <div ref={divRef} className={`h-full w-full overflow-auto relative ${className}`} {...props}>
        {children}
      </div>
    </div>
  )
}

export default ContentScroll
