import type { Context } from "@opencode/plugin/tui/context"

// Test-only timings. Records no key values, prompt text, or session content.
export function createInputProfile(context: Context) {
  let starts: number[] = []
  let firstFrameMs: number | undefined
  let pending: number[] = []
  let handling: number[] = []
  let frames: number[] = []
  const onKey = () => {
    const start = performance.now()
    starts.push(start)
    pending.push(start)
    queueMicrotask(() => handling.push(performance.now() - start))
  }
  const onFrame = () => {
    const now = performance.now()
    for (const start of pending) {
      const elapsed = now - start
      firstFrameMs ??= elapsed
      frames.push(elapsed)
    }
    pending = []
  }
  function stop() {
    context.renderer.keyInput.off("keypress", onKey)
    context.renderer.off("frame", onFrame)
  }
  function summary(samples: number[]) {
    const sorted = samples.toSorted((a, b) => a - b)
    return {
      count: sorted.length,
      medianMs: sorted[Math.floor(sorted.length / 2)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      maxMs: sorted.at(-1),
    }
  }
  return {
    start() {
      stop()
      starts = []
      pending = []
      handling = []
      frames = []
      firstFrameMs = undefined
      context.renderer.keyInput.prependListener("keypress", onKey)
      context.renderer.on("frame", onFrame)
    },
    stop,
    result() {
      stop()
      return { keys: starts.length, firstFrameMs, handling: summary(handling), frameLatency: summary(frames) }
    },
  }
}
