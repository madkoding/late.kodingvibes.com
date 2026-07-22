import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  '/': 'late.kodingvibes.com — un rinconcito comfy, tarde en la noche',
  '/icecast': 'icecast · late.kodingvibes.com',
  '/irc': 'chat · late.kodingvibes.com',
}

export default function useDocumentTitle(fallback?: string) {
  const { pathname } = useLocation()
  useEffect(() => {
    const title = PAGE_TITLES[pathname] ?? fallback ?? PAGE_TITLES['/']
    document.title = title
  }, [pathname, fallback])
}
