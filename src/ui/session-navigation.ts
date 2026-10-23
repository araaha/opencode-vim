import type { Context } from "@opencode/plugin/tui/context"

export function cycleSession(context: Context, direction: -1 | 1) {
  if (context.ui.tabs.enabled()) {
    context.keymap.dispatch(direction === -1 ? "session.tab.previous" : "session.tab.next")
    return
  }

  const route = context.ui.router.current()
  const current = route.type === "session" ? context.data.session.root(route.sessionID) : undefined
  const sessions = context.data.session
    .list()
    .filter((session) => !session.parentID && session.time.archived === undefined)
    .toSorted((a, b) => a.time.created - b.time.created || a.id.localeCompare(b.id))
  if (!sessions.length) return
  const index = sessions.findIndex((session) => session.id === current)
  const next =
    index < 0 ? (direction === -1 ? sessions.length - 1 : 0) : (index + direction + sessions.length) % sessions.length
  if (sessions[next].id === current) return
  context.ui.router.navigate({ type: "session", sessionID: sessions[next].id })
}
