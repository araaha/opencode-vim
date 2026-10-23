import assert from "node:assert/strict"
import type { Fixture } from "../support/fixture"

export async function sessionNavigation({ terminal, request, workspace, probe, sessionID }: Fixture) {
  const second = (await request("/api/session", { title: "Cycle second", location: { directory: workspace } })).data
  const third = (await request("/api/session", { title: "Cycle third", location: { directory: workspace } })).data
  await terminal.type("iunchanged draft")
  await terminal.keys("Escape")
  await terminal.type("J")
  await terminal.screen("cycle-wrap-previous", async () => (await probe()).route.sessionID === third.id)
  await terminal.type("J")
  await terminal.screen("cycle-previous", async () => (await probe()).route.sessionID === second.id)
  await terminal.type("K")
  await terminal.screen("cycle-next", async () => (await probe()).route.sessionID === third.id)
  await terminal.type("K")
  await terminal.screen("cycle-wrap-next", async () => (await probe()).route.sessionID === sessionID)
  await terminal.screen("cycle-draft-restored", async () => (await probe()).editor.text === "unchanged draft")

  for (const mode of ["v", "V"]) {
    await terminal.type(mode)
    await terminal.screen(`selection-${mode}`, async () => (await probe()).editor.selected)
    const editor = (await probe()).editor
    assert.equal(editor.selectionFg.toLowerCase(), "#242424")
    assert.equal(editor.selectionBg.toLowerCase(), "#d8a657")
    await terminal.keys("Escape")
  }
}
