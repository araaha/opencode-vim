/** @jsxImportSource @opentui/solid */
import type { TextRenderable } from "@opentui/core"
import type { Accessor } from "solid-js"
import type { VimMode } from "./state"
import type { VimModeColor } from "./config"

type VimStatusProps = {
  mode: Accessor<VimMode>
  enabled: Accessor<boolean>
  colors: Partial<Record<VimMode, VimModeColor>>
  theme: {
    success: TextRenderable["fg"]
    warning: TextRenderable["fg"]
  }
}

export function VimStatus(props: VimStatusProps) {
  const modeColor = () => props.colors[props.mode()]
  return (
    <box paddingRight={1} flexDirection="row" flexShrink={0}>
      <text
        fg={
          modeColor()?.fg ??
          (props.mode() === "visual" || props.mode() === "visual-line"
            ? "#D8A657"
            : props.mode() === "insert"
              ? props.theme.success
              : props.theme.warning)
        }
        bg={modeColor()?.bg}
      >
        {props.enabled() ? ` ${modeLabel(props.mode())} ` : ""}
      </text>
    </box>
  )
}

function modeLabel(mode: VimMode) {
  if (mode === "visual") return "VISUAL"
  if (mode === "visual-line") return "VISUAL LINE"
  return mode === "normal" ? "NORMAL" : "INSERT"
}
