import { useState } from 'react'

export function YouTubeEmbed({ id }: { id: string }) {
  const [playing, setPlaying] = useState(false)
  const label = `Play YouTube video ${id}`

  return <figure className="nexus-youtube" aria-label={`YouTube video ${id}`}>
    {playing
      ? <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={`YouTube video ${id}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allowFullScreen
        />
      : <button className="nexus-youtube-poster" type="button" aria-label={label} onClick={() => setPlaying(true)}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" draggable="false" />
          <span className="nexus-youtube-play" aria-hidden="true"><span /></span>
        </button>}
  </figure>
}
