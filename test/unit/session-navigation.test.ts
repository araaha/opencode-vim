import { expect, test } from "bun:test"
import type { Context } from "@opencode/plugin/tui/context"
import { cycleSession } from "../../src/ui/session-navigation"

function fixture(current: string | undefined = "middle", tabs = false) {
  const sessions = [
    { id: "newest", time: { created: 3 } },
    { id: "child", parentID: "middle", time: { created: 4 } },
    { id: "archived", time: { created: 5, archived: 0 } },
    { id: "oldest", time: { created: 1 } },
    { id: "middle", time: { created: 2 } },
  ]
  const navigated: Array<{ type: string; sessionID: string }> = []
  const dispatched: string[] = []
  const context = {
    ui: {
      tabs: { enabled: () => tabs },
      router: {
        current: () => (current ? { type: "session", sessionID: current } : { type: "home" }),
        navigate: (route: { type: string; sessionID: string }) => navigated.push(route),
      },
    },
    data: { session: { list: () => sessions, root: (id: string) => (id === "child" ? "middle" : id) } },
    keymap: { dispatch: (command: string) => dispatched.push(command) },
  } as unknown as Context
  return { sessions, navigated, dispatched, context }
}

test("cycles root sessions in creation order with tabs disabled without mutating the cache", () => {
  const f = fixture()
  const original = f.sessions.map((session) => session.id)
  cycleSession(f.context, -1)
  cycleSession(f.context, 1)
  expect(f.navigated).toEqual([
    { type: "session", sessionID: "oldest" },
    { type: "session", sessionID: "newest" },
  ])
  expect(f.sessions.map((session) => session.id)).toEqual(original)
  expect(f.dispatched).toEqual([])
})

test("wraps around while excluding archived and child sessions", () => {
  const oldest = fixture("oldest")
  cycleSession(oldest.context, -1)
  expect(oldest.navigated[0].sessionID).toBe("newest")
  const newest = fixture("newest")
  cycleSession(newest.context, 1)
  expect(newest.navigated[0].sessionID).toBe("oldest")
})

test("uses the current root when navigating from a subagent", () => {
  const f = fixture("child")
  cycleSession(f.context, -1)
  expect(f.navigated[0].sessionID).toBe("oldest")
})

test("from Home, previous opens the newest and next opens the oldest", () => {
  const f = fixture()
  f.context.ui.router.current = () => ({ type: "home" })
  cycleSession(f.context, -1)
  cycleSession(f.context, 1)
  expect(f.navigated.map((route) => route.sessionID)).toEqual(["newest", "oldest"])
})

test("does nothing when no other session is available", () => {
  const f = fixture("newest")
  f.sessions.splice(1)
  cycleSession(f.context, -1)
  expect(f.navigated).toEqual([])
  f.sessions.length = 0
  cycleSession(f.context, 1)
  expect(f.navigated).toEqual([])
})

test("preserves native tab cycling when tabs are enabled", () => {
  const f = fixture("middle", true)
  cycleSession(f.context, -1)
  cycleSession(f.context, 1)
  expect(f.dispatched).toEqual(["session.tab.previous", "session.tab.next"])
  expect(f.navigated).toEqual([])
})
