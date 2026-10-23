import { RGBA, TextareaRenderable, type KeyEvent } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import type { EditorContext } from "../src/vim/editor"
import { createVimConfig } from "../src/vim/config"
import { keyNotation } from "../src/vim/keys"
import { createVimState } from "../src/vim/state"
import { createVimeeAdapter } from "../src/vim/vimee"

// Measures the synchronous input path, not end-to-end terminal paint latency.
for (const length of [0, 1000, 10000]) {
  for (const vim of [false, true]) {
    const screen = await createTestRenderer({ width: 80, height: 12 })
    const input = new TextareaRenderable(screen.renderer, {
      id: "benchmark-input",
      width: 80,
      height: 10,
      initialValue: "word ".repeat(length / 5),
    })
    screen.renderer.root.add(input)
    input.focus()
    input.cursorOffset = length
    await screen.renderOnce()
    let reads = 0
    const getText = input.editBuffer.getText.bind(input.editBuffer)
    input.editBuffer.getText = () => {
      reads++
      return getText()
    }
    const adapter = createVimeeAdapter(
      createVimState("insert"),
      createVimConfig({ keymaps: { insert: { "<C-c>": "normal", "<C-s>": "command:prompt.stash" } } }),
      () => {},
    )
    const context: EditorContext = {
      input: () => input,
      widthMethod: screen.renderer.widthMethod,
      colors: {
        selection: RGBA.fromHex("#D8A657"),
        yank: RGBA.fromHex("#00ffff"),
        background: RGBA.fromHex("#242424"),
      },
      setText: (text) => input.editBuffer.replaceText(text),
      submit() {},
      blur() {},
      dispatchCommand: () => ({ ok: false }),
      requestRender: () => screen.renderer.requestRender(),
    }
    const start = performance.now()
    if (vim) adapter.attach(context)
    const attachMs = performance.now() - start
    const onKey = (event: KeyEvent) => {
      const key = keyNotation(event)
      if (key && adapter.handle(event, key, context)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    if (vim) screen.renderer.keyInput.prependListener("keypress", onKey)
    reads = 0
    const times: number[] = []
    try {
      for (let index = 0; index < 120; index++) {
        const before = performance.now()
        screen.mockInput.pressKey("x")
        times.push(performance.now() - before)
        await Promise.resolve()
      }
      times.sort((a, b) => a - b)
      console.log(
        JSON.stringify({ length, vim, attachMs, medianMs: times[60], p95Ms: times[114], textReadsPerKey: reads / 120 }),
      )
    } finally {
      screen.renderer.keyInput.off("keypress", onKey)
      adapter.cleanup()
      screen.renderer.destroy()
    }
  }
}
