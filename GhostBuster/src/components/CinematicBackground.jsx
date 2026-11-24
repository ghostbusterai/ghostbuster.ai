import React, { useEffect, useState } from "react"
import { AMBIENT_HERO_VIDEO, SUCCESS_REEL_VIDEO } from "../cinemaAssets"

/**
 * SpaceX-style ambient layer: optional full-bleed video + film grade + soft aurora fallback.
 */
export default function CinematicBackground({
  subdued = false,
  enableVideo = true,
  videoSrc = AMBIENT_HERO_VIDEO,
}) {
  const [activeSrc, setActiveSrc] = useState(videoSrc)
  const [videoOn, setVideoOn] = useState(false)

  useEffect(() => {
    setActiveSrc(videoSrc)
    setVideoOn(enableVideo)
  }, [videoSrc, enableVideo])

  const rootClass = [
    "gb-cinematic-bg",
    subdued ? "gb-cinematic-bg--subdued" : "",
    videoOn ? "gb-cinematic-bg--video" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={rootClass} aria-hidden="true">
      {videoOn ? (
        <video
          className="gb-cinematic-video"
          key={activeSrc}
          src={activeSrc}
          autoPlay
          muted
          loop
          playsInline
          onCanPlay={() => setVideoOn(true)}
          onError={() => {
            if (activeSrc !== SUCCESS_REEL_VIDEO) {
              setActiveSrc(SUCCESS_REEL_VIDEO)
              return
            }
            setVideoOn(false)
          }}
        />
      ) : null}

      <div className="gb-cinematic-film gb-cinematic-film--top" />
      <div className="gb-cinematic-film gb-cinematic-film--bottom" />
      <div className="gb-cinematic-aurora gb-cinematic-aurora--primary" />
      <div className="gb-cinematic-aurora gb-cinematic-aurora--secondary" />
      <div className="gb-cinematic-beam" />
      <div className="gb-cinematic-grid" />
      <div className="gb-cinematic-vignette" />
    </div>
  )
}