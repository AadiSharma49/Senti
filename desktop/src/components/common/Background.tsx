import React from 'react'

/**
 * Flat graphite background. Used to have an animated cyan gradient wash and
 * a tinted grid overlay — that's exactly the "neon" look this was moved
 * away from, so now it's just the flat base plus two neutral (uncolored)
 * micro-textures for a touch of depth without looking lit up.
 */
export default function Background() {
  return (
    <>
      <div className="absolute inset-0 bg-deep-gradient" />
      <div className="absolute inset-0 scanlines" />
      <div className="absolute inset-0 bg-noise" />
    </>
  )
}