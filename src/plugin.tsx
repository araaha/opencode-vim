/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui/context"
import { KeyEvent, PasteEvent, RGBA, type CursorStyleOptions } from "@opentui/core"
import { createEffect, createSignal, onCleanup, untrack } from "solid-js"
import type { EditorContext } from "./vim/editor"
import { createVimConfig } from "./vim/config"
import { editInput } from "./vim/edit"
import { keyNotation } from "./vim/keys"
import { createVimLog } from "./vim/log"
import { displayToChar } from "./vim/map"
import { createVimState, type VimMode } from "./vim/state"
import { createVimeeAdapter } from "./vim/vimee"
import { VimStatus } from "./vim/status"
import { SESSION_MODE, createSessionMode } from "./ui/session"
import { createVimClipboard } from "./clipboard"
import { createFormMode } from "./ui/form"
import { handleComposerKey } from "./ui/composer"
import { createTerminalControls } from "./ui/terminal"
import { cycleSession } from "./ui/session-navigation"

export default Plugin.define({
  id: "opencode-vim",
  setup(context) {
    context.ui.slot({ append: "app", render: () => <VimHost context={context} /> })
  },
})

function VimHost(props: { context: Context }) {
  const config = createVimConfig(props.context.options)
  const normalMappings = Object.keys(config.keymaps.normal ?? {})
  // With only Ctrl mappings, plain printable keys cannot start an Insert
  // mapping. Keep them on the host's native input path without registry scans.
  const nativeInsertTyping = Object.keys(config.keymaps.insert ?? {}).every((key) => /^<C-[^>]+>/.test(key))
  const log = createVimLog(config)
  const clipboard = createVimClipboard(props.context.renderer)
  const clipboardOptions = {
    onYank: (text: string) => {
      void clipboard.write(text)
    },
    readClipboard: clipboard.read,
  }
  const state = createVimState(config.defaultMode, log)
  const vimee = createVimeeAdapter(state, config, log, clipboardOptions)
  const dialogState = createVimState(config.defaultMode, log)
  const dialogVimee = createVimeeAdapter(dialogState, config, log, clipboardOptions)
  const [dialogFocused, setDialogFocused] = createSignal(false)
  let commandModeRestore: { target: ReturnType<typeof createVimState>; mode: VimMode } | undefined
  let commandModeActive = false
  const promptVim = { state, vimee }
  const dialogVim = { state: dialogState, vimee: dialogVimee }
  let dialogInput: typeof props.context.renderer.currentFocusedEditor = null
  const [saved, setSaved] = props.context.storage.store("state", { initial: { enabled: true } })
  const enabled = () => saved.enabled
  const form = createFormMode(props.context, config, log, enabled)
  const editorContext = createEditorContext(props.context, dispatchVimCommand)
  let cursorMode = ""
  let cursorInput: typeof props.context.renderer.currentFocusedEditor = null
  let originalCursorStyle: CursorStyleOptions | undefined
  const session = createSessionMode(props.context, config, clipboard)
  const terminal = createTerminalControls(
    props.context,
    config,
    log,
    enabled,
    () => session.active() || (state.mode() === "normal" && props.context.keymap.mode.current() === "base"),
  )
  let pendingKeys: Array<KeyEvent | PasteEvent> | undefined
  let disposed = false

  const removeStatus = props.context.ui.slot({
    prepend: "prompt.footer",
    render: (footer) => {
      if (enabled() && terminal.focused()) return <terminal.Status />
      if (footer.mode !== "normal") return null
      if (session.active() && !dialogFocused()) return <session.Status />
      if (config.modeIndicator === "none") return null
      return (
        <VimStatus
          mode={() => (dialogFocused() ? dialogState.mode() : state.mode())}
          enabled={enabled}
          colors={config.modeColors}
          theme={{
            get success() {
              return props.context.theme.text.feedback.success.base
            },
            get warning() {
              return props.context.theme.text.feedback.warning.base
            },
          }}
        />
      )
    },
  })

  props.context.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "opencode-vim.session.previous",
        title: "Previous session",
        group: "Vim",
        run: () => cycleSession(props.context, -1),
      },
      {
        id: "opencode-vim.session.next",
        title: "Next session",
        group: "Vim",
        run: () => cycleSession(props.context, 1),
      },
      {
        id: "opencode-vim.toggle",
        title: "Toggle Vim Mode",
        description: "Enable or disable Vim key handling",
        group: "Vim",
        palette: true,
        slash: { name: "vim" },
        run() {
          const next = !enabled()
          void setSaved((draft) => {
            draft.enabled = next
          })
          if (!next) {
            pendingKeys = undefined
            session.close()
            vimee.suspend()
            dialogVimee.suspend()
          }
          props.context.ui.toast.show({ message: `Vim mode ${next ? "enabled" : "disabled"}`, variant: "info" })
          props.context.renderer.requestRender()
        },
      },
    ],
  }))

  const onKey = (event: KeyEvent) => {
    if (!enabled() || event.defaultPrevented) return
    if (terminal.handle(event)) return
    if (form.handle(event)) return
    if (handleComposerKey(props.context, event)) return
    if (
      nativeInsertTyping &&
      !pendingKeys &&
      promptVim.state.mode() === "insert" &&
      cursorMode === "insert" &&
      cursorInput !== null &&
      props.context.renderer.currentFocusedEditor === cursorInput &&
      props.context.keymap.mode.current() === "base" &&
      !event.ctrl &&
      !event.meta &&
      !event.option &&
      !event.super &&
      !event.hyper &&
      event.name.length === 1 &&
      /^[\x20-\x7e]$/.test(event.name) &&
      !props.context.keymap.pending().length &&
      !promptVim.vimee.isPending() &&
      promptVim.vimee.prepareNativeInsert()
    ) {
      return
    }
    if (pendingKeys) {
      pendingKeys.push(new KeyEvent(event))
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (props.context.keymap.mode.current() === SESSION_MODE) return
    const kind = inputKind(props.context)
    if (!kind) return
    if (props.context.keymap.pending().length) return
    const { state, vimee } = kind === "dialog" ? dialogVim : promptVim
    const key = keyNotation(event)
    if (!key) return
    const vimMode = state.mode()
    const opensCommandPalette =
      kind === "prompt" &&
      key === "<C-p>" &&
      !isCompletionToken(props.context) &&
      props.context.keymap.commands().some((item) => item.id === "command.palette.show")
    if (opensCommandPalette) {
      beginCommandMode(state)
      return
    }
    const mapped = vimMode === "normal" && normalMappings.some((sequence) => sequence.startsWith(key))
    if (kind === "prompt" && key === config.sessionKey && !mapped && vimMode === "normal" && !vimee.isPending()) {
      if (session.enter()) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
    }
    if (passThroughKey(event, key, vimMode, vimee.isPending(), mapped)) return
    if (key === "<Esc>" && vimMode === "normal" && !vimee.isPending()) return

    if (kind === "dialog" && !vimee.isPending() && !mapped && vimMode === "normal") {
      if (key === "<Tab>" || key === "<Home>" || key === "<End>" || key === "<PageUp>" || key === "<PageDown>") return
      const command = key === "j" ? "dialog.select.next" : key === "k" ? "dialog.select.prev" : undefined
      if (command && props.context.keymap.commands().some((item) => item.id === command)) {
        event.preventDefault()
        event.stopPropagation()
        props.context.keymap.dispatch(command)
        return
      }
    }

    if (kind === "prompt" && !vimee.isPending() && sendCompletionKey(event, props.context, key, state.mode())) {
      syncCursor(true)
      return
    }

    const before = state.mode()
    let consumed = false
    try {
      const result = vimee.handle(event, key, editorContext)
      if (typeof result === "boolean") consumed = result
      else {
        consumed = true
        const queued: Array<KeyEvent | PasteEvent> = []
        pendingKeys = queued
        const input = props.context.renderer.currentFocusedEditor
        void result
          .then((handled) => {
            if (pendingKeys !== queued) return
            pendingKeys = undefined
            if (!handled) return
            syncCursor(true)
            // Replay through the host too: a queued i may be followed by native typing.
            for (const event of queued) {
              if (!enabled() || props.context.renderer.currentFocusedEditor !== input) break
              if (event instanceof PasteEvent) props.context.renderer.keyInput.emit("paste", event)
              else props.context.renderer.keyInput.emit("keypress", event)
            }
          })
          .catch((error) => {
            if (pendingKeys === queued) pendingKeys = undefined
            log("vim.clipboard.paste.error", { error: String(error) })
          })
      }
    } finally {
      if (consumed || state.mode() !== before) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    if (consumed) syncCursor(true)
  }

  // Focus events can fire inside the host's prompt effects. Do not subscribe
  // those effects to Vim state or the keymap registry while syncing the editor.
  const onFocus = () =>
    untrack(() => {
      pendingKeys = undefined
      vimee.suspend()
      dialogVimee.suspend()
      syncCursor()
      form.focus()
      // Host focus effects can reset the cursor after this event. Reapply the
      // Vim style once those effects have settled, without changing the mode.
      queueMicrotask(() => {
        if (!disposed) untrack(() => syncCursor(true))
      })
    })
  const onPaste = (event: PasteEvent) => {
    if (event.defaultPrevented) return
    if (!pendingKeys) {
      form.paste(event)
      return
    }
    pendingKeys.push(new PasteEvent(event.bytes, event.metadata))
    event.preventDefault()
    event.stopPropagation()
  }
  props.context.renderer.keyInput.prependListener("keypress", onKey)
  props.context.renderer.keyInput.prependListener("paste", onPaste)
  props.context.renderer.on("focused_editor", onFocus)
  createEffect(() => syncCursor())
  let route = routeKey(props.context.ui.router.current())
  createEffect(() => {
    const next = routeKey(props.context.ui.router.current())
    if (next === route) return
    route = next
    resetMode()
    if (pendingKeys) onFocus()
  })
  onCleanup(() => {
    disposed = true
    pendingKeys = undefined
    removeStatus()
    session.close()
    props.context.renderer.keyInput.off("keypress", onKey)
    props.context.renderer.keyInput.off("paste", onPaste)
    props.context.renderer.off("focused_editor", onFocus)
    vimee.cleanup()
    dialogVimee.cleanup()
    void clipboard.dispose()
    restoreCursor()
  })

  return null

  function beginCommandMode(target: ReturnType<typeof createVimState>) {
    if (!commandModeRestore) {
      commandModeRestore = { target, mode: target.mode() }
      commandModeActive = false
    }
    target.setMode("insert")
  }

  function dispatchVimCommand(command: string) {
    const target = dialogFocused() ? dialogState : state
    beginCommandMode(target)
    const modeBefore = props.context.keymap.mode.current()
    props.context.keymap.dispatch(command)
    if (props.context.keymap.mode.current() !== modeBefore || inputKind(props.context) === "dialog") {
      commandModeActive = true
      return
    }
    if (!commandModeActive && commandModeRestore?.target === target) {
      const previous = commandModeRestore.mode
      commandModeRestore = undefined
      target.setMode(previous)
    }
  }

  function resetMode() {
    untrack(() => {
      if (state.mode() === config.defaultMode) return
      vimee.suspend()
      state.setMode(config.defaultMode)
      syncCursor(true)
    })
  }

  function syncCursor(force = false) {
    const input = props.context.renderer.currentFocusedEditor
    const kind = inputKind(props.context)
    const keymapMode = props.context.keymap.mode.current()
    if (commandModeRestore) {
      if (!commandModeActive && (keymapMode !== "base" || kind === "dialog")) commandModeActive = true
      else if (commandModeActive && keymapMode === "base" && kind !== "dialog") {
        const { target, mode } = commandModeRestore
        commandModeRestore = undefined
        commandModeActive = false
        target.setMode(mode)
      }
    }
    setDialogFocused(kind === "dialog")
    if (!enabled() || !kind || !input) {
      restoreCursor()
      return
    }
    const { state, vimee } = kind === "dialog" ? dialogVim : promptVim
    if (kind === "dialog" && dialogInput !== input) {
      dialogInput = input
      dialogVimee.suspend()
      dialogState.setMode(commandModeActive ? "insert" : promptVim.state.mode())
    }
    const mode = state.mode()
    vimee.attach(editorContext)
    const inputChanged = cursorInput !== input
    if (inputChanged) {
      restoreCursor()
      cursorInput = input
      originalCursorStyle = input.cursorStyle
    }
    if (!force && !inputChanged && cursorMode === mode) return
    input.cursorStyle = config.cursorStyles[mode]
    cursorMode = mode
    props.context.renderer.requestRender()
  }

  function restoreCursor() {
    if (cursorInput && !cursorInput.isDestroyed && originalCursorStyle) cursorInput.cursorStyle = originalCursorStyle
    cursorInput = null
    cursorMode = ""
  }
}

function createEditorContext(context: Context, dispatchVimCommand: (command: string) => void): EditorContext {
  return {
    input: () => (inputKind(context) ? (context.renderer.currentFocusedEditor ?? undefined) : undefined),
    get widthMethod() {
      return context.renderer.widthMethod
    },
    get colors() {
      return {
        selection: RGBA.fromHex("#D8A657"),
        selectionForeground: context.keymap.mode.current() === "modal" ? undefined : RGBA.fromHex("#242424"),
        yank: context.theme.text.feedback.info.base,
        background: context.theme.background.base,
      }
    },
    setText(text) {
      const input = context.renderer.currentFocusedEditor
      if (input) editInput(input, text, context.renderer.widthMethod)
    },
    submit() {
      if (inputKind(context) === "dialog") {
        const command = context.keymap.commands().some((item) => item.id === "dialog.select.submit")
          ? "dialog.select.submit"
          : "dialog.prompt.submit"
        context.keymap.dispatch(command)
      } else {
        context.keymap.dispatch("prompt.submit")
      }
    },
    blur() {
      context.renderer.currentFocusedEditor?.blur()
    },
    dispatchCommand(command) {
      const ok = context.keymap.commands().some((item) => item.id === command)
      if (ok) dispatchVimCommand(command)
      return { ok }
    },
    requestRender: () => context.renderer.requestRender(),
  }
}

function routeKey(route: ReturnType<Context["ui"]["router"]["current"]>) {
  return route.type === "session" ? `session:${route.sessionID}` : route.type
}

function inputKind(context: Context): "prompt" | "dialog" | undefined {
  if (context.keymap.mode.current() === SESSION_MODE) return
  if (!context.renderer.currentFocusedEditor) return
  const commands = context.keymap.commands()
  if (context.keymap.mode.current() === "modal") {
    if (commands.some((item) => item.id === "dialog.select.submit" || item.id === "dialog.prompt.submit"))
      return "dialog"
    return
  }
  if (
    commands.some(
      (item) =>
        item.id === "prompt.submit" || item.id === "prompt.autocomplete.next" || item.id === "prompt.history.previous",
    )
  )
    return "prompt"
}

function passThroughKey(event: KeyEvent, key: string, mode: VimMode, pending: boolean, mapped: boolean) {
  if (key === "<Tab>" && event.shift) return true
  if (mode !== "normal") return false
  if (mapped) return false
  if (event.ctrl && key !== "<C-r>" && key !== "<C-[>") return true
  return event.super === true || event.meta === true || (isArrowKey(key) && !pending)
}

function sendCompletionKey(event: KeyEvent, context: Context, key: string, mode: VimMode) {
  if (mode !== "normal") return false
  const command = key === "j" ? "prompt.autocomplete.next" : key === "k" ? "prompt.autocomplete.prev" : undefined
  if (!command || !isCompletionToken(context) || !context.keymap.commands().some((item) => item.id === command))
    return false
  event.preventDefault()
  event.stopPropagation()
  context.keymap.dispatch(command)
  return true
}

function isCompletionToken(context: Context) {
  const input = context.renderer.currentFocusedEditor
  const text = input?.plainText ?? ""
  const index = displayToChar(text, Math.max(0, input?.cursorOffset ?? 0))
  const before = text.slice(0, Math.min(index + 1, text.length))
  return /^\/\S*$/.test(before) || /(?:^|\s)@\S*$/.test(before)
}

function isArrowKey(key: string) {
  return key === "<Left>" || key === "<Down>" || key === "<Up>" || key === "<Right>"
}
