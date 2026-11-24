import React, { useEffect, useState } from "react"
import { Icon } from "../icons"
import { font } from "../theme"
import { NETWORKING_REEL_ARIA_LABEL, NETWORKING_SUCCESS_STORIES } from "../networkingStories"

const SLIDE_MS = 5500

/**
 * Silent, full-bleed reel: networking → job outcomes. No audio.
 * Drop a file at public/promo/networking-success.mp4 to use real footage (muted loop).
 */
export default function NetworkingSuccessReel({
  id = undefined,
  variant = "scroll",
  videoSrc = null,
  stories = NETWORKING_SUCCESS_STORIES,
}) {
  const [index, setIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [videoOk, setVideoOk] = useState(Boolean(videoSrc))

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener?.("change", onChange)
    return () => mq.removeEventListener?.("change", onChange)
  }, [])

  useEffect(() => {
    if (reducedMotion || stories.length < 2) return undefined
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % stories.length)
    }, SLIDE_MS)
    return () => window.clearInterval(t)
  }, [reducedMotion, stories.length])

  useEffect(() => {
    setVideoOk(Boolean(videoSrc))
  }, [videoSrc])

  const showVideo = Boolean(videoSrc && videoOk)
  const rootClass = `gb-success-reel gb-success-reel--${variant}`

  return (
    <section id={id} className={rootClass} aria-label={NETWORKING_REEL_ARIA_LABEL}>
      {videoSrc ? (
        <video
          className={`gb-success-reel__video${showVideo ? " gb-success-reel__video--on" : ""}`}
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
          onCanPlay={() => setVideoOk(true)}
          onError={() => setVideoOk(false)}
        />
      ) : null}

      <div className={`gb-success-reel__slides${showVideo ? " gb-success-reel__slides--under-video" : ""}`}>
        {stories.map((s, i) => (
          <article
            key={s.id}
            className={`gb-success-reel__slide${i === index ? " gb-success-reel__slide--active" : ""}`}
            style={{ "--story-hue": s.hue || "200, 255, 90" }}
          >
            <div className="gb-success-reel__slide-glow" />
            <div className="gb-success-reel__slide-inner">
              <div className="gb-success-reel__avatar-wrap">
                {s.photo ? (
                  <img className="gb-success-reel__avatar" src={s.photo} alt="" />
                ) : (
                  <span
                    className="gb-success-reel__avatar gb-success-reel__avatar--initials"
                    style={{
                      background: `linear-gradient(145deg, rgba(${s.hue},0.35), rgba(${s.hue},0.08))`,
                      border: `1px solid rgba(${s.hue},0.45)`,
                      fontFamily: font.h1,
                      fontWeight: 800,
                      fontSize: 28,
                    }}
                  >
                    {s.initials}
                  </span>
                )}
              </div>
              <p className="gb-success-reel__chapter">{s.chapter}</p>
              <h2 className="gb-success-reel__name">{s.name}</h2>
              <p className="gb-success-reel__detail">{s.detail}</p>
              <p className="gb-success-reel__networking">{s.networking}</p>
              <div className="gb-success-reel__outcome">
                <span className="gb-success-reel__outcome-check" aria-hidden>
                  <Icon name="check" size={16} color="var(--gb-accent-bright)" />
                </span>
                <div>
                  <strong className="gb-success-reel__outcome-label">{s.outcome}</strong>
                  <span className="gb-success-reel__outcome-sub">{s.company}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className={`gb-success-reel__caption${variant === "wide" ? " gb-success-reel__caption--wide" : ""}`}>
        {variant === "wide" ? (
          "Meet people, follow up consistently, land the role."
        ) : (
          <>
            Example flows · <span className="gb-success-reel__accent">your story can go here</span>
          </>
        )}
      </p>

      {!showVideo && stories.length > 1 && (
        <div className="gb-success-reel__dots" role="tablist" aria-label="Story progress">
          {stories.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${s.name}, ${s.outcome}`}
              className={`gb-success-reel__dot${i === index ? " gb-success-reel__dot--active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}