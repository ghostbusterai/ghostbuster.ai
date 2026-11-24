import React from "react"
import { font } from "../theme"
import CinematicBackground from "./CinematicBackground"
import GhostBusterLogo from "./GhostBusterLogo"
import BrandName from "./BrandName"

export default function AppLoading() {
  return (
    <div className="gb-app gb-app--fullscreen gb-app--cinema">
      <CinematicBackground />
      <div className="gb-app-content gb-loading-screen">
        <div className="gb-loading-mark">
          <span className="gb-loading-logo-ring">
            <GhostBusterLogo size={40} />
          </span>
          <BrandName variant="login" />
        </div>
        <p className="gb-loading-text" style={{ fontFamily: font.body }}>
          Warming up your network…
        </p>
        <div className="gb-loading-bar" role="progressbar" aria-label="Loading">
          <motionBar />
        </div>
      </div>
    </div>
  )
}

function motionBar() {
  return <div className="gb-loading-bar-fill" />
}