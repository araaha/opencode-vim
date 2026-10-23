import { expect, test } from "bun:test"
import { createVimConfig } from "../../src/vim/config"

test("modeIndicator defaults to full and ignores invalid values", () => {
  expect(createVimConfig({}).modeIndicator).toBe("full")
  expect(createVimConfig({ vim: { modeIndicator: "none" } }).modeIndicator).toBe("none")
  expect(createVimConfig({ modeIndicator: "full" }).modeIndicator).toBe("full")
  expect(createVimConfig({ modeIndicator: "invalid" }).modeIndicator).toBe("full")
})

test("modeColors accepts foreground and background colors per mode", () => {
  expect(
    createVimConfig({ vim: { modeColors: { visual: { fg: "#D8A657", bg: "#282828" }, normal: { bg: "#111111" } } } })
      .modeColors,
  ).toEqual({
    visual: { fg: "#D8A657", bg: "#282828" },
    normal: { fg: undefined, bg: "#111111" },
  })
})
