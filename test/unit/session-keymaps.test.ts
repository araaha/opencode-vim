import { expect, spyOn, test } from "bun:test"
import { KeyEvent } from "@opentui/core"
import type { Context } from "@opencode/plugin/tui/context"
import { createVimConfig } from "../../src/vim/config"
import { createSessionKeymaps, sessionModeKey } from "../../src/ui/session-keys"

test("Ctrl-C is recognized as an exit key in session mode", () => {
  const context = {
    keymap: {
      mode: { current: () => "opencode-vim.session" },
      pending: () => [],
    },
  } as unknown as Context
  const event = new KeyEvent({
    name: "c",
    ctrl: true,
    meta: false,
    shift: false,
    option: false,
    sequence: "\x03",
    number: false,
    raw: "\x03",
    eventType: "press",
    source: "raw",
  })

  expect(sessionModeKey(context, event, "s", "opencode-vim.session")).toBe("<C-c>")
})

test("session toggle accepts a single normal key or control chord, not a sequence", () => {
  for (const key of ["q", "<C-s>", "<C-c>"]) expect(createVimConfig({ sessionKey: key }).sessionKey).toBe(key)
  expect(createVimConfig({ sessionKey: "gs" }).sessionKey).toBe("s")
})

test("session bindings replace defaults without changing prompt mappings", () => {
  const config = createVimConfig({
    keymaps: {
      normal: { "<Tab>": "x" },
      session: { "<Tab>": "passthrough", "<C-w>w": "switch-panel" },
    },
  })
  const keys = createSessionKeymaps(config, true)
  expect(config.keymaps.normal).toEqual({ "<Tab>": "x" })
  expect(keys.hint).toBe("<C-w>w")
  expect(keys.resolve("<Tab>")).toBe("passthrough")
  expect(keys.accepts("<C-w>")).toBe(true)
  expect(keys.resolve("<C-w>")).toBe("pending")
  expect(keys.resolve("w")).toBe("switch-panel")
})

test("session sequences expire and cancel without consuming later motions", () => {
  const now = spyOn(Date, "now").mockReturnValue(100)
  try {
    const config = createVimConfig({ keymapTimeout: 50, keymaps: { session: { "<C-w>w": "switch-panel" } } })
    const keys = createSessionKeymaps(config, true)
    expect(keys.resolve("<C-w>")).toBe("pending")
    now.mockReturnValue(150)
    expect(keys.resolve("w")).toBeUndefined()
    expect(keys.resolve("<C-w>")).toBe("pending")
    keys.cancel()
    expect(keys.resolve("w")).toBeUndefined()
    expect(keys.resolve("<C-w>")).toBe("pending")
    expect(keys.resolve("j")).toBeUndefined()
    expect(keys.resolve("w")).toBeUndefined()
  } finally {
    now.mockRestore()
  }
})

test("session bindings ignore invalid entries and omit unavailable panel actions", () => {
  const config = createVimConfig({
    keymaps: {
      session: {
        "<Tab>": "passthrough",
        "<C-W>": "switch-panel",
        "": "switch-panel",
        xy: "passthrough",
        z: "insert",
        "<C-w>w": "switch-panel",
      },
    },
  })
  const keys = createSessionKeymaps(config, true)
  expect(keys.hint).toBe("<C-w>w")
  expect(keys.accepts("x")).toBe(false)
  expect(keys.accepts("z")).toBe(false)
  const single = createSessionKeymaps(config, false)
  expect(single.hint).toBe("")
  expect(single.accepts("<C-w>")).toBe(false)
  expect(single.resolve("<Tab>")).toBe("passthrough")
  expect(createSessionKeymaps(createVimConfig({}), true).resolve("<Tab>")).toBe("switch-panel")
})
