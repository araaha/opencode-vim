import assert from "node:assert/strict"
import type { Fixture } from "../support/fixture"

export async function promptLatency({ terminal, probe }: Fixture) {
  for (const vim of [false, true]) {
    await probe("dispatch", { command: "plugins.list" })
    await terminal.screen(`latency-${vim}-plugins`, (text) => text.includes("Plugins") && text.includes("opencode-vim"))
    await terminal.keys("Enter")
    await terminal.screen(`latency-${vim}-toggled`, (text) => text.includes("inactive") !== vim)
    await probe("dismiss")
    if (vim) {
      await terminal.screen(
        "latency-reloaded",
        (text) => !text.includes("Plugins") && (text.includes("NORMAL") || text.includes("INSERT")),
      )
      await terminal.keys("Escape")
      await terminal.type("i")
    }
    await terminal.screen(`latency-${vim}-ready`, (text) => text.includes("INSERT") === vim)
    await probe("dispatch", { command: "prompt.clear" })
    await Bun.sleep(250)
    await probe("input-profile/start")
    for (let index = 0; index < 60; index++) {
      await terminal.type("x")
      await Bun.sleep(1000 / 60)
    }
    await terminal.screen(`latency-${vim}-typed`, async () => (await probe()).editor.text === "x".repeat(60))
    const result = await probe("input-profile/result")
    assert.equal(result.keys, 60)
    console.log(`INPUT_LATENCY ${JSON.stringify({ vim, ...result })}`)
    if (vim) {
      await terminal.keys("Escape")
      await terminal.type("u")
      await terminal.screen("latency-native-undo", async () => (await probe()).editor.text === "")
      await terminal.keys("C-r")
      await terminal.screen("latency-native-redo", async () => (await probe()).editor.text === "x".repeat(60))
      await terminal.type("A")
      await terminal.keys("Left")
      await terminal.type("Z")
      await terminal.keys("C-c")
      await terminal.screen("latency-control-mapping", (text) => text.includes("NORMAL"))
      await terminal.type("u")
      await terminal.screen("latency-cursor-edit-undo", async () => (await probe()).editor.text === "x".repeat(60))
    }
  }
}
