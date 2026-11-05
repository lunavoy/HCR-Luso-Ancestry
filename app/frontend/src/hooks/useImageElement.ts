import { useEffect, useState } from 'react'

export function useImageElement(source: string) {
  const [state, setState] = useState<{ source: string; image?: HTMLImageElement; error: boolean }>({
    source: '',
    error: false,
  })

  useEffect(() => {
    const nextImage = new Image()
    nextImage.onload = () => setState({ source, image: nextImage, error: false })
    nextImage.onerror = () => setState({ source, error: true })
    nextImage.src = source
    return () => {
      nextImage.onload = null
      nextImage.onerror = null
    }
  }, [source])

  return state.source === source
    ? { image: state.image, error: state.error }
    : { image: undefined, error: false }
}
