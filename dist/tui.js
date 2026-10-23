// @bun
// src/plugin.tsx
import { createComponent as _$createComponent10 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { Plugin } from "opentui:runtime-module:%40opencode%2Fplugin%2Ftui";
import { KeyEvent as KeyEvent3, PasteEvent as PasteEvent2, RGBA as RGBA3 } from "opentui:runtime-module:%40opentui%2Fcore";
import { createEffect as createEffect5, createSignal as createSignal6, onCleanup as onCleanup9, untrack as untrack5 } from "opentui:runtime-module:solid-js";

// src/vim/config.ts
import { parseKeySequence } from "@vimee/core";
var DEFAULT_CURSOR_STYLES = {
  insert: {
    style: "line",
    blinking: true
  },
  normal: {
    style: "block",
    blinking: true
  },
  visual: {
    style: "block",
    blinking: true
  },
  "visual-line": {
    style: "block",
    blinking: true
  }
};
function createVimConfig(options) {
  const input = readOptions(options);
  return {
    defaultMode: input.defaultMode ?? "insert",
    diffView: input.diffView ?? "after",
    sessionKey: input.sessionKey ?? "s",
    modeIndicator: input.modeIndicator ?? "full",
    keymapTimeout: Math.max(0, input.keymapTimeout ?? 500),
    cursorStyles: {
      insert: {
        ...DEFAULT_CURSOR_STYLES.insert,
        ...input.cursorStyles?.insert
      },
      normal: {
        ...DEFAULT_CURSOR_STYLES.normal,
        ...input.cursorStyles?.normal
      },
      visual: {
        ...DEFAULT_CURSOR_STYLES.visual,
        ...input.cursorStyles?.visual
      },
      "visual-line": {
        ...DEFAULT_CURSOR_STYLES["visual-line"],
        ...input.cursorStyles?.["visual-line"]
      }
    },
    modeColors: input.modeColors ?? {},
    debug: input.debug ?? process.env.VIM_PROMPT_DEBUG === "1",
    debugPath: input.debugPath,
    keymaps: input.keymaps ?? {}
  };
}
function readOptions(options) {
  if (!options || typeof options !== "object")
    return {};
  const raw = "vim" in options ? options.vim : options;
  if (!raw || typeof raw !== "object")
    return {};
  const source = raw;
  return {
    defaultMode: isMode(source.defaultMode) ? source.defaultMode : undefined,
    diffView: source.diffView === "after" || source.diffView === "before" || source.diffView === "diff" ? source.diffView : undefined,
    sessionKey: readSessionKey(source.sessionKey),
    modeIndicator: source.modeIndicator === "full" || source.modeIndicator === "none" ? source.modeIndicator : undefined,
    keymapTimeout: readNumber(source.keymapTimeout),
    cursorStyles: readCursorStyles(source.cursorStyles),
    modeColors: readModeColors(source.modeColors),
    debug: typeof source.debug === "boolean" ? source.debug : undefined,
    debugPath: typeof source.debugPath === "string" ? source.debugPath : undefined,
    keymaps: readKeymaps(source.keymaps)
  };
}
function readModeColors(input) {
  if (!input || typeof input !== "object")
    return;
  const source = input;
  const result = {};
  for (const mode of ["insert", "normal", "visual", "visual-line"]) {
    const value = source[mode];
    if (!value || typeof value !== "object")
      continue;
    const color = value;
    result[mode] = {
      fg: typeof color.fg === "string" ? color.fg : undefined,
      bg: typeof color.bg === "string" ? color.bg : undefined
    };
  }
  return result;
}
function readSessionKey(input) {
  if (typeof input !== "string")
    return;
  try {
    if (parseKeySequence(input).length === 1)
      return input;
  } catch {}
}
function readKeymaps(input) {
  if (!input || typeof input !== "object")
    return;
  const source = input;
  const keymaps = {};
  for (const mode of ["insert", "normal", "visual", "visual-line", "panes"]) {
    const raw = source[mode];
    if (!raw || typeof raw !== "object")
      continue;
    keymaps[mode] = {};
    for (const [key, action] of Object.entries(raw)) {
      if (isMappedAction(action))
        keymaps[mode][key] = action;
    }
  }
  if (source.session && typeof source.session === "object") {
    keymaps.session = {};
    for (const [key, action] of Object.entries(source.session)) {
      if (action === "switch-panel" || action === "passthrough")
        keymaps.session[key] = action;
    }
  }
  return keymaps;
}
function readCursorStyles(input) {
  if (!input || typeof input !== "object")
    return;
  const source = input;
  return {
    insert: readCursorStyle(source.insert),
    normal: readCursorStyle(source.normal),
    visual: readCursorStyle(source.visual),
    "visual-line": readCursorStyle(source["visual-line"])
  };
}
function readCursorStyle(input) {
  if (!input || typeof input !== "object")
    return;
  const source = input;
  if (!isCursorStyle(source.style))
    return;
  return {
    style: source.style,
    blinking: typeof source.blinking === "boolean" ? source.blinking : undefined
  };
}
function isCursorStyle(value) {
  return value === "block" || value === "line" || value === "underline" || value === "default";
}
function isMode(value) {
  return value === "insert" || value === "normal" || value === "visual" || value === "visual-line";
}
function isMappedAction(value) {
  return typeof value === "string" && value.length > 0;
}
function readNumber(value) {
  return typeof value === "number" ? value : undefined;
}

// src/vim/graphemes.ts
var segments = new Intl.Segmenter(undefined, {
  granularity: "grapheme"
});
function createGraphemeCodec() {
  const encoded = new Map;
  const decoded = new Map;
  let next = 57344;
  function encodeGrapheme(segment) {
    const code = segment.charCodeAt(0);
    if (segment.length === 1 && (code < 57344 || code > 63743))
      return segment;
    let token = encoded.get(segment);
    if (!token) {
      if (next > 63743)
        throw new Error("Vim grapheme dictionary is full");
      token = String.fromCharCode(next++);
      encoded.set(segment, token);
      decoded.set(token, segment);
    }
    return token;
  }
  return {
    encodeGrapheme,
    encode(text) {
      if (text.length === 1)
        return encodeGrapheme(text);
      let result = "";
      for (const {
        segment
      } of segments.segment(text)) {
        result += encodeGrapheme(segment);
      }
      return result;
    },
    decode(text) {
      let result = "";
      for (const token of text)
        result += decoded.get(token) ?? token;
      return result;
    }
  };
}

// src/vim/map.ts
var graphemes = new Intl.Segmenter(undefined, {
  granularity: "grapheme"
});
function graphemeWidth(value, method) {
  if (value === "\t")
    return 2;
  if (value === `
`)
    return 1;
  if (method === "wcwidth") {
    let width = 0;
    for (const character of value)
      width += Bun.stringWidth(character);
    return width;
  }
  return Bun.stringWidth(value);
}
function charToDisplay(text, charIndex, method = "unicode") {
  let width = 0;
  const limit = Math.max(0, Math.min(charIndex, text.length));
  for (const part of graphemes.segment(text)) {
    if (part.index + part.segment.length > limit)
      break;
    width += graphemeWidth(part.segment, method);
  }
  return width;
}
function displayToChar(text, displayOffset, method = "unicode") {
  let width = 0;
  for (const part of graphemes.segment(text)) {
    const next = width + graphemeWidth(part.segment, method);
    if (next > displayOffset)
      return part.index;
    width = next;
  }
  return text.length;
}
function displayWidth(text, method = "unicode") {
  return charToDisplay(text, text.length, method);
}
function createPromptMap(hostText, codec = createGraphemeCodec(), method = "unicode") {
  const hostToVim = [];
  const vimToHost = [];
  const vimToDisplay = [];
  const lineStarts = [0];
  let vimText = "";
  let vimOffset = 0;
  let width = 0;
  if (/^[\x20-\x7e\n\t]*$/.test(hostText)) {
    for (let index = 0;index < hostText.length; index++) {
      hostToVim[index] = vimToHost[index] = index;
      vimToDisplay[index] = width;
      width += hostText[index] === "\t" ? 2 : 1;
      if (hostText[index] === `
`)
        lineStarts.push(index + 1);
    }
    hostToVim[hostText.length] = vimToHost[hostText.length] = hostText.length;
    vimToDisplay[hostText.length] = width;
    return {
      hostText,
      vimText: hostText,
      hostToVim,
      vimToHost,
      vimToDisplay,
      lineStarts,
      displayWidth: width
    };
  }
  for (const {
    index: hostOffset,
    segment
  } of graphemes.segment(hostText)) {
    for (let index = hostOffset;index < hostOffset + segment.length; index++)
      hostToVim[index] = vimOffset;
    const encoded = codec.encodeGrapheme(segment);
    vimText += encoded;
    vimToHost[vimOffset] = hostOffset;
    vimToDisplay[vimOffset] = width;
    width += graphemeWidth(segment, method);
    vimOffset++;
    if (encoded === `
`)
      lineStarts.push(vimOffset);
  }
  hostToVim[hostText.length] = vimOffset;
  vimToHost[vimOffset] = hostText.length;
  vimToDisplay[vimOffset] = width;
  return {
    hostText,
    vimText,
    hostToVim,
    vimToHost,
    vimToDisplay,
    lineStarts,
    displayWidth: width
  };
}
function hostPosition(map, hostDisplayOffset) {
  const offset = indexAtOffset(map.vimToDisplay, hostDisplayOffset);
  const line = indexAtOffset(map.lineStarts, offset);
  return {
    line,
    col: offset - map.lineStarts[line]
  };
}
function hostCharOffset(map, hostDisplayOffset) {
  return map.vimToHost[indexAtOffset(map.vimToDisplay, hostDisplayOffset)];
}
function hostOffset(map, position) {
  return hostFromVimOffset(map, vimOffsetFromPosition(map, position));
}
function hostFromVimOffset(map, offset) {
  return map.vimToDisplay[clamp(offset, 0, map.vimText.length)];
}
function vimLineLength(map, line) {
  const start = map.lineStarts[line];
  if (start === undefined)
    return 0;
  const end = line + 1 < map.lineStarts.length ? map.lineStarts[line + 1] - 1 : map.vimText.length;
  return end - start;
}
function vimOffsetFromPosition(map, position) {
  const line = clamp(position.line, 0, map.lineStarts.length - 1);
  return map.lineStarts[line] + clamp(position.col, 0, vimLineLength(map, line));
}
function indexAtOffset(offsets, offset) {
  let low = 0;
  let high = offsets.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] <= offset)
      low = middle + 1;
    else
      high = middle;
  }
  return Math.max(0, low - 1);
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/vim/edit.ts
var graphemes2 = new Intl.Segmenter(undefined, {
  granularity: "grapheme"
});
function editInput(input, value, widthMethod) {
  const before = input.plainText;
  if (before === value)
    return;
  input.clearSelection();
  let start = 0;
  while (start < before.length && start < value.length && before[start] === value[start])
    start++;
  const beforeSegments = graphemes2.segment(before);
  const afterSegments = graphemes2.segment(value);
  start = Math.min(segmentAt(before, beforeSegments, start)?.index ?? start, segmentAt(value, afterSegments, start)?.index ?? start);
  let end = before.length;
  let valueEnd = value.length;
  while (end > start && valueEnd > start && before[end - 1] === value[valueEnd - 1]) {
    end--;
    valueEnd--;
  }
  while (true) {
    const left = segmentAt(before, beforeSegments, end);
    const right = segmentAt(value, afterSegments, valueEnd);
    const leftExtra = left && left.index < end ? left.index + left.segment.length - end : 0;
    const rightExtra = right && right.index < valueEnd ? right.index + right.segment.length - valueEnd : 0;
    const extra = Math.max(leftExtra, rightExtra);
    if (!extra)
      break;
    end += extra;
    valueEnd += extra;
  }
  const startOffset = charToDisplay(before, start, widthMethod);
  if (start === end)
    input.cursorOffset = startOffset;
  else
    input.setSelection(startOffset, startOffset + charToDisplay(before.slice(start, end), end - start, widthMethod));
  const inserted = value.slice(start, valueEnd);
  if (inserted)
    input.insertText(inserted);
  else
    input.deleteChar();
}
function segmentAt(text, segments, index) {
  const point = text.codePointAt(index);
  if (point !== undefined && point > 65535)
    index++;
  return segments.containing(index);
}

// src/vim/keys.ts
var graphemes3 = new Intl.Segmenter(undefined, {
  granularity: "grapheme"
});
var NAMED_KEYS = {
  escape: "<Esc>",
  esc: "<Esc>",
  return: "<CR>",
  enter: "<CR>",
  tab: "<Tab>",
  backspace: "<BS>",
  delete: "<Del>",
  space: "<Space>",
  up: "<Up>",
  down: "<Down>",
  left: "<Left>",
  right: "<Right>",
  home: "<Home>",
  end: "<End>",
  pageup: "<PageUp>",
  pagedown: "<PageDown>"
};
function keyNotation(event) {
  const name = event.name?.toLowerCase();
  if (!name)
    return;
  if (event.ctrl)
    return `<C-${ctrlKey(name, event.shift)}>`;
  if (event.meta || event.option)
    return `<M-${name}>`;
  if (name.length === 1 || [...graphemes3.segment(name)].length === 1)
    return event.shift ? name.toUpperCase() : name;
  return NAMED_KEYS[name] ?? `<${name}>`;
}
function ctrlKey(name, shift) {
  if (name === "escape" || name === "esc")
    return "[";
  if (name === "[" && shift)
    return "{";
  return name;
}
function keyForVimee(event, key) {
  if (key === "<C-[>")
    return "Escape";
  if (event.ctrl)
    return event.name?.toLowerCase();
  const token = keyToken(key);
  return token.startsWith("<") ? undefined : token;
}
function keyToken(token) {
  if (token === "<Esc>" || token === "<C-[>")
    return "Escape";
  if (token === "<CR>")
    return "Enter";
  if (token === "<Tab>")
    return "Tab";
  if (token === "<BS>")
    return "Backspace";
  if (token === "<Del>")
    return "Delete";
  if (token === "<Space>")
    return " ";
  if (token === "<Up>")
    return "ArrowUp";
  if (token === "<Down>")
    return "ArrowDown";
  if (token === "<Left>")
    return "ArrowLeft";
  if (token === "<Right>")
    return "ArrowRight";
  if (token === "<Home>")
    return "Home";
  if (token === "<End>")
    return "End";
  if (token.startsWith("<C-") && token.endsWith(">"))
    return token.slice(3, -1).toLowerCase();
  return token;
}
function tokenCtrl(token) {
  return token.startsWith("<C-") && token !== "<C-[>";
}
function paneMappingKey(key) {
  if (key === "<C-_>")
    return "<C-/>";
  if (/^[!-~]$/.test(key) || Object.values(NAMED_KEYS).includes(key))
    return key;
  if (/^<[CM]-[!-~]>$/.test(key) && !/^<[CM]-[A-Z]>$/.test(key))
    return key;
  throw new Error("Pane mappings require a single key or chord, such as <M-h> or <C-/>");
}
function paneEventKey(event) {
  if (event.super || event.hyper || event.ctrl && (event.meta || event.option))
    return;
  const key = keyNotation(event);
  if (!key)
    return;
  if (event.shift && (/^<[CM]-[a-z]>$/.test(key) || Object.values(NAMED_KEYS).includes(key)))
    return;
  return key === "<C-_>" ? "<C-/>" : key;
}

// src/vim/log.ts
import { appendFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
function createVimLog(config) {
  if (!config.debug)
    return () => {};
  const path = config.debugPath ?? defaultPath();
  append(path, `
--- opencode-vim debug ${new Date().toISOString()} ---
`);
  return (event, data) => {
    const suffix = data ? ` ${safeJson(data)}` : "";
    append(path, `${new Date().toISOString()} ${event}${suffix}
`);
  };
}
function defaultPath() {
  const home = process.env.HOME;
  return home ? join(home, ".cache/opencode/opencode-vim.log") : "/tmp/opencode-vim.log";
}
async function append(path, text) {
  try {
    await mkdir(dirname(path), {
      recursive: true
    });
    await appendFile(path, text);
  } catch {}
}
function safeJson(data) {
  try {
    return JSON.stringify(data);
  } catch {
    return "{}";
  }
}

// src/vim/state.tsx
import { createSignal } from "opentui:runtime-module:solid-js";
function createVimState(defaultMode, log = () => {}) {
  const [mode, setMode] = createSignal(defaultMode);
  const [pending, setPending] = createSignal("");
  const listeners = new Set;
  log("state.init", {
    mode: defaultMode
  });
  return {
    mode,
    setMode(next) {
      const changed = mode() !== next;
      if (changed)
        log("state.mode", {
          from: mode(),
          to: next
        });
      setMode(next);
      if (changed)
        notify();
    },
    pending,
    setPending(next) {
      const changed = pending() !== next;
      if (changed)
        log("state.pending", {
          from: pending(),
          to: next
        });
      setPending(next);
      if (changed)
        notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
  function notify() {
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        log("state.listener.error", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}

// src/vim/vimee.ts
import { TextBuffer, createInitialContext, parseKeySequence as parseKeySequence3, processKeystroke, resetContext as resetContext2, resolveMotion } from "@vimee/core";

// src/vim/history.ts
function createNativeHistory(input) {
  const buffer = input.editBuffer;
  if (!buffer || !input.undo || !input.redo)
    return;
  let position = 0;
  let version = 0;
  let pending;
  const changes = [];
  const restore = [];
  function point() {
    return {
      position,
      cursor: input.isDestroyed ? 0 : input.cursorOffset
    };
  }
  function begin() {
    if (!pending || pending.position === position)
      pending = point();
  }
  function end() {
    if (pending && position > pending.position)
      changes.push({
        before: pending,
        after: point()
      });
    pending = undefined;
  }
  function observe(target, name, kind) {
    const methods = target;
    const original = methods[name];
    const wrapped = function(...args) {
      if (kind === "undo" || kind === "redo") {
        end();
        const result = original.apply(target, args);
        if (result !== null)
          position += kind === "undo" ? -1 : 1;
        return result;
      }
      if (kind === "reset") {
        const result = original.apply(target, args);
        position = 0;
        version++;
        pending = undefined;
        changes.length = 0;
        return result;
      }
      const insertion = name === "insertChar" || name === "insertText";
      const replacement = name === "replaceText" || name === "replaceTextOwned";
      const knownChange = replacement || name === "newLine" || insertion && args[0].length > 0;
      const needsComparison = !knownChange && !insertion;
      const before = needsComparison ? input.plainText : undefined;
      const ownGroup = !pending;
      begin();
      const result = original.apply(target, args);
      if (knownChange || needsComparison && input.plainText !== before) {
        for (let index = 0;index < changes.length; index++) {
          const change = changes[index];
          if (change.after.position <= position)
            continue;
          if (change.before.position < position) {
            change.after = {
              position,
              cursor: pending.cursor
            };
            changes.length = index + 1;
          } else
            changes.length = index;
          break;
        }
        position++;
      }
      if (ownGroup)
        end();
      return result;
    };
    methods[name] = wrapped;
    restore.push(() => {
      if (methods[name] === wrapped)
        methods[name] = original;
    });
  }
  for (const name of ["insertChar", "insertText", "deleteChar", "deleteCharBackward", "deleteRange", "deleteLine", "newLine", "replaceText", "replaceTextOwned"])
    observe(buffer, name, "edit");
  for (const name of ["setText", "setTextOwned", "clear", "clearHistory"])
    observe(buffer, name, "reset");
  observe(buffer, "undo", "undo");
  observe(buffer, "redo", "redo");
  if (input.editorView?.deleteSelectedText)
    observe(input.editorView, "deleteSelectedText", "edit");
  function move(direction) {
    end();
    let change;
    if (direction === "undo") {
      for (let index = changes.length - 1;index >= 0; index--) {
        if (changes[index].before.position < position) {
          if (position <= changes[index].after.position)
            change = changes[index];
          break;
        }
      }
    } else {
      for (const candidate of changes) {
        if (candidate.after.position > position) {
          if (position >= candidate.before.position)
            change = candidate;
          break;
        }
      }
    }
    const target = change ? direction === "undo" ? change.before : change.after : undefined;
    const before = position;
    do {
      if (direction === "undo") {
        if (!buffer.canUndo())
          break;
        input.undo();
      } else {
        if (!buffer.canRedo())
          break;
        input.redo();
      }
    } while (target && position !== target.position);
    if (position !== before && target)
      input.cursorOffset = target.cursor;
    return position !== before;
  }
  return {
    begin,
    end,
    version: () => version,
    undo: () => move("undo"),
    redo: () => move("redo"),
    cleanup() {
      end();
      for (const stop of restore)
        stop();
    }
  };
}

// src/vim/keymaps.ts
import { createKeybindMap, parseKeySequence as parseKeySequence2 } from "@vimee/core";
function hasNormalKeyPrefix(config, key) {
  for (const sequence of Object.keys(config.keymaps.normal ?? {})) {
    try {
      if (keyToken(parseKeySequence2(sequence)[0] ?? "") === key)
        return true;
    } catch {}
  }
  return false;
}
function createKeybinds(config, log) {
  const map = createKeybindMap();
  let count = 0;
  for (const mode of ["insert", "normal", "visual", "visual-line"]) {
    const keymaps = config.keymaps[mode];
    if (!keymaps)
      continue;
    for (const [keys, action] of Object.entries(keymaps)) {
      try {
        const tokens = parseKeySequence2(keys);
        if (tokens.length > 1 && tokens[0] === "<CR>")
          throw new Error("<CR> cannot start a multi-key mapping");
        map.addKeybind(mode, keys, keybindAction(action));
        count++;
      } catch (error) {
        log("vimee.keymap.invalid", {
          mode,
          keys,
          action,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  return count > 0 ? map : undefined;
}
function insertHostAction(definition) {
  const action = definition.hostAction;
  if (action)
    return action;
  if ("execute" in definition)
    return;
  if (definition.keys === "<Esc>" || definition.keys === "<C-[>" || definition.keys === "Escape")
    return "normal";
  return;
}
function mappedCommand(action) {
  if (action.startsWith("command:")) {
    const command = action.slice(8).trim();
    if (!command)
      throw new Error("Command name is required");
    return command;
  }
}
function keybindAction(action) {
  const command = mappedCommand(action);
  if (command) {
    return {
      execute: () => [{
        type: "command",
        command
      }],
      hostAction: "command",
      command
    };
  }
  switch (action) {
    case "normal":
      return {
        keys: "<Esc>",
        hostAction: "normal"
      };
    case "insert":
      return {
        keys: "i"
      };
    case "submit":
      return {
        execute: () => [{
          type: "submit"
        }],
        hostAction: "submit"
      };
    default:
      return {
        keys: action
      };
  }
}

// src/vim/text-objects.ts
import { executeOperatorOnRange, resetContext } from "@vimee/core";
function textObjectAlias(key, ctx) {
  if (ctx.phase !== "text-object-pending")
    return;
  if (key === "b")
    return "(";
  if (key === "B")
    return "{";
  return;
}
function textObjectOperator(operator) {
  return operator === "y" || operator === "d" || operator === "c";
}
function resolvePromptTextObject(modifier, key, cursor, buffer) {
  if (key === "q")
    return quoteRange(modifier, cursor, buffer);
  if (key !== "p")
    return null;
  return paragraphRange(modifier, cursor, buffer);
}
function quoteRange(modifier, cursor, buffer) {
  const pair = quoteObjectPair(cursor, buffer);
  if (!pair)
    return null;
  const start = modifier === "i" ? pair.open + 1 : pair.open;
  const end = modifier === "i" ? pair.close - 1 : pair.close;
  return {
    start: {
      line: cursor.line,
      col: start
    },
    end: {
      line: cursor.line,
      col: Math.max(start, end)
    },
    linewise: false,
    inclusive: end >= start
  };
}
function paragraphRange(modifier, cursor, buffer) {
  const count = buffer.getLineCount();
  if (count === 0)
    return null;
  const line = Math.max(0, Math.min(count - 1, cursor.line));
  let start = line;
  while (start < count && blankLine(buffer.getLine(start)))
    start++;
  if (start >= count) {
    start = line;
    while (start >= 0 && blankLine(buffer.getLine(start)))
      start--;
  }
  if (start < 0 || start >= count)
    return null;
  let end = start;
  while (start > 0 && !blankLine(buffer.getLine(start - 1)))
    start--;
  while (end < count - 1 && !blankLine(buffer.getLine(end + 1)))
    end++;
  if (modifier === "a") {
    if (end < count - 1 && blankLine(buffer.getLine(end + 1))) {
      end++;
      while (end < count - 1 && blankLine(buffer.getLine(end + 1)))
        end++;
    } else {
      while (start > 0 && blankLine(buffer.getLine(start - 1)))
        start--;
    }
  }
  return {
    start: {
      line: start,
      col: 0
    },
    end: {
      line: end,
      col: Math.max(0, buffer.getLineLength(end) - 1)
    },
    linewise: true,
    inclusive: true
  };
}
function quoteObjectPair(cursor, buffer) {
  let best;
  for (const quote of ['"', "'", "`"]) {
    const pair = quotePair(cursor, buffer, quote);
    if (!pair)
      continue;
    if (!best || pair.distance < best.distance)
      best = pair;
  }
  return best;
}
function quotePair(cursor, buffer, quote) {
  const line = buffer.getLine(cursor.line);
  let open = -1;
  let close = -1;
  let inQuote = false;
  let quoteStart = -1;
  for (let index = 0;index < line.length; index++) {
    if (line[index] !== quote || escaped(line, index))
      continue;
    if (!inQuote) {
      quoteStart = index;
      inQuote = true;
      continue;
    }
    if (cursor.col >= quoteStart && cursor.col <= index) {
      return {
        open: quoteStart,
        close: index,
        distance: 0
      };
    }
    inQuote = false;
  }
  for (let index = cursor.col;index < line.length; index++) {
    if (line[index] !== quote || escaped(line, index))
      continue;
    if (open === -1)
      open = index;
    else {
      close = index;
      break;
    }
  }
  if (open !== -1 && close !== -1)
    return {
      open,
      close,
      distance: open - cursor.col
    };
  close = -1;
  open = -1;
  for (let index = cursor.col;index >= 0; index--) {
    if (line[index] !== quote || escaped(line, index))
      continue;
    if (close === -1)
      close = index;
    else {
      open = index;
      break;
    }
  }
  if (open !== -1 && close !== -1)
    return {
      open,
      close,
      distance: cursor.col - close
    };
  return;
}
function executeTextObject(operator, range, buffer, ctx) {
  if (operator !== "y")
    buffer.saveUndoPoint(ctx.cursor);
  if (operator === ">" || operator === "<") {
    const result = executeOperatorOnRange(operator, range, buffer, ctx.cursor, {
      style: ctx.indentStyle,
      width: ctx.indentWidth
    });
    const cursor = {
      line: result.newCursor.line,
      col: Math.max(0, buffer.getLine(result.newCursor.line).search(/\S/))
    };
    return {
      actions: [...result.actions, {
        type: "cursor-move",
        position: cursor
      }],
      context: {
        ...resetContext(ctx),
        cursor
      },
      yankedText: ""
    };
  }
  const result = range.linewise ? executeLinewiseTextObject(operator, range, buffer, ctx.cursor) : executeCharwiseTextObject(operator, range, buffer);
  const registers = ctx.selectedRegister ? {
    ...ctx.registers,
    [ctx.selectedRegister]: result.yankedText
  } : ctx.registers;
  const context = {
    ...resetContext(ctx),
    mode: result.mode,
    cursor: result.cursor,
    register: result.yankedText,
    registers,
    statusMessage: result.statusMessage
  };
  const actions = [{
    type: "yank",
    text: result.yankedText
  }, ...result.actions, {
    type: "mode-change",
    mode: result.mode
  }, {
    type: "cursor-move",
    position: result.cursor
  }];
  return {
    actions,
    context,
    yankedText: result.yankedText
  };
}
function executeLinewiseTextObject(operator, range, buffer, cursor) {
  const startLine = Math.min(range.start.line, range.end.line);
  const endLine = Math.max(range.start.line, range.end.line);
  const lineCount = endLine - startLine + 1;
  const yankedText = buffer.getLines().slice(startLine, endLine + 1).join(`
`) + `
`;
  if (operator === "y") {
    const col = Math.min(cursor.col, Math.max(0, buffer.getLineLength(startLine) - 1));
    return {
      actions: [],
      cursor: {
        line: startLine,
        col
      },
      mode: "normal",
      yankedText,
      statusMessage: lineCount >= 2 ? `${lineCount} lines yanked` : ""
    };
  }
  buffer.deleteLines(startLine, lineCount);
  if (operator === "c")
    buffer.insertLine(startLine, "");
  else if (buffer.getLineCount() === 0)
    buffer.insertLine(0, "");
  const line = Math.min(startLine, buffer.getLineCount() - 1);
  return {
    actions: [{
      type: "content-change",
      content: buffer.getContent()
    }],
    cursor: {
      line,
      col: 0
    },
    mode: operator === "c" ? "insert" : "normal",
    yankedText,
    statusMessage: lineCount >= 2 ? `${lineCount} fewer lines` : ""
  };
}
function executeCharwiseTextObject(operator, range, buffer) {
  const ordered = orderedRange(range);
  const endCol = range.inclusive ? ordered.end.col + 1 : ordered.end.col;
  const yankedText = textInRange(buffer, ordered.start, {
    line: ordered.end.line,
    col: endCol
  });
  if (operator === "y") {
    return {
      actions: [],
      cursor: ordered.start,
      mode: "normal",
      yankedText,
      statusMessage: yankedText.split(`
`).length >= 2 ? `${yankedText.split(`
`).length} lines yanked` : ""
    };
  }
  const linesBefore = buffer.getLineCount();
  buffer.deleteRange(ordered.start.line, ordered.start.col, ordered.end.line, endCol);
  const linesRemoved = linesBefore - buffer.getLineCount();
  return {
    actions: [{
      type: "content-change",
      content: buffer.getContent()
    }],
    cursor: {
      line: ordered.start.line,
      col: operator === "c" ? ordered.start.col : Math.min(ordered.start.col, Math.max(0, buffer.getLineLength(ordered.start.line) - 1))
    },
    mode: operator === "c" ? "insert" : "normal",
    yankedText,
    statusMessage: linesRemoved >= 2 ? `${linesRemoved} fewer lines` : ""
  };
}
function orderedRange(range) {
  if (range.start.line > range.end.line || range.start.line === range.end.line && range.start.col > range.end.col) {
    return {
      start: range.end,
      end: range.start
    };
  }
  return {
    start: range.start,
    end: range.end
  };
}
function textInRange(buffer, start, end) {
  if (start.line === end.line)
    return buffer.getLine(start.line).slice(start.col, end.col);
  const lines = [buffer.getLine(start.line).slice(start.col)];
  for (let line = start.line + 1;line < end.line; line++)
    lines.push(buffer.getLine(line));
  lines.push(buffer.getLine(end.line).slice(0, end.col));
  return lines.join(`
`);
}
function blankLine(line) {
  return line.trim().length === 0;
}
function escaped(line, index) {
  let slashCount = 0;
  for (let cursor = index - 1;cursor >= 0 && line[cursor] === "\\"; cursor--)
    slashCount++;
  return slashCount % 2 === 1;
}

// src/vim/vimee.ts
class MotionBuffer extends TextBuffer {
  saveUndoPoint() {}
}
var YANK_FLASH_MS = 250;
function createVimeeAdapter(state, config, log, options = {}) {
  const codec = createGraphemeCodec();
  let buffer = new MotionBuffer("");
  let activeMap = createPromptMap("", codec);
  let vim = createInitialContext({
    line: 0,
    col: 0
  });
  const keybinds = options.readOnly ? undefined : createKeybinds(config, log);
  let timer;
  let yankTimer;
  let yankFlashActive = false;
  let pendingInsert = "";
  let pendingTarget;
  let pendingContext;
  let nativeInsertChanged = false;
  let insertCursorMoved = false;
  const histories = new Map;
  let history;
  let historyVersion = 0;
  let historyText;
  let activeInput;
  let widthMethod = "unicode";
  let preferredColumn;
  let preferredScreen = false;
  let generation = 0;
  const defaultHistoryKeys = {
    k: !hasNormalKeyPrefix(config, "k"),
    j: !hasNormalKeyPrefix(config, "j")
  };
  return {
    attach,
    suspend,
    prepareNativeInsert() {
      if (insertCursorMoved)
        return false;
      history?.begin();
      return true;
    },
    setRegister(text) {
      vim = {
        ...vim,
        register: codec.encode(text)
      };
    },
    isPending: () => vim.phase !== "idle" || vim.count > 0 || !!keybinds?.isPending(),
    handle(event, key, ctx) {
      const input = ctx.input();
      if (!input)
        return false;
      attach(ctx, input);
      history?.begin();
      let vimeeKey = keyForVimee(event, key);
      if (!vimeeKey)
        return false;
      if (options.readOnly && !readOnlyKey(vimeeKey, event.ctrl, vim)) {
        vim = resetContext2(vim);
        state.setPending("");
        return true;
      }
      vimeeKey = codec.encode(vimeeKey);
      if (state.mode() === "insert") {
        const cursorMove = isInsertCursorMove(event, key);
        if (cursorMove || insertCursorMoved) {
          const map = mapForHostText(input.plainText);
          sync(hostPosition(map, input.cursorOffset));
        }
        insertCursorMoved = cursorMove;
        if (vimeeKey === "Escape") {
          cancelPendingInsert(ctx);
          enterNormal(ctx);
          state.setPending("");
          updateTimeout(ctx);
          log("vimee.key", {
            key,
            mode: vim.mode,
            phase: vim.phase,
            cursor: vim.cursor,
            actions: ["mode-change"]
          });
          return true;
        }
        return handleInsertKeybind(event, vimeeKey, ctx);
      }
      const text = input.plainText;
      const canBrowseHistory = !options.readOnly && vim.phase === "idle" && vim.count === 0 && !keybinds?.isPending();
      const historyCommand = canBrowseHistory ? defaultHistoryCommand(vimeeKey, text, historyText, defaultHistoryKeys) : undefined;
      if (historyCommand) {
        const result = dispatchCommand(historyCommand, ctx);
        historyText = result.ok ? ctx.input()?.plainText : undefined;
        state.setPending("");
        updateTimeout(ctx);
        log("vimee.history", {
          key,
          command: historyCommand,
          handled: result.ok
        });
        return true;
      }
      historyText = undefined;
      const map = mapForHostText(text);
      const displayOff = clamp2(input.cursorOffset, 0, map.displayWidth);
      const cursor = hostPosition(map, displayOff);
      const wasPending = keybinds?.isPending() ?? false;
      const pendingBefore = pendingInsert;
      sync(cursor);
      const shouldFlashYank = shouldFlashYankFor(vimeeKey);
      const visualYankRange = visualYankRangeFor(map);
      vimeeKey = textObjectAlias(vimeeKey, vim) ?? vimeeKey;
      const textObjectHandled = handleTextObject(vimeeKey, ctx, map);
      if (textObjectHandled !== undefined)
        return textObjectHandled;
      const resolved = keybinds?.resolve(vimeeKey, vim.mode, event.ctrl);
      if (resolved?.status === "pending") {
        vim = {
          ...vim,
          statusMessage: resolved.display
        };
        state.setPending(resolved.display);
        updateTimeout(ctx);
        log("vimee.key", {
          key,
          vimeeKey,
          mode: vim.mode,
          phase: vim.phase,
          cursor: vim.cursor,
          actions: []
        });
        return true;
      }
      if (vimeeKey === "Enter" && state.mode() === "normal" && vim.phase === "idle" && !wasPending && resolved?.status !== "matched") {
        ctx.submit();
        state.setPending("");
        updateTimeout(ctx);
        log("vimee.key", {
          key,
          vimeeKey,
          mode: vim.mode,
          phase: vim.phase,
          cursor: vim.cursor,
          actions: ["submit"]
        });
        return true;
      }
      const commandKey = vimeeKey;
      const definition = resolved?.status === "matched" ? resolved.definition : undefined;
      if (options.readClipboard && needsClipboard(commandKey, event.ctrl, definition)) {
        const before = generation;
        return options.readClipboard().then((text) => {
          if (before !== generation || input.isDestroyed || input.plainText !== map.hostText || input.cursorOffset !== displayOff)
            return false;
          vim = {
            ...vim,
            register: codec.encode(text)
          };
          return finish();
        });
      }
      return finish();
      function finish() {
        let result;
        if (resolved?.status === "matched") {
          const actions = applyKeybind(resolved.definition, ctx, map);
          result = {
            newCtx: vim,
            actions
          };
        } else {
          if (!event.ctrl && vim.phase === "idle" && vim.count === 0 && (commandKey === "j" || commandKey === "k" || commandKey === "ArrowDown" || commandKey === "ArrowUp")) {
            vim = processKey("g").newCtx;
          }
          result = processKey(commandKey, event.ctrl);
        }
        vim = result.newCtx;
        const actions = result.actions;
        if (resolved?.status !== "matched")
          applyActions(actions, ctx, activeMap);
        if (shouldFlashYank)
          flashYank(ctx, activeMap, yankAction(actions), visualYankRange);
        syncMode(state, vim.mode);
        const keybindPending = keybinds?.isPending() ?? false;
        if (wasPending && !keybindPending && pendingBefore && state.mode() === "insert")
          flushPendingInsert(ctx, pendingBefore, hostCharOffset(map, displayOff));
        pendingInsert = keybindPending && state.mode() === "insert" ? plainPending(vim.statusMessage) : "";
        state.setPending(pendingDisplay(vim, keybindPending));
        updateTimeout(ctx);
        log("vimee.key", {
          key,
          vimeeKey,
          mode: vim.mode,
          phase: vim.phase,
          cursor: vim.cursor,
          actions: actions.map((action) => action.type)
        });
        return consumesKey(commandKey, actions, vim, keybindPending);
      }
    },
    cleanup() {
      suspend();
      for (const item of histories.values())
        item.cleanup();
      histories.clear();
      history = undefined;
      activeInput = undefined;
    }
  };
  function needsClipboard(key, ctrl, definition) {
    if (definition) {
      if ("execute" in definition)
        return false;
      return parseKeySequence3(definition.keys).some((token) => ["p", "P", ".", "@"].includes(token));
    }
    if (ctrl)
      return false;
    if (vim.phase === "macro-execute-pending")
      return true;
    if (vim.phase !== "idle" || vim.selectedRegister)
      return false;
    if (key === "p" || key === "P")
      return true;
    return key === "." && vim.lastChange.some((token) => ["p", "P", "@"].includes(token));
  }
  function attach(ctx, input = ctx.input()) {
    if (activeInput === input)
      return;
    suspend();
    activeInput = input;
    widthMethod = ctx.widthMethod;
    activeMap = createPromptMap(input?.plainText ?? "", codec, widthMethod);
    buffer = new MotionBuffer(activeMap.vimText);
    for (const [editor, item] of histories) {
      if (!editor.isDestroyed)
        continue;
      item.cleanup();
      histories.delete(editor);
    }
    history = input && !options.readOnly ? histories.get(input) : undefined;
    if (input && !options.readOnly && !history) {
      history = createNativeHistory(input);
      if (history)
        histories.set(input, history);
    }
    historyVersion = history?.version() ?? 0;
    if (state.mode() === "insert")
      history?.begin();
    nativeInsertChanged = false;
    vim = {
      ...resetContext2(vim),
      cursor: hostPosition(activeMap, input?.cursorOffset ?? 0),
      mode: state.mode()
    };
  }
  function suspend() {
    generation++;
    insertCursorMoved = false;
    preferredColumn = undefined;
    if (pendingContext)
      cancelPendingInsert(pendingContext);
    history?.end();
    if (timer)
      clearTimeout(timer);
    timer = undefined;
    keybinds?.cancel();
    cancelYankFlash();
    if (activeInput && !activeInput.isDestroyed)
      clearVisualSelection(activeInput);
    if (isVisualMode(state.mode()))
      state.setMode("normal");
    vim = resetContext2(vim);
    state.setPending("");
    pendingTarget = undefined;
    pendingContext = undefined;
  }
  function sync(cursor) {
    if (cursor.line !== vim.cursor.line || cursor.col !== vim.cursor.col)
      preferredColumn = undefined;
    vim = {
      ...vim,
      cursor,
      mode: state.mode()
    };
  }
  function mapForHostText(text) {
    if (history && historyVersion !== history.version()) {
      historyVersion = history.version();
      activeMap = createPromptMap(text, codec, widthMethod);
      buffer = new MotionBuffer(activeMap.vimText);
      vim = {
        ...resetContext2(vim),
        lastChange: [],
        pendingChange: []
      };
      nativeInsertChanged = false;
    }
    if (activeMap.hostText === text)
      return activeMap;
    const nextMap = createPromptMap(text, codec, widthMethod);
    if (state.mode() === "insert")
      recordNativeChange(nextMap);
    activeMap = nextMap;
    if (state.mode() === "insert") {
      nativeInsertChanged = true;
    } else {
      buffer = new MotionBuffer(activeMap.vimText);
      nativeInsertChanged = false;
    }
    return activeMap;
  }
  function recordNativeChange(nextMap) {
    const before = activeMap.vimText;
    const after = nextMap.vimText;
    const start = vimOffsetFromPosition(activeMap, vim.cursor);
    let prefix = 0;
    while (prefix < start && prefix < after.length && before[prefix] === after[prefix])
      prefix++;
    let suffix = 0;
    while (suffix < before.length - start && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1])
      suffix++;
    const keys = [...vim.pendingChange];
    if (!keys.length)
      keys.push("i");
    for (let index = prefix;index < start; index++)
      keys.push("Backspace");
    for (let index = start;index < before.length - suffix; index++)
      keys.push("Delete");
    for (const key of after.slice(prefix, after.length - suffix))
      keys.push(key === `
` ? "Enter" : key === "\t" ? "Tab" : key);
    vim = {
      ...vim,
      pendingChange: keys
    };
  }
  function applyActions(actions, ctx, map) {
    const input = ctx.input();
    let currentMap = map;
    if (!input)
      return;
    history?.begin();
    for (const action of actions) {
      switch (action.type) {
        case "content-change":
          currentMap = createPromptMap(codec.decode(action.content), codec, widthMethod);
          activeMap = currentMap;
          ctx.setText(currentMap.hostText);
          buffer.replaceContent(currentMap.vimText);
          break;
        case "yank":
          if (!action.register)
            options.onYank?.(codec.decode(action.text));
          break;
        case "mode-change":
          nativeInsertChanged = action.mode === "insert" && actions.some((item) => item.type === "content-change");
          if (action.mode === "insert") {
            cancelYankFlash();
            clearVisualSelection(input);
          }
          syncMode(state, action.mode);
          break;
        case "quit":
          ctx.blur();
          break;
        case "submit":
          ctx.submit();
          break;
        case "command":
          dispatchCommand(action.command, ctx);
          return;
      }
    }
    setCursor(input, currentMap, vim.cursor);
    syncVisualSelection(input, currentMap, ctx);
    if (vim.mode === "insert")
      history?.begin();
    else
      history?.end();
  }
  function handleInsertKeybind(event, key, ctx) {
    if (!keybinds?.hasKeybinds("insert") && !keybinds?.isPending())
      return false;
    const wasPending = keybinds.isPending();
    const pendingBefore = pendingInsert;
    const resolved = keybinds.resolve(key, "insert", event.ctrl);
    switch (resolved.status) {
      case "pending":
        if (!wasPending) {
          const input = ctx.input();
          pendingTarget = input ? {
            input,
            offset: input.cursorOffset
          } : undefined;
          pendingContext = ctx;
        }
        pendingInsert = codec.decode(plainPending(resolved.display));
        state.setPending(resolved.display);
        updateTimeout(ctx);
        return true;
      case "matched": {
        if (applyInsertKeybind(resolved.definition, ctx)) {
          pendingInsert = "";
          state.setPending("");
          updateTimeout(ctx);
          log("vimee.keybind", {
            key,
            mode: vim.mode,
            phase: vim.phase,
            cursor: vim.cursor,
            actions: ["mode-change"]
          });
          return true;
        }
        if (wasPending && pendingBefore)
          flushPendingInsert(ctx, pendingBefore);
        pendingInsert = "";
        state.setPending("");
        updateTimeout(ctx);
        log("vimee.keybind.unsupported", {
          key
        });
        return false;
      }
      case "none":
        if (!wasPending)
          return false;
        if (wasPending && pendingBefore)
          flushPendingInsert(ctx, pendingBefore);
        pendingInsert = "";
        state.setPending("");
        updateTimeout(ctx);
        return handleInsertKeybind(event, key, ctx);
    }
  }
  function applyInsertKeybind(definition, ctx) {
    switch (insertHostAction(definition)) {
      case "normal":
        enterNormal(ctx);
        return true;
      case "submit":
        ctx.submit();
        return true;
      case "command":
        dispatchCommand(definition.command, ctx);
        return true;
      default:
        return false;
    }
  }
  function enterNormal(ctx) {
    const input = ctx.input();
    const text = input?.plainText ?? "";
    const map = mapForHostText(text);
    if (nativeInsertChanged)
      buffer.replaceContent(map.vimText);
    if (input && text.length > 0) {
      const dw = map.displayWidth;
      const offset = clamp2(input.cursorOffset, 0, dw);
      const charOffset = hostCharOffset(map, offset);
      if (charOffset > 0 && text[charOffset - 1] !== `
`) {
        input.cursorOffset = hostOffset(map, hostPosition(map, Math.max(0, offset - 1)));
      }
      clampNormalCursor(input, map);
    }
    const lastChange = nativeInsertChanged ? [...vim.pendingChange, "Escape"] : vim.lastChange;
    vim = {
      ...resetContext2(vim),
      cursor: hostPosition(map, input?.cursorOffset ?? 0),
      mode: "normal",
      statusMessage: "",
      lastChange,
      pendingChange: []
    };
    nativeInsertChanged = false;
    syncMode(state, "normal");
    history?.end();
  }
  function applyKeybind(definition, ctx, map) {
    if ("execute" in definition) {
      const actions = definition.execute(vim, buffer);
      vim = {
        ...vim,
        cursor: hostPosition(map, hostOffset(map, vim.cursor))
      };
      applyActions(actions, ctx, map);
      return actions;
    }
    let actions = [];
    for (const token of parseKeySequence3(definition.keys)) {
      const result = processKey(codec.encode(keyToken(token)), tokenCtrl(token));
      vim = result.newCtx;
      applyActions(result.actions, ctx, activeMap);
      actions = [...actions, ...result.actions];
    }
    return actions;
  }
  function processKey(key, ctrl = false) {
    const register = vim.selectedRegister;
    const moving = !ctrl && vim.mode !== "insert" && (vim.phase === "idle" || vim.phase === "operator-pending" || vim.phase === "g-pending");
    const vertical = moving && (key === "j" || key === "k" || key === "ArrowDown" || key === "ArrowUp");
    const lineEnd = moving && key === "$" && vim.phase === "idle";
    const result = processKeyInner(key, ctrl);
    if (register) {
      for (const action of result.actions) {
        if (action.type === "yank")
          action.register = register;
      }
    }
    if (result.actions.some((action) => action.type === "content-change" || action.type === "mode-change"))
      preferredColumn = undefined;
    else if (!vertical && result.actions.some((action) => action.type === "cursor-move"))
      preferredColumn = lineEnd ? Infinity : undefined;
    return result;
  }
  function processKeyInner(key, ctrl) {
    if (!ctrl && key === "c" && vim.mode === "visual-line" && vim.phase === "idle" && vim.visualAnchor) {
      const result = executeTextObject("c", {
        start: vim.visualAnchor,
        end: vim.cursor,
        linewise: true,
        inclusive: true
      }, buffer, vim);
      return {
        newCtx: {
          ...result.context,
          visualAnchor: null
        },
        actions: result.actions
      };
    }
    if (vim.mode === "normal" && vim.phase === "idle" && (!ctrl && key === "u" || ctrl && key === "r")) {
      const redo = ctrl;
      let changed = false;
      for (let count = vim.count || 1;count > 0; count--) {
        if (!(redo ? history?.redo() : history?.undo()))
          break;
        changed = true;
      }
      activeMap = createPromptMap(activeInput?.plainText ?? "", codec, widthMethod);
      buffer = new MotionBuffer(activeMap.vimText);
      if (activeInput)
        clampNormalCursor(activeInput, activeMap);
      const cursor = hostPosition(activeMap, activeInput?.cursorOffset ?? 0);
      const message = changed ? "" : redo ? "Already at newest change" : "Already at oldest change";
      return {
        newCtx: {
          ...resetContext2(vim),
          cursor,
          pendingChange: [],
          statusMessage: message
        },
        actions: [{
          type: "cursor-move",
          position: cursor
        }]
      };
    }
    let range = ctrl ? undefined : lineMotion(key);
    if (range && vim.operator && (key === "j" || key === "k" || key === "ArrowDown" || key === "ArrowUp") && range.start.line === range.end.line && range.start.col === range.end.col) {
      return {
        newCtx: {
          ...resetContext2(vim),
          pendingChange: []
        },
        actions: []
      };
    }
    if (range && !vim.operator) {
      return {
        newCtx: {
          ...resetContext2(vim),
          cursor: range.end
        },
        actions: [{
          type: "cursor-move",
          position: range.end
        }]
      };
    }
    let wordRange;
    if (!ctrl && vim.mode !== "insert" && (key === "w" || key === "W") && (vim.phase === "idle" || vim.phase === "operator-pending")) {
      wordRange = forwardWordRange(key, vim.cursor, buffer, vim.count || 1);
      if (vim.phase === "idle") {
        const cursor = {
          ...wordRange.end,
          col: Math.min(wordRange.end.col, Math.max(0, buffer.getLineLength(wordRange.end.line) - 1))
        };
        return {
          newCtx: {
            ...resetContext2(vim),
            cursor
          },
          actions: [{
            type: "cursor-move",
            position: cursor
          }]
        };
      }
    }
    if (key === "." && !ctrl && vim.mode === "normal" && vim.phase === "idle" && vim.lastChange.length) {
      const original = buffer;
      const before = buffer.getContent();
      const keys = [...vim.lastChange];
      if (vim.count) {
        while (/^[0-9]$/.test(keys[0] ?? ""))
          keys.shift();
        keys.unshift(...String(vim.count));
      }
      vim = {
        ...vim,
        count: 0
      };
      const actions = [];
      buffer = new MotionBuffer(before);
      try {
        for (const token of keys) {
          const result = processKey(codec.encode(keyToken(token)), tokenCtrl(token));
          vim = result.newCtx;
          actions.push(...result.actions);
        }
        if (buffer.getContent() !== before) {
          original.replaceContent(buffer.getContent());
        }
      } finally {
        buffer = original;
      }
      return {
        newCtx: {
          ...vim,
          lastChange: keys,
          pendingChange: []
        },
        actions
      };
    }
    const operator = vim.operator;
    if (!range && !ctrl && operator && textObjectOperator(operator)) {
      if (vim.phase === "operator-pending") {
        const count = vim.count || 1;
        if (key === "l" || key === "ArrowRight") {
          range = {
            start: vim.cursor,
            end: {
              line: vim.cursor.line,
              col: Math.min(buffer.getLineLength(vim.cursor.line), vim.cursor.col + count)
            },
            inclusive: false,
            linewise: false
          };
        } else if (key === operator) {
          range = {
            start: {
              line: vim.cursor.line,
              col: 0
            },
            end: {
              line: Math.min(buffer.getLineCount() - 1, vim.cursor.line + count - 1),
              col: 0
            },
            inclusive: true,
            linewise: true
          };
        } else if (operator === "c" && key === "w" && /\S/.test(buffer.getLine(vim.cursor.line)[vim.cursor.col] ?? "")) {
          range = resolveMotion("e", {
            ...vim.cursor,
            col: vim.cursor.col - 1
          }, buffer, count, vim.count > 0, vim)?.range;
          if (range)
            range.start = vim.cursor;
        } else if (wordRange) {
          range = wordRange;
          if (operator === "d" && range.end.line > range.start.line && /\S/.test(buffer.getLine(range.start.line)[range.start.col] ?? "") && range.end.col === Math.max(0, buffer.getLine(range.end.line).search(/\S/))) {
            range.end = {
              line: range.end.line - 1,
              col: buffer.getLineLength(range.end.line - 1)
            };
          }
        } else if (operator === "c") {
          const motion = resolveMotion(key, vim.cursor, buffer, count, vim.count > 0, vim);
          if (motion?.range.linewise)
            range = motion.range;
        }
      } else if (vim.phase === "text-object-pending" && vim.textObjectModifier) {
        range = resolvePromptTextObject(vim.textObjectModifier, key, vim.cursor, buffer) ?? undefined;
      }
    }
    if (range && operator) {
      if (vim.phase === "g-pending" && !range.inclusive) {
        const ordered = orderedRange(range);
        if (ordered.end.line > ordered.start.line && ordered.end.col === 0) {
          const linewise = ordered.start.col <= Math.max(0, buffer.getLine(ordered.start.line).search(/\S/));
          range = {
            start: ordered.start,
            end: {
              line: ordered.end.line - 1,
              col: buffer.getLineLength(ordered.end.line - 1)
            },
            linewise,
            inclusive: false
          };
        }
      }
      const keys = [];
      if (vim.count)
        keys.push(...String(vim.count));
      for (const token of vim.pendingChange) {
        if (!/^[0-9]$/.test(token))
          keys.push(token);
      }
      keys.push(key);
      const result = executeTextObject(operator, range, buffer, vim);
      if (operator === "y")
        result.context.pendingChange = [];
      else if (result.context.mode === "insert")
        result.context.pendingChange = keys;
      else {
        result.context.lastChange = keys;
        result.context.pendingChange = [];
      }
      return {
        newCtx: result.context,
        actions: result.actions
      };
    }
    const yanking = operator === "y" || isVisualMode(vim.mode) && key === "y" || vim.mode === "normal" && key === "Y";
    const register = vim.selectedRegister ? vim.registers[vim.selectedRegister] ?? "" : vim.register;
    const emptyLinePaste = !ctrl && vim.mode === "normal" && vim.phase === "idle" && (key === "p" || key === "P") && buffer.getContent() === "" && register.endsWith(`
`);
    const result = processKeystroke(key, vim, yanking ? new TextBuffer(buffer.getContent()) : buffer, ctrl, false);
    if (emptyLinePaste) {
      buffer.deleteLines(key === "p" ? 0 : buffer.getLineCount() - 1, 1);
      result.newCtx.cursor = {
        line: 0,
        col: 0
      };
      for (const action of result.actions) {
        if (action.type === "content-change")
          action.content = buffer.getContent();
        if (action.type === "cursor-move")
          action.position = result.newCtx.cursor;
      }
    }
    return result;
  }
  function lineMotion(key) {
    if (vim.mode !== "normal" && !isVisualMode(vim.mode))
      return;
    const screen = vim.phase === "g-pending";
    if (!screen && vim.phase !== "idle" && vim.phase !== "operator-pending")
      return;
    const down = key === "j" || key === "ArrowDown";
    const up = key === "k" || key === "ArrowUp";
    if (!down && !up && !(screen && (key === "0" || key === "^" || key === "$")))
      return;
    const map = buffer.getContent() === activeMap.vimText ? activeMap : createPromptMap(codec.decode(buffer.getContent()), codec, widthMethod);
    const offset = hostOffset(map, vim.cursor);
    const count = vim.count || 1;
    let start;
    let end;
    let column;
    if (screen) {
      const lines = activeInput?.editorView?.getLogicalLineInfo?.();
      if (!lines?.lineStartCols.length)
        return;
      let row = 0;
      while (row + 1 < lines.lineStartCols.length && lines.lineStartCols[row + 1] <= offset)
        row++;
      column = offset - lines.lineStartCols[row];
      let delta = 0;
      if (down)
        delta = count;
      else if (up)
        delta = -count;
      else if (key === "$")
        delta = count - 1;
      const target = clamp2(row + delta, 0, lines.lineStartCols.length - 1);
      start = lines.lineStartCols[target];
      end = start + Math.max(0, lines.lineWidthCols[target] - 1);
      if ((down || up) && target === row)
        return {
          start: vim.cursor,
          end: vim.cursor,
          linewise: false,
          inclusive: false
        };
    } else {
      const lineStart = hostOffset(map, {
        line: vim.cursor.line,
        col: 0
      });
      column = offset - lineStart;
      const line = clamp2(vim.cursor.line + (down ? count : -count), 0, buffer.getLineCount() - 1);
      start = hostOffset(map, {
        line,
        col: 0
      });
      end = Math.max(start, hostOffset(map, {
        line,
        col: buffer.getLineLength(line)
      }) - 1);
    }
    let target;
    if (down || up) {
      if (preferredColumn === undefined || preferredScreen !== screen && preferredColumn !== Infinity)
        preferredColumn = column;
      preferredScreen = screen;
      target = Math.min(start + preferredColumn, end);
    } else if (key === "$") {
      target = end;
    } else {
      target = start;
      if (key === "^") {
        const from = hostCharOffset(map, start);
        const to = hostCharOffset(map, end + 1);
        const first = map.hostText.slice(from, to).search(/\S/);
        if (first >= 0)
          target = hostFromVimOffset(map, map.hostToVim[from + first]);
      }
    }
    return {
      start: vim.cursor,
      end: hostPosition(map, target),
      linewise: !screen,
      inclusive: !screen || key === "$"
    };
  }
  function handleTextObject(key, ctx, map) {
    if (vim.phase !== "text-object-pending" || !vim.textObjectModifier)
      return;
    const range = resolvePromptTextObject(vim.textObjectModifier, key, vim.cursor, buffer);
    if (!range)
      return;
    const flashRange = vim.operator === "y" ? motionHostRange(map, range) : undefined;
    if (!vim.operator) {
      vim = {
        ...resetContext2(vim),
        visualAnchor: range.start,
        cursor: range.end
      };
      applyActions([{
        type: "cursor-move",
        position: range.end
      }], ctx, map);
      state.setPending("");
      updateTimeout(ctx);
      log("vimee.textobject", {
        key,
        mode: vim.mode,
        phase: vim.phase,
        cursor: vim.cursor,
        actions: ["cursor-move"]
      });
      return true;
    }
    if (!textObjectOperator(vim.operator))
      return;
    const result = processKey(key);
    vim = result.newCtx;
    applyActions(result.actions, ctx, map);
    if (flashRange)
      flashYank(ctx, activeMap, result.actions.find((action) => action.type === "yank"), flashRange);
    syncMode(state, vim.mode);
    state.setPending("");
    updateTimeout(ctx);
    log("vimee.textobject", {
      key,
      mode: vim.mode,
      phase: vim.phase,
      cursor: vim.cursor,
      actions: result.actions.map((action) => action.type)
    });
    return true;
  }
  function updateTimeout(ctx) {
    if (timer)
      clearTimeout(timer);
    timer = undefined;
    if (!keybinds?.isPending())
      return;
    timer = setTimeout(() => {
      keybinds.cancel();
      flushPendingInsert(ctx, pendingInsert);
      pendingInsert = "";
      state.setPending("");
      ctx.requestRender();
    }, config.keymapTimeout);
  }
  function cancelPendingInsert(ctx, offset, flush = true) {
    if (!keybinds?.isPending())
      return;
    if (timer)
      clearTimeout(timer);
    timer = undefined;
    keybinds.cancel();
    if (flush)
      flushPendingInsert(ctx, pendingInsert, offset);
    pendingInsert = "";
    pendingTarget = undefined;
    pendingContext = undefined;
    state.setPending("");
  }
  function flushPendingInsert(ctx, value, charOffset) {
    if (!value || state.mode() !== "insert")
      return;
    if (pendingTarget?.input.isDestroyed)
      return;
    if (pendingTarget?.input.insertText) {
      const {
        input,
        offset
      } = pendingTarget;
      const cursor = input.cursorOffset;
      input.clearSelection?.();
      input.cursorOffset = offset;
      input.insertText(value);
      input.cursorOffset = cursor >= offset ? cursor + displayWidth(value, widthMethod) : cursor;
      return;
    }
    const input = ctx.input();
    if (!input)
      return;
    const text = input.plainText;
    const currentDisplayOff = input.cursorOffset;
    const currentCharOff = displayToChar(text, currentDisplayOff, widthMethod);
    const insertAtChar = charOffset ?? currentCharOff;
    const next = text.slice(0, insertAtChar) + value + text.slice(insertAtChar);
    ctx.setText(next);
    const nextCharOff = currentCharOff >= insertAtChar ? currentCharOff + value.length : currentCharOff;
    input.cursorOffset = displayWidth(next.slice(0, nextCharOff), widthMethod);
  }
  function setCursor(input, map, position) {
    const offset = hostOffset(map, position);
    if (input.cursorOffset !== offset)
      input.cursorOffset = offset;
    if (vim.mode !== "insert")
      clampNormalCursor(input, map);
  }
  function syncVisualSelection(input, map, ctx) {
    if (!isVisualMode(vim.mode) || !vim.visualAnchor) {
      if (!yankFlashActive)
        clearVisualSelection(input);
      return;
    }
    cancelYankFlash();
    const range = vim.mode === "visual-line" ? visualLineRange(map, vim.visualAnchor, vim.cursor) : visualCharRange(map, vim.visualAnchor, vim.cursor);
    if (!range) {
      clearVisualSelection(input);
      return;
    }
    setSelection(input, range.start, range.end, ctx);
  }
  function visualYankRangeFor(map) {
    if (!isVisualMode(vim.mode) || !vim.visualAnchor)
      return;
    return vim.mode === "visual-line" ? visualLineRange(map, vim.visualAnchor, vim.cursor) : visualCharRange(map, vim.visualAnchor, vim.cursor);
  }
  function flashYank(ctx, map, action, visualRange) {
    if (!action)
      return;
    const input = ctx.input();
    if (!input)
      return;
    const range = visualRange ?? yankedTextRange(map, vim.cursor, action.text);
    if (!range)
      return;
    cancelYankFlash();
    yankFlashActive = true;
    setYankSelection(input, range.start, range.end, ctx);
    ctx.requestRender();
    yankTimer = setTimeout(() => {
      yankTimer = undefined;
      if (!yankFlashActive)
        return;
      yankFlashActive = false;
      clearVisualSelection(input);
      ctx.requestRender();
    }, YANK_FLASH_MS);
  }
  function cancelYankFlash() {
    if (yankTimer)
      clearTimeout(yankTimer);
    yankTimer = undefined;
    yankFlashActive = false;
  }
  function shouldFlashYankFor(key) {
    if (isVisualMode(vim.mode))
      return key === "y";
    return vim.operator === "y";
  }
}
function readOnlyKey(key, ctrl, vim) {
  if (key === "Escape")
    return true;
  if (ctrl)
    return false;
  if (vim.phase === "char-pending" || vim.phase === "text-object-pending" || vim.phase === "register-pending")
    return true;
  if (vim.phase === "g-pending")
    return ["g", "j", "k", "0", "^", "$", "ArrowDown", "ArrowUp"].includes(key);
  if ((vim.phase === "operator-pending" || isVisualMode(vim.mode)) && (key === "i" || key === "a"))
    return true;
  return /^[0-9hjklwWbBeE$^gGfFtT;,vVy%{}()"]$/.test(key) || ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key);
}
function isInsertCursorMove(event, key) {
  if (["<Left>", "<Right>", "<Up>", "<Down>", "<Home>", "<End>", "<PageUp>", "<PageDown>"].includes(key))
    return true;
  if (/^<M-(left|right|up|down|home|end)>$/.test(key))
    return true;
  return event.ctrl && ["<C-a>", "<C-b>", "<C-e>", "<C-f>"].includes(key);
}
function forwardWordRange(key, start, buffer, count) {
  let {
    line,
    col
  } = start;
  for (let index = 0;index < count; index++) {
    const text = buffer.getLine(line);
    const kind = wordClass(text[col], key === "W");
    while (col < text.length && wordClass(text[col], key === "W") === kind)
      col++;
    while (col < text.length && /\s/.test(text[col]))
      col++;
    while (col >= buffer.getLineLength(line) && line < buffer.getLineCount() - 1) {
      line++;
      col = 0;
      const next = buffer.getLine(line);
      if (!next.length)
        break;
      while (col < next.length && /\s/.test(next[col]))
        col++;
      if (col < next.length)
        break;
    }
  }
  return {
    start,
    end: {
      line,
      col
    },
    linewise: false,
    inclusive: false
  };
}
function wordClass(char, big) {
  if (!char || /\s/.test(char))
    return "space";
  return big || /\w/.test(char) ? "word" : "punctuation";
}
function visualCharRange(map, anchor, cursor) {
  const anchorOffset = hostOffset(map, anchor);
  const cursorOffset = hostOffset(map, cursor);
  return hostRange(map, anchorOffset, cursorOffset);
}
function visualLineRange(map, anchor, cursor) {
  const startLine = Math.min(anchor.line, cursor.line);
  const endLine = Math.max(anchor.line, cursor.line);
  const start = hostOffset(map, {
    line: startLine,
    col: 0
  });
  const end = hostOffset(map, {
    line: endLine,
    col: vimLineLength(map, endLine)
  });
  return hostRange(map, start, end);
}
function yankedTextRange(map, cursor, text) {
  if (!text)
    return;
  if (text.endsWith(`
`)) {
    const lineCount = text.split(`
`).length - 1;
    return visualLineRange(map, cursor, {
      line: cursor.line + Math.max(0, lineCount - 1),
      col: 0
    });
  }
  const start = vimOffsetFromPosition(map, cursor);
  return vimOffsetRange(map, start, start + text.length - 1);
}
function motionHostRange(map, range) {
  if (range.linewise)
    return visualLineRange(map, range.start, range.end);
  const start = vimOffsetFromPosition(map, range.start);
  const end = vimOffsetFromPosition(map, range.end);
  return vimOffsetRange(map, start, end);
}
function vimOffsetRange(map, left, right) {
  const start = hostFromVimOffset(map, Math.min(left, right));
  const end = hostFromVimOffset(map, Math.max(left, right));
  return hostRange(map, start, end);
}
function hostRange(map, left, right) {
  if (!map.hostText)
    return;
  const dw = map.displayWidth;
  const start = clamp2(Math.min(left, right), 0, Math.max(0, dw - 1));
  const end = clamp2(Math.max(left, right), 0, Math.max(0, dw - 1));
  return {
    start,
    end
  };
}
function yankAction(actions) {
  return actions.find((action) => action.type === "yank");
}
function setSelection(input, start, end, ctx) {
  const colors = ctx.colors;
  setSelectionColors(input, start, end, colors.selection, colors.selectionForeground ?? colors.background);
}
function setYankSelection(input, start, end, ctx) {
  setSelectionColors(input, start, end, ctx.colors.yank, ctx.colors.background);
}
function setSelectionColors(input, start, end, background, foreground) {
  input.selectionBg = background;
  input.selectionFg = foreground;
  if (input.setSelectionInclusive) {
    input.setSelectionInclusive(start, end);
    return;
  }
  const exclusiveEnd = end + 1;
  if (input.setSelection) {
    input.setSelection(start, exclusiveEnd);
    return;
  }
  input.editorView?.setSelection?.(start, exclusiveEnd, background, foreground);
}
function clearVisualSelection(input) {
  if (input.clearSelection) {
    input.clearSelection();
    return;
  }
  input.editorView?.resetSelection?.();
}
function isVisualMode(mode) {
  return mode === "visual" || mode === "visual-line";
}
function clampNormalCursor(input, map) {
  const cursor = input.visualCursor;
  const offset = input.cursorOffset;
  const text = map.hostText;
  if (!cursor)
    return;
  if (cursor.visualCol === 0)
    return;
  const dw = map.displayWidth;
  if (offset >= dw) {
    input.cursorOffset = hostOffset(map, hostPosition(map, Math.max(0, dw - 1)));
    return;
  }
  const charIdx = hostCharOffset(map, offset);
  if (charIdx < text.length && text[charIdx] === `
`) {
    input.cursorOffset = hostOffset(map, hostPosition(map, Math.max(0, offset - 1)));
  }
}
function dispatchCommand(command, ctx) {
  const input = ctx.input();
  if (command === "prompt.history.previous" && input)
    input.cursorOffset = 0;
  if (command === "prompt.history.next" && input)
    input.cursorOffset = input.plainText.length;
  const result = ctx.dispatchCommand(command);
  if (command !== "prompt.history.next" || !result.ok)
    return result;
  const nextInput = ctx.input();
  if (nextInput)
    nextInput.cursorOffset = displayWidth(nextInput.plainText, ctx.widthMethod);
  return result;
}
function defaultHistoryCommand(key, text, historyText, enabled) {
  if (key !== "j" && key !== "k")
    return;
  if (!enabled[key])
    return;
  if (text.length > 0 && text !== historyText)
    return;
  return key === "k" ? "prompt.history.previous" : "prompt.history.next";
}
function syncMode(state, mode) {
  state.setMode(mode === "insert" || mode === "visual" || mode === "visual-line" ? mode : "normal");
}
function pendingDisplay(ctx, keybindPending) {
  const count = ctx.count > 0 ? String(ctx.count) : "";
  if (ctx.phase === "operator-pending")
    return count + (ctx.operator ?? "");
  if (ctx.phase === "text-object-pending")
    return count + (ctx.operator ?? "") + (ctx.textObjectModifier ?? "");
  if (ctx.phase === "char-pending")
    return count + (ctx.operator ?? "") + (ctx.charCommand ?? "");
  if (keybindPending)
    return ctx.statusMessage;
  return count;
}
function plainPending(value) {
  return value.includes("<") || value.includes(">") ? "" : value;
}
function consumesKey(key, actions, ctx, keybindPending) {
  if (actions.length > 0)
    return true;
  if (keybindPending)
    return true;
  if (ctx.phase !== "idle")
    return true;
  return ctx.mode !== "insert" || key === "Escape";
}
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/vim/status.tsx
import { effect as _$effect } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement } from "opentui:runtime-module:%40opentui%2Fsolid";
function VimStatus(props) {
  const modeColor = () => props.colors[props.mode()];
  return (() => {
    var _el$ = _$createElement("box"), _el$2 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$setProp(_el$, "paddingRight", 1);
    _$setProp(_el$, "flexDirection", "row");
    _$setProp(_el$, "flexShrink", 0);
    _$insert(_el$2, (() => {
      var _c$ = _$memo(() => !!props.enabled());
      return () => _c$() ? ` ${modeLabel(props.mode())} ` : "";
    })());
    _$effect((_p$) => {
      var _v$ = modeColor()?.fg ?? (props.mode() === "visual" || props.mode() === "visual-line" ? "#D8A657" : props.mode() === "insert" ? props.theme.success : props.theme.warning), _v$2 = modeColor()?.bg;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$2, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$2, "bg", _v$2, _p$.t));
      return _p$;
    }, {
      e: undefined,
      t: undefined
    });
    return _el$;
  })();
}
function modeLabel(mode) {
  if (mode === "visual")
    return "VISUAL";
  if (mode === "visual-line")
    return "VISUAL LINE";
  return mode === "normal" ? "NORMAL" : "INSERT";
}

// src/ui/session.tsx
import { effect as _$effect6 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert6 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode6 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp6 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement6 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent8 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo6 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { BoxRenderable } from "opentui:runtime-module:%40opentui%2Fcore";
import { createEffect as createEffect3, createSignal as createSignal4, onCleanup as onCleanup6, onMount as onMount3, Show as Show5, untrack as untrack2 } from "opentui:runtime-module:solid-js";

// src/readers/index.tsx
import { createComponent as _$createComponent7 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { mergeProps as _$mergeProps6 } from "opentui:runtime-module:%40opentui%2Fsolid";

// src/readers/default.tsx
import { createComponent as _$createComponent2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { mergeProps as _$mergeProps } from "opentui:runtime-module:%40opentui%2Fsolid";

// src/readers/text.tsx
import { createTextNode as _$createTextNode } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { use as _$use } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { LineNumberRenderable, RGBA } from "opentui:runtime-module:%40opentui%2Fcore";
import { useTerminalDimensions } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createEffect, onCleanup, onMount, Show, untrack } from "opentui:runtime-module:solid-js";

// src/ui/session-keys.ts
import { createKeybindMap as createKeybindMap2, parseKeySequence as parseKeySequence4 } from "@vimee/core";
function sessionModeKey(context, event, sessionKey, mode, mapped) {
  if (event.defaultPrevented || context.keymap.mode.current() !== mode)
    return;
  if (context.keymap.pending().length || event.super || event.meta)
    return;
  const key = keyNotation(event);
  if (!key || key === "<Tab>" && event.shift)
    return;
  if (mapped?.(key) || key === sessionKey)
    return key;
  if (!event.ctrl || key === "<C-[>")
    return key;
  if (pageCommand(key))
    return key;
  if (key === "<C-c>")
    return key;
}
function pageCommand(key) {
  if (key === "<C-d>")
    return "session.half.page.down";
  if (key === "<C-u>")
    return "session.half.page.up";
  if (key === "<C-f>" || key === "<PageDown>")
    return "session.page.down";
  if (key === "<C-b>" || key === "<PageUp>")
    return "session.page.up";
}
function createSessionKeymaps(config, panels) {
  const map = createKeybindMap2();
  const prefixes = new Set;
  let deadline = 0;
  let hint = "";
  const bindings = {
    "<Tab>": "switch-panel",
    ...config.keymaps.session
  };
  for (const [keys, action] of Object.entries(bindings)) {
    if (action === "switch-panel" && !panels)
      continue;
    try {
      const tokens = parseKeySequence4(keys);
      if (action === "passthrough" && tokens.length !== 1)
        continue;
      const binding = {
        keys,
        action
      };
      map.addKeybind("normal", keys, binding);
      prefixes.add(tokens[0]);
      if (action === "switch-panel" && !hint)
        hint = keys === "<Tab>" ? "tab" : keys;
    } catch {}
  }
  function cancel() {
    map.cancel();
    deadline = 0;
  }
  function accepts(key) {
    if (Date.now() >= deadline)
      cancel();
    return map.isPending() || prefixes.has(key);
  }
  function resolve(key) {
    if (Date.now() >= deadline)
      cancel();
    const result = map.resolve(key, "normal");
    if (result.status === "pending") {
      deadline = Date.now() + config.keymapTimeout;
      return "pending";
    }
    deadline = 0;
    if (result.status === "matched")
      return result.definition.action;
  }
  return {
    accepts,
    resolve,
    cancel,
    hint
  };
}

// src/readers/text.tsx
function TextReader(props) {
  const context = props.context;
  const dimensions = useTerminalDimensions();
  const theme = () => context.theme.surface("dialog");
  const background = () => props.label ? theme().background.base : theme().background.raised.high;
  const editorBackground = () => props.gutter?.lineColors ? "transparent" : background();
  const state = createVimState("normal");
  const mappings = createSessionKeymaps(props.config, !!props.leading || !!props.change);
  let input;
  let output;
  const adapter = createVimeeAdapter(state, props.config, () => {}, {
    readOnly: true,
    onYank: props.copy
  });
  const editorContext = {
    input: () => input,
    get widthMethod() {
      return context.renderer.widthMethod;
    },
    get colors() {
      return {
        selection: RGBA.fromHex("#D8A657"),
        yank: theme().text.feedback.info.base,
        background: background()
      };
    },
    setText() {},
    submit() {},
    blur() {},
    dispatchCommand: () => ({
      ok: false
    }),
    requestRender: () => context.renderer.requestRender()
  };
  const onKey = (event) => {
    if (context.renderer.currentFocusedEditor !== input)
      return;
    const key = sessionModeKey(context, event, props.config.sessionKey, "modal", mappings.accepts);
    if (!key) {
      mappings.cancel();
      return;
    }
    if (key === "<Esc>" || key === "<C-[>")
      mappings.cancel();
    const action = !adapter.isPending() ? mappings.resolve(key) : undefined;
    if (action === "passthrough")
      return;
    event.preventDefault();
    event.stopPropagation();
    if (action === "pending")
      return;
    if (action === "switch-panel") {
      if (props.change) {
        adapter.suspend();
        props.change.run();
      } else {
        const next = input === output ? props.leading() : output;
        next.focus();
      }
      return;
    }
    if (key === props.config.sessionKey && state.mode() === "normal" && !adapter.isPending()) {
      props.close();
      return;
    }
    if (key === "<C-c>") {
      props.back();
      return;
    }
    if ((key === "<Esc>" || key === "<C-[>") && state.mode() === "normal" && !adapter.isPending()) {
      props.back();
      return;
    }
    if (pageCommand(key)) {
      const down = key === "<C-d>" || key === "<C-f>" || key === "<PageDown>";
      const half = key === "<C-d>" || key === "<C-u>";
      const rows = Math.max(1, Math.floor(input.height / (half ? 2 : 1)));
      for (let row = 0;row < rows; row++)
        adapter.handle({
          ...event,
          ctrl: false
        }, down ? "j" : "k", editorContext);
    } else
      adapter.handle(event, key, editorContext);
  };
  const onFocus = () => untrack(() => {
    mappings.cancel();
    const focused = context.renderer.currentFocusedEditor;
    if (focused !== output && focused !== props.leading?.())
      return;
    input = focused;
    adapter.attach(editorContext);
  });
  onMount(() => {
    props.highlight?.(output);
    output.cursorOffset = Math.min(props.offset, displayWidth(output.plainText, context.renderer.widthMethod));
    input = props.leading?.() ?? output;
    input.handleKeyPress = () => true;
    input.handlePaste = () => {};
    adapter.attach(editorContext);
    context.renderer.on("focused_editor", onFocus);
    input.focus();
    context.renderer.keyInput.prependListener("keypress", onKey);
  });
  onCleanup(() => {
    props.remember(output.cursorOffset);
    context.renderer.off("focused_editor", onFocus);
    context.renderer.keyInput.off("keypress", onKey);
    adapter.cleanup();
  });
  function modeLabel() {
    if (state.mode() === "visual")
      return "VISUAL";
    if (state.mode() === "visual-line")
      return "VISUAL LINE";
    return "";
  }
  const height = () => props.maxHeight ?? Math.max(1, Math.min(20, dimensions().height - 10));
  const editor = (() => {
    var _el$ = _$createElement2("textarea");
    _$use((value) => {
      output = value;
      output.handleKeyPress = () => true;
      output.handlePaste = () => {};
    }, _el$);
    _$setProp2(_el$, "id", "vim-session-message");
    _$setProp2(_el$, "minHeight", 1);
    _$setProp2(_el$, "minWidth", 0);
    _$setProp2(_el$, "wrapMode", "word");
    _$setProp2(_el$, "showCursor", true);
    _$effect2((_p$) => {
      var _v$ = props.text, _v$2 = height(), _v$3 = props.firstLine === undefined && !props.gutter ? undefined : 1, _v$4 = props.config.cursorStyles.normal, _v$5 = theme().text.base, _v$6 = editorBackground(), _v$7 = editorBackground(), _v$8 = theme().text.base;
      _v$ !== _p$.e && (_p$.e = _$setProp2(_el$, "initialValue", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp2(_el$, "maxHeight", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp2(_el$, "flexGrow", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp2(_el$, "cursorStyle", _v$4, _p$.o));
      _v$5 !== _p$.i && (_p$.i = _$setProp2(_el$, "textColor", _v$5, _p$.i));
      _v$6 !== _p$.n && (_p$.n = _$setProp2(_el$, "backgroundColor", _v$6, _p$.n));
      _v$7 !== _p$.s && (_p$.s = _$setProp2(_el$, "focusedBackgroundColor", _v$7, _p$.s));
      _v$8 !== _p$.h && (_p$.h = _$setProp2(_el$, "focusedTextColor", _v$8, _p$.h));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined,
      i: undefined,
      n: undefined,
      s: undefined,
      h: undefined
    });
    return _el$;
  })();
  let body = editor;
  if (props.firstLine !== undefined || props.gutter) {
    let lastLine = (props.firstLine ?? 1) + props.text.split(`
`).length - 1;
    for (const line of props.gutter?.lineNumbers?.values() ?? [])
      lastLine = Math.max(lastLine, line);
    const gutter = new LineNumberRenderable(context.renderer, {
      id: "vim-file-lines",
      lineNumberOffset: (props.firstLine ?? 1) - 1,
      minWidth: String(lastLine).length + 2,
      ...props.gutter
    });
    gutter.add(output);
    createEffect(() => {
      gutter.fg = theme().text.muted;
      gutter.bg = background();
      gutter.maxHeight = height();
      if (props.gutter?.lineColors)
        gutter.setLineColors(props.gutter.lineColors);
    });
    body = gutter;
  }
  return (() => {
    var _el$2 = _$createElement2("box"), _el$3 = _$createElement2("box"), _el$8 = _$createElement2("box"), _el$0 = _$createElement2("text");
    _$insertNode2(_el$2, _el$3);
    _$insertNode2(_el$2, _el$8);
    _$setProp2(_el$2, "id", "vim-message-reader");
    _$setProp2(_el$2, "gap", 1);
    _$insert2(_el$2, _$createComponent(ReaderHeader, {
      context,
      get title() {
        return props.title;
      },
      get back() {
        return props.back;
      }
    }), _el$3);
    _$insert2(_el$2, () => props.change?.controls(), _el$3);
    _$insert2(_el$2, () => props.details, _el$3);
    _$setProp2(_el$3, "paddingLeft", 2);
    _$setProp2(_el$3, "paddingRight", 2);
    _$insert2(_el$3, _$createComponent(Show, {
      get when() {
        return props.label;
      },
      get children() {
        var _el$4 = _$createElement2("box"), _el$5 = _$createElement2("text"), _el$6 = _$createElement2("b");
        _$insertNode2(_el$4, _el$5);
        _$setProp2(_el$4, "flexDirection", "row");
        _$setProp2(_el$4, "gap", 2);
        _$insertNode2(_el$5, _el$6);
        _$insert2(_el$6, () => props.label);
        _$insert2(_el$4, _$createComponent(Show, {
          get when() {
            return props.status;
          },
          get children() {
            var _el$7 = _$createElement2("text");
            _$insert2(_el$7, () => props.status);
            _$effect2((_$p) => _$setProp2(_el$7, "fg", theme().text.muted, _$p));
            return _el$7;
          }
        }), null);
        _$effect2((_$p) => _$setProp2(_el$5, "fg", theme().text.muted, _$p));
        return _el$4;
      }
    }), null);
    _$insert2(_el$3, body, null);
    _$insertNode2(_el$8, _el$0);
    _$setProp2(_el$8, "paddingLeft", 2);
    _$setProp2(_el$8, "paddingRight", 2);
    _$setProp2(_el$8, "paddingBottom", 1);
    _$setProp2(_el$8, "flexDirection", "row");
    _$setProp2(_el$8, "flexWrap", "wrap");
    _$setProp2(_el$8, "columnGap", 3);
    _$insert2(_el$8, _$createComponent(Show, {
      get when() {
        return modeLabel();
      },
      get children() {
        var _el$9 = _$createElement2("text");
        _$insert2(_el$9, () => ` ${modeLabel()} `);
        _$effect2((_p$) => {
          var _v$9 = props.config.modeColors[state.mode()]?.fg ?? "#D8A657", _v$0 = props.config.modeColors[state.mode()]?.bg;
          _v$9 !== _p$.e && (_p$.e = _$setProp2(_el$9, "fg", _v$9, _p$.e));
          _v$0 !== _p$.t && (_p$.t = _$setProp2(_el$9, "bg", _v$0, _p$.t));
          return _p$;
        }, {
          e: undefined,
          t: undefined
        });
        return _el$9;
      }
    }), _el$0);
    _$insert2(_el$0, () => props.notice() || (state.mode() !== "normal" ? "y copy \xB7 Esc cancel" : `v select${mappings.hint && props.switchLabel ? ` \xB7 ${mappings.hint} ${props.switchLabel}` : ""} \xB7 ${props.config.sessionKey} prompt`));
    _$effect2((_p$) => {
      var _v$1 = props.label ? 0 : 1, _v$10 = props.label ? 0 : 1, _v$11 = background(), _v$12 = theme().text.muted;
      _v$1 !== _p$.e && (_p$.e = _$setProp2(_el$3, "paddingTop", _v$1, _p$.e));
      _v$10 !== _p$.t && (_p$.t = _$setProp2(_el$3, "paddingBottom", _v$10, _p$.t));
      _v$11 !== _p$.a && (_p$.a = _$setProp2(_el$3, "backgroundColor", _v$11, _p$.a));
      _v$12 !== _p$.o && (_p$.o = _$setProp2(_el$0, "fg", _v$12, _p$.o));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined,
      o: undefined
    });
    return _el$2;
  })();
}
function ReaderHeader(props) {
  const theme = () => props.context.theme.surface("dialog");
  return (() => {
    var _el$1 = _$createElement2("box"), _el$10 = _$createElement2("text"), _el$11 = _$createElement2("b"), _el$12 = _$createElement2("text");
    _$insertNode2(_el$1, _el$10);
    _$insertNode2(_el$1, _el$12);
    _$setProp2(_el$1, "paddingLeft", 2);
    _$setProp2(_el$1, "paddingRight", 2);
    _$setProp2(_el$1, "flexDirection", "row");
    _$setProp2(_el$1, "gap", 2);
    _$insertNode2(_el$10, _el$11);
    _$setProp2(_el$10, "flexGrow", 1);
    _$setProp2(_el$10, "flexShrink", 1);
    _$setProp2(_el$10, "minWidth", 0);
    _$setProp2(_el$10, "truncate", true);
    _$insert2(_el$11, () => props.title);
    _$insertNode2(_el$12, _$createTextNode(`esc`));
    _$setProp2(_el$12, "id", "vim-message-close");
    _$effect2((_p$) => {
      var _v$13 = theme().text.base, _v$14 = theme().text.muted, _v$15 = props.back;
      _v$13 !== _p$.e && (_p$.e = _$setProp2(_el$10, "fg", _v$13, _p$.e));
      _v$14 !== _p$.t && (_p$.t = _$setProp2(_el$12, "fg", _v$14, _p$.t));
      _v$15 !== _p$.a && (_p$.a = _$setProp2(_el$12, "onMouseUp", _v$15, _p$.a));
      return _p$;
    }, {
      e: undefined,
      t: undefined,
      a: undefined
    });
    return _el$1;
  })();
}

// src/readers/default.tsx
function DefaultReader(props) {
  return _$createComponent2(TextReader, _$mergeProps(props, {
    get title() {
      return props.message.author;
    },
    get text() {
      return props.message.text;
    }
  }));
}

// src/readers/shell/index.tsx
import { use as _$use2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { mergeProps as _$mergeProps2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { effect as _$effect3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode2 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createSignal as createSignal2, onCleanup as onCleanup3, onMount as onMount2, Show as Show2 } from "opentui:runtime-module:solid-js";
import { useTerminalDimensions as useTerminalDimensions2 } from "opentui:runtime-module:%40opentui%2Fsolid";

// src/readers/shell/data.ts
import { stripVTControlCharacters } from "util";
var OUTPUT_LIMIT = 1024 * 1024;
function shellSnapshot(source) {
  if (source.type === "synthetic") {
    const metadata = source.metadata ?? {};
    const command = source.description ?? "";
    const shellID = typeof metadata.shellID === "string" ? metadata.shellID : undefined;
    const prefix = `<shell id="${metadata.jobID ?? shellID}" state="${metadata.state}" command="${command}">
`;
    const output = source.text.startsWith(prefix) && source.text.endsWith(`
</shell>`) ? source.text.slice(prefix.length, -`
</shell>`.length) : source.text;
    let status = "Completed";
    if (metadata.state === "error")
      status = "Failed";
    else if (metadata.state === "cancelled")
      status = "Cancelled";
    else if (metadata.timeout === true)
      status = "Timed out";
    else if (typeof metadata.signal === "string")
      status = `Killed \xB7 ${metadata.signal}`;
    else if (typeof metadata.exit === "number")
      status = shellStatus("exited", metadata.exit);
    return {
      command,
      shellID,
      status,
      output: cleanOutput(output),
      notice: metadata.truncated === true ? "Saved output is truncated" : ""
    };
  }
  if (source.type === "shell")
    return {
      command: source.command,
      shellID: source.shellID,
      status: shellStatus(source.status, source.exit),
      output: cleanOutput(source.output?.output ?? ""),
      notice: source.output?.truncated ? "Saved output is truncated" : ""
    };
  const state = source.state;
  if (state.status === "streaming")
    return {
      command: "",
      status: "Receiving command\u2026",
      output: "",
      notice: ""
    };
  const metadata = state.metadata ?? {};
  let output = "";
  if (state.status === "completed" || state.status === "error") {
    for (const part of state.content ?? []) {
      if (part.type !== "text")
        continue;
      if (output)
        output += `

`;
      output += part.text;
    }
  }
  let status = state.status === "running" ? "Running \xB7 snapshot" : "Completed";
  if (state.status === "error") {
    status = "Failed";
    if (!output)
      output = state.error.message;
  } else if (metadata.timeout === true)
    status = "Timed out";
  else if (typeof metadata.signal === "string")
    status = `Killed \xB7 ${metadata.signal}`;
  else if (metadata.status === "running")
    status = "Backgrounded";
  else if (typeof metadata.exit === "number")
    status = shellStatus("exited", metadata.exit);
  return {
    command: typeof state.input.command === "string" ? state.input.command : "",
    workdir: typeof state.input.workdir === "string" ? state.input.workdir : undefined,
    shellID: typeof metadata.shellID === "string" ? metadata.shellID : undefined,
    status,
    output: cleanOutput(output),
    notice: metadata.truncated === true ? "Saved output is truncated" : ""
  };
}
function shellStatus(status, exit) {
  if (status === "running")
    return "Running \xB7 snapshot";
  if (status === "timeout")
    return "Timed out";
  if (status === "killed")
    return "Killed";
  return exit === undefined ? "Exited" : `Exited \xB7 code ${exit}`;
}
function cleanOutput(text) {
  return stripVTControlCharacters(text).replace(/\r\n?/g, `
`);
}
async function loadShell(context, sessionID, source, signal) {
  const snapshot = shellSnapshot(source);
  if (!snapshot.shellID)
    return snapshot;
  const location = context.data.session.get(sessionID)?.location ?? context.location;
  const input = {
    id: snapshot.shellID,
    location
  };
  try {
    const [shell, output] = await Promise.all([context.client.shell.get(input, {
      signal
    }), context.client.shell.output({
      ...input,
      cursor: 0,
      limit: OUTPUT_LIMIT
    }, {
      signal
    })]);
    const info = shell.data;
    const page = output.data;
    return {
      ...snapshot,
      command: info.command,
      workdir: info.cwd,
      status: shellStatus(info.status, info.exit),
      output: cleanOutput(page.output),
      notice: page.cursor < page.size ? "Output truncated \xB7 showing first 1 MiB" : ""
    };
  } catch {
    if (signal.aborted)
      return snapshot;
    snapshot.notice = snapshot.notice ? `Capture unavailable \xB7 showing saved result \xB7 ${snapshot.notice}` : "Capture unavailable \xB7 showing saved result";
    return snapshot;
  }
}

// src/readers/syntax.tsx
import { getTreeSitterClient, SyntaxStyle } from "opentui:runtime-module:%40opentui%2Fcore";
import { createEffect as createEffect2, onCleanup as onCleanup2 } from "opentui:runtime-module:solid-js";
function createReaderSyntax(context) {
  const style = SyntaxStyle.create(context.renderer.nativeScene);
  createEffect2(() => {
    const theme = context.theme.surface("dialog");
    const tokens = {
      default: {
        fg: theme.text.base
      }
    };
    for (const [name, color] of Object.entries(theme.syntax))
      tokens[name] = {
        fg: color
      };
    tokens["diff.plus"] = {
      fg: theme.diff.text.added
    };
    tokens["diff.minus"] = {
      fg: theme.diff.text.removed
    };
    tokens["diff.header"] = {
      fg: theme.diff.text.hunkHeader
    };
    for (const [name, token] of Object.entries(tokens))
      style.registerStyle(name, token);
    context.renderer.requestRender();
  });
  onCleanup2(() => style.destroy());
  return style;
}
async function highlightCode(input, style, filetype, signal, widthMethod) {
  const text = input.plainText;
  let result;
  try {
    result = await getTreeSitterClient().highlightOnce(text, filetype);
  } catch {
    return;
  }
  if (signal.aborted || input.isDestroyed || !result.highlights?.length)
    return;
  input.syntaxStyle = style;
  const map = createPromptMap(text, undefined, widthMethod);
  for (const [start, end, scope] of result.highlights) {
    const styleId = style.getStyleId(scope);
    if (styleId === null)
      continue;
    input.addHighlightByCharRange({
      start: highlightOffset(start),
      end: highlightOffset(end),
      styleId
    });
  }
  input.requestRender();
  function highlightOffset(index) {
    const offset = map.vimToDisplay[map.hostToVim[index]];
    return offset - hostPosition(map, offset).line;
  }
}

// src/readers/shell/syntax.tsx
function highlightDiff(input, style, widthMethod) {
  const text = input.plainText;
  if (!/^--- .+\n\+\+\+ .+/m.test(text) || !/^@@ /m.test(text))
    return;
  input.syntaxStyle = style;
  const lines = text.split(`
`);
  for (let row = 0;row < lines.length; row++) {
    const line = lines[row];
    let token;
    if (/^(diff --git |index |--- |\+\+\+ |@@ )/.test(line))
      token = "diff.header";
    else if (line.startsWith("+"))
      token = "diff.plus";
    else if (line.startsWith("-"))
      token = "diff.minus";
    else
      continue;
    input.addHighlight(row, {
      start: 0,
      end: displayWidth(line, widthMethod),
      styleId: style.getStyleId(token)
    });
  }
}

// src/readers/shell/index.tsx
function ShellReader(props) {
  const theme = () => props.context.theme.surface("dialog");
  const dimensions = useTerminalDimensions2();
  const syntax = createReaderSyntax(props.context);
  let command;
  const commandHeight = () => Math.max(1, Math.min(4, Math.floor(dimensions().height / 6)));
  const controller = new AbortController;
  onCleanup3(() => controller.abort());
  const [snapshot, setSnapshot] = createSignal2();
  onMount2(async () => {
    const result = await loadShell(props.context, props.sessionID, props.source, controller.signal);
    if (!controller.signal.aborted)
      setSnapshot(result);
  });
  return (() => {
    var _el$ = _$createElement3("box");
    _$insert3(_el$, _$createComponent3(Show2, {
      get when() {
        return snapshot();
      },
      get fallback() {
        return (() => {
          var _el$2 = _$createElement3("box"), _el$3 = _$createElement3("text");
          _$insertNode3(_el$2, _el$3);
          _$setProp3(_el$2, "gap", 1);
          _$setProp3(_el$2, "paddingBottom", 1);
          _$insert3(_el$2, _$createComponent3(ReaderHeader, {
            get context() {
              return props.context;
            },
            title: "Shell output",
            get back() {
              return props.back;
            }
          }), _el$3);
          _$insertNode3(_el$3, _$createTextNode2(`Loading output\u2026`));
          _$setProp3(_el$3, "paddingLeft", 2);
          _$effect3((_$p) => _$setProp3(_el$3, "fg", theme().text.muted, _$p));
          return _el$2;
        })();
      },
      children: (data) => _$createComponent3(TextReader, _$mergeProps2(props, {
        title: "Shell output",
        get status() {
          return data().status;
        },
        get text() {
          return _$memo3(() => !!data().output)() ? data().output.replace(/\n$/, "") : "No captured output.";
        },
        label: "Output",
        switchLabel: "switch section",
        leading: () => command,
        highlight: (input) => highlightDiff(input, syntax, props.context.renderer.widthMethod),
        get maxHeight() {
          return Math.max(1, Math.min(30, dimensions().height - commandHeight() - (data().notice ? 12 : 10)));
        },
        get details() {
          return (() => {
            var _el$5 = _$createElement3("box"), _el$6 = _$createElement3("box"), _el$7 = _$createElement3("text"), _el$8 = _$createElement3("b"), _el$0 = _$createElement3("textarea");
            _$insertNode3(_el$5, _el$6);
            _$insertNode3(_el$5, _el$0);
            _$setProp3(_el$5, "paddingLeft", 2);
            _$setProp3(_el$5, "paddingRight", 2);
            _$insertNode3(_el$6, _el$7);
            _$setProp3(_el$6, "flexDirection", "row");
            _$setProp3(_el$6, "gap", 2);
            _$insertNode3(_el$7, _el$8);
            _$insertNode3(_el$8, _$createTextNode2(`Command`));
            _$insert3(_el$6, _$createComponent3(Show2, {
              get when() {
                return data().workdir;
              },
              children: (directory) => (() => {
                var _el$10 = _$createElement3("text");
                _$setProp3(_el$10, "flexGrow", 1);
                _$setProp3(_el$10, "flexShrink", 1);
                _$setProp3(_el$10, "minWidth", 0);
                _$setProp3(_el$10, "truncate", true);
                _$insert3(_el$10, () => props.context.ui.format.path(directory()));
                _$effect3((_$p) => _$setProp3(_el$10, "fg", theme().text.muted, _$p));
                return _el$10;
              })()
            }), null);
            _$use2((input) => {
              command = input;
              onMount2(() => {
                highlightCode(input, syntax, "bash", controller.signal, props.context.renderer.widthMethod);
              });
            }, _el$0);
            _$setProp3(_el$0, "id", "vim-shell-command");
            _$setProp3(_el$0, "minHeight", 1);
            _$setProp3(_el$0, "wrapMode", "word");
            _$setProp3(_el$0, "showCursor", true);
            _$insert3(_el$5, _$createComponent3(Show2, {
              get when() {
                return data().notice;
              },
              get children() {
                var _el$1 = _$createElement3("text");
                _$setProp3(_el$1, "marginTop", 1);
                _$setProp3(_el$1, "wrapMode", "word");
                _$insert3(_el$1, () => data().notice);
                _$effect3((_$p) => _$setProp3(_el$1, "fg", theme().text.muted, _$p));
                return _el$1;
              }
            }), null);
            _$effect3((_p$) => {
              var _v$ = theme().text.muted, _v$2 = data().command || "Receiving command\u2026", _v$3 = commandHeight(), _v$4 = props.config.cursorStyles.normal, _v$5 = theme().text.base, _v$6 = theme().text.base, _v$7 = theme().background.base, _v$8 = theme().background.base;
              _v$ !== _p$.e && (_p$.e = _$setProp3(_el$7, "fg", _v$, _p$.e));
              _v$2 !== _p$.t && (_p$.t = _$setProp3(_el$0, "initialValue", _v$2, _p$.t));
              _v$3 !== _p$.a && (_p$.a = _$setProp3(_el$0, "maxHeight", _v$3, _p$.a));
              _v$4 !== _p$.o && (_p$.o = _$setProp3(_el$0, "cursorStyle", _v$4, _p$.o));
              _v$5 !== _p$.i && (_p$.i = _$setProp3(_el$0, "textColor", _v$5, _p$.i));
              _v$6 !== _p$.n && (_p$.n = _$setProp3(_el$0, "focusedTextColor", _v$6, _p$.n));
              _v$7 !== _p$.s && (_p$.s = _$setProp3(_el$0, "backgroundColor", _v$7, _p$.s));
              _v$8 !== _p$.h && (_p$.h = _$setProp3(_el$0, "focusedBackgroundColor", _v$8, _p$.h));
              return _p$;
            }, {
              e: undefined,
              t: undefined,
              a: undefined,
              o: undefined,
              i: undefined,
              n: undefined,
              s: undefined,
              h: undefined
            });
            return _el$5;
          })();
        }
      }))
    }));
    return _el$;
  })();
}

// src/readers/read/index.tsx
import { createComponent as _$createComponent4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { mergeProps as _$mergeProps3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { pathToFiletype } from "opentui:runtime-module:%40opentui%2Fcore";
import { useTerminalDimensions as useTerminalDimensions3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { onCleanup as onCleanup4 } from "opentui:runtime-module:solid-js";
function ReadReader(props) {
  const data = props.snapshot;
  const dimensions = useTerminalDimensions3();
  const syntax = createReaderSyntax(props.context);
  const filetype = pathToFiletype(data.path);
  const controller = new AbortController;
  onCleanup4(() => controller.abort());
  return _$createComponent4(TextReader, _$mergeProps3(props, {
    get title() {
      return props.context.ui.format.path(data.path);
    },
    get text() {
      return data.text;
    },
    get label() {
      return _$memo4(() => !!data.end)() ? `Lines ${data.start}\u2013${data.end}` : "Empty file";
    },
    get status() {
      return _$memo4(() => !!data.clipped)() ? "Partial file \xB7 Long lines truncated" : data.partial ? "Partial file" : undefined;
    },
    get firstLine() {
      return _$memo4(() => !!data.end)() ? data.start : undefined;
    },
    get maxHeight() {
      return Math.max(1, Math.min(30, dimensions().height - 8));
    },
    highlight: (input) => {
      if (filetype)
        highlightCode(input, syntax, filetype, controller.signal, props.context.renderer.widthMethod);
    }
  }));
}

// src/readers/read/data.ts
function readSnapshot(source) {
  const state = source.state;
  if (state.status !== "completed" || state.content.length !== 1)
    return;
  const content = state.content[0];
  if (content.type !== "text")
    return;
  const rows = content.text.replace(/\r\n/g, `
`).split(`
`);
  const header = /^Read file (.+), (?:lines ([1-9]\d*)-([1-9]\d*)|0 lines)$/.exec(rows[0]);
  if (!header)
    return;
  const start = Number(header[2] ?? 1);
  const end = Number(header[3] ?? 0);
  const continuation = /^\[Output truncated\. Continue reading with offset: \d+\]$/.test(rows.at(-1));
  if (continuation)
    rows.pop();
  const count = header[2] ? end - start + 1 : 0;
  if (header[2] && end < start || rows.length !== count + 1)
    return;
  const lines = [];
  let clipped = false;
  for (let index = 0;index < count; index++) {
    const prefix = `${start + index}: `;
    const row = rows[index + 1];
    if (!row.startsWith(prefix))
      return;
    const line = row.slice(prefix.length);
    if (line.endsWith("... (line truncated to 2000 chars)"))
      clipped = true;
    lines.push(line);
  }
  return {
    path: header[1],
    text: lines.join(`
`),
    start,
    end,
    partial: start > 1 || continuation || state.metadata?.truncated === true || clipped,
    clipped
  };
}

// src/readers/diff/index.tsx
import { effect as _$effect4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createTextNode as _$createTextNode3 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { mergeProps as _$mergeProps4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo5 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent5 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { pathToFiletype as pathToFiletype2 } from "opentui:runtime-module:%40opentui%2Fcore";
import { useTerminalDimensions as useTerminalDimensions4 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createMemo, createSignal as createSignal3, For, onCleanup as onCleanup5, Show as Show3 } from "opentui:runtime-module:solid-js";

// src/readers/diff/data.ts
import { parsePatch } from "diff";
function diffSnapshot(message) {
  const source = message.source;
  if (source?.type !== "tool" || source.name !== "edit" && source.name !== "patch" || source.state.status !== "completed")
    return;
  const raw = source.state.metadata?.files;
  if (!Array.isArray(raw))
    return;
  const files = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item))
      continue;
    const path = item.file ?? item.relativePath;
    const status = item.status ?? (item.type === "add" ? "added" : item.type === "delete" ? "deleted" : item.type === "update" ? "modified" : undefined);
    if (typeof path !== "string" || typeof item.patch !== "string" || typeof item.additions !== "number" || typeof item.deletions !== "number")
      continue;
    if (status !== "added" && status !== "deleted" && status !== "modified")
      continue;
    files.push({
      path,
      status,
      additions: item.additions,
      deletions: item.deletions,
      patch: item.patch
    });
  }
  if (source.name === "patch" && files.length > 1 && message.fileIndex === undefined)
    return;
  const file = files[message.fileIndex ?? 0];
  if (!file)
    return;
  try {
    const patches = parsePatch(file.patch);
    if (patches.length !== 1 || !patches[0].hunks.length)
      return;
    return {
      path: file.path,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      hunks: patches[0].hunks
    };
  } catch {
    return;
  }
}
function availableViews(snapshot) {
  if (snapshot.status === "added")
    return ["after", "diff"];
  if (snapshot.status === "deleted")
    return ["before", "diff"];
  return ["after", "before", "diff"];
}
function diffContent(hunks, view) {
  const lines = [];
  const numbers = new Map;
  const signs = new Map;
  const hideLineNumbers = new Set;
  let start;
  let end = 0;
  for (const hunk of hunks) {
    let before = hunk.oldStart;
    let after = hunk.newStart;
    let first = true;
    for (const line of hunk.lines) {
      const sign = line[0];
      if (sign === "\\")
        continue;
      const include = view === "diff" || (view === "before" ? sign !== "+" : sign !== "-");
      if (include) {
        if (first && lines.length) {
          hideLineNumbers.add(lines.length);
          lines.push("");
        }
        first = false;
        const row = lines.length;
        const number = sign === "-" || view === "before" ? before : after;
        start ??= number;
        end = number;
        numbers.set(row, number);
        if (view === "diff" && (sign === "+" || sign === "-"))
          signs.set(row, sign);
        lines.push(line.slice(1));
      }
      if (sign !== "+")
        before++;
      if (sign !== "-")
        after++;
    }
  }
  if (!lines.length)
    hideLineNumbers.add(0);
  return {
    text: lines.join(`
`),
    numbers,
    signs,
    hideLineNumbers,
    start: start ?? 0,
    end,
    empty: !lines.length
  };
}

// src/readers/diff/index.tsx
function DiffReader(props) {
  const data = props.snapshot;
  const views = availableViews(data);
  const labels = {
    after: "After",
    before: "Before",
    diff: "Diff"
  };
  const initial = views.includes(props.config.diffView) ? props.config.diffView : views[0];
  const [view, setView] = createSignal3(initial);
  const dimensions = useTerminalDimensions4();
  const syntax = createReaderSyntax(props.context);
  const filetype = pathToFiletype2(data.path);
  const positions = new Map([[initial, props.offset]]);
  function switchView() {
    setView(views[(views.indexOf(view()) + 1) % views.length]);
  }
  return (() => {
    var _el$ = _$createElement4("box");
    _$insert4(_el$, _$createComponent5(Show3, {
      get when() {
        return view();
      },
      keyed: true,
      children: (current) => {
        const content = diffContent(data.hunks, current);
        const controller = new AbortController;
        onCleanup5(() => controller.abort());
        const theme = () => props.context.theme.surface("dialog");
        const signs = new Map;
        for (const [row, sign] of content.signs)
          signs.set(row, {
            after: sign,
            afterColor: sign === "+" ? theme().diff.text.added : theme().diff.text.removed
          });
        const lineColors = createMemo(() => {
          if (current !== "diff")
            return;
          const colors = new Map;
          for (const [row, sign] of content.signs) {
            const kind = sign === "+" ? "added" : "removed";
            colors.set(row, {
              content: theme().diff.background[kind],
              gutter: theme().diff.lineNumber.background[kind]
            });
          }
          return colors;
        });
        const title = current === "after" ? "Code after change" : current === "before" ? "Code before change" : "Changes";
        const range = content.empty ? " \xB7 No lines" : data.hunks.length > 1 ? " \xB7 Saved excerpts" : current === "diff" ? "" : ` \xB7 Lines ${content.start}\u2013${content.end}`;
        return _$createComponent5(TextReader, _$mergeProps4(props, {
          get title() {
            return props.context.ui.format.path(data.path);
          },
          get text() {
            return content.text;
          },
          switchLabel: "switch view",
          label: `${title}${range}`,
          get status() {
            return `${data.status === "added" ? "Added" : data.status === "deleted" ? "Deleted" : "Modified"} \xB7 +${data.additions} \u2212${data.deletions}`;
          },
          get maxHeight() {
            return Math.max(1, Math.min(30, dimensions().height - 12));
          },
          get gutter() {
            return {
              lineNumbers: content.numbers,
              lineSigns: signs,
              hideLineNumbers: content.hideLineNumbers,
              lineColors: lineColors()
            };
          },
          get offset() {
            return positions.get(current) ?? 0;
          },
          remember: (offset) => {
            positions.set(current, offset);
            if (current === initial)
              props.remember(offset);
          },
          change: {
            run: switchView,
            controls: () => (() => {
              var _el$2 = _$createElement4("box"), _el$3 = _$createElement4("text");
              _$insertNode4(_el$2, _el$3);
              _$setProp4(_el$2, "paddingLeft", 2);
              _$setProp4(_el$2, "paddingRight", 2);
              _$setProp4(_el$2, "flexDirection", "row");
              _$setProp4(_el$2, "gap", 1);
              _$insertNode4(_el$3, _$createTextNode3(`View`));
              _$insert4(_el$2, _$createComponent5(For, {
                each: views,
                children: (value) => (() => {
                  var _el$5 = _$createElement4("text"), _el$6 = _$createElement4("b");
                  _$insertNode4(_el$5, _el$6);
                  _$setProp4(_el$5, "id", `vim-change-view-${value}`);
                  _$setProp4(_el$5, "onMouseUp", (event) => {
                    event.stopPropagation();
                    setView(value);
                  });
                  _$insert4(_el$6, () => ` ${labels[value]} `);
                  _$effect4((_p$) => {
                    var _v$ = value === current ? theme().text.action.primary.focused : theme().text.muted, _v$2 = value === current ? theme().background.action.primary.focused : undefined;
                    _v$ !== _p$.e && (_p$.e = _$setProp4(_el$5, "fg", _v$, _p$.e));
                    _v$2 !== _p$.t && (_p$.t = _$setProp4(_el$5, "bg", _v$2, _p$.t));
                    return _p$;
                  }, {
                    e: undefined,
                    t: undefined
                  });
                  return _el$5;
                })()
              }), null);
              _$effect4((_$p) => _$setProp4(_el$3, "fg", theme().text.muted, _$p));
              return _el$2;
            })()
          },
          highlight: (input) => {
            if (filetype)
              highlightCode(input, syntax, filetype, controller.signal, props.context.renderer.widthMethod);
          }
        }));
      }
    }));
    return _el$;
  })();
}

// src/readers/subagent/index.tsx
import { effect as _$effect5 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode5 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert5 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp5 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement5 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent6 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { mergeProps as _$mergeProps5 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { Show as Show4 } from "opentui:runtime-module:solid-js";

// src/readers/subagent/data.ts
function subagentSnapshot(source, messages = []) {
  if (source.type === "synthetic") {
    const metadata = source.metadata ?? {};
    const description = source.description ?? "";
    const prefix = `<subagent sessionID="${metadata.childID}" state="${metadata.state}" description="${description}">
`;
    return {
      description,
      status: metadata.state === "error" ? "Failed" : metadata.state === "cancelled" ? "Cancelled" : "Completed",
      response: unwrap(source.text, prefix)
    };
  }
  const state = source.state;
  if (state.status === "streaming")
    return {
      description: "",
      status: "Delegating\u2026",
      response: "No response yet."
    };
  const description = typeof state.input.description === "string" ? state.input.description : "";
  const metadata = state.metadata ?? {};
  if (state.status === "completed" && metadata.status === "running") {
    for (const message of messages) {
      if (message.type === "assistant") {
        for (const part of message.content) {
          if (part.type === "tool" && part.name === "subagent" && part.time.created > source.time.created && part.state.status !== "streaming" && part.state.input.sessionID === metadata.sessionID)
            return {
              description,
              status: "Backgrounded",
              response: "No saved response for this subagent call."
            };
        }
      }
      if (message.type === "synthetic" && message.metadata?.source === "subagent" && typeof metadata.sessionID === "string" && message.metadata.childID === metadata.sessionID && message.description === description && message.time.created >= source.time.created)
        return subagentSnapshot(message);
    }
    return {
      description,
      status: "Backgrounded",
      response: "No saved response yet. Reopen after the subagent finishes."
    };
  }
  if (state.status === "running")
    return {
      description,
      status: "Running",
      response: "No response yet."
    };
  const prefix = `<subagent sessionID="${metadata.sessionID}" state="completed">
`;
  let response = "";
  for (const part of state.content ?? []) {
    if (part.type !== "text")
      continue;
    if (response)
      response += `

`;
    response += unwrap(part.text, prefix);
  }
  if (state.status === "error")
    return {
      description,
      status: "Failed",
      response: response || state.error.message
    };
  return {
    description,
    status: "Completed",
    response: response || "Subagent completed without a text response."
  };
}
function unwrap(text, prefix) {
  const suffix = `
</subagent>`;
  if (text.startsWith(prefix) && text.endsWith(suffix))
    return text.slice(prefix.length, -suffix.length);
  return text;
}

// src/readers/subagent/index.tsx
function SubagentReader(props) {
  const source = props.source;
  const messages = source.type === "tool" && source.state.status === "completed" && source.state.metadata?.status === "running" ? props.context.data.session.message.list(props.sessionID) : [];
  const snapshot = subagentSnapshot(source, messages);
  const theme = () => props.context.theme.surface("dialog");
  return _$createComponent6(TextReader, _$mergeProps5(props, {
    title: "Subagent response",
    label: "Response",
    get status() {
      return snapshot.status;
    },
    get text() {
      return snapshot.response;
    },
    get details() {
      return _$createComponent6(Show4, {
        get when() {
          return snapshot.description;
        },
        get children() {
          var _el$ = _$createElement5("box"), _el$2 = _$createElement5("text");
          _$insertNode5(_el$, _el$2);
          _$setProp5(_el$, "paddingLeft", 2);
          _$setProp5(_el$, "paddingRight", 2);
          _$setProp5(_el$2, "truncate", true);
          _$insert5(_el$2, () => snapshot.description);
          _$effect5((_$p) => _$setProp5(_el$2, "fg", theme().text.muted, _$p));
          return _el$;
        }
      });
    }
  }));
}

// src/readers/index.tsx
function Reader(props) {
  props.context.ui.dialog.set({
    size: "large",
    centered: true
  });
  const source = props.message.source;
  if (source?.type === "tool" && source.name === "subagent" || source?.type === "synthetic" && source.metadata?.source === "subagent") {
    return _$createComponent7(SubagentReader, _$mergeProps6(props, {
      source
    }));
  }
  if (source?.type === "shell" || source?.type === "tool" && source.name === "shell" || source?.type === "synthetic" && source.metadata?.source === "shell") {
    return _$createComponent7(ShellReader, _$mergeProps6(props, {
      source
    }));
  }
  if (source?.type === "tool" && source.name === "read") {
    const snapshot = readSnapshot(source);
    if (snapshot)
      return _$createComponent7(ReadReader, _$mergeProps6(props, {
        snapshot
      }));
  }
  if (source?.type === "tool" && (source.name === "edit" || source.name === "patch")) {
    const snapshot = diffSnapshot(props.message);
    if (snapshot)
      return _$createComponent7(DiffReader, _$mergeProps6(props, {
        snapshot
      }));
  }
  return _$createComponent7(DefaultReader, props);
}

// src/transcript.tsx
import { MouseEvent, ScrollBoxRenderable } from "opentui:runtime-module:%40opentui%2Fcore";

// src/transcript-items.tsx
import { MarkdownRenderable, TextBufferRenderable } from "opentui:runtime-module:%40opentui%2Fcore";
function parts(messages) {
  const result = [];
  for (const message of messages) {
    if (message.type === "assistant") {
      const ordinal = {
        text: 0,
        reasoning: 0
      };
      for (const part of message.content) {
        const partID = part.type === "tool" ? part.id : `${part.type}:${ordinal[part.type]++}`;
        let text = part.type === "tool" ? "" : part.text;
        if (part.type === "reasoning")
          text = text.replace("[REDACTED]", "");
        if (part.type !== "tool" && !text.trim())
          continue;
        result.push({
          id: `session-part:${message.id}:${partID}`,
          messageID: message.id,
          kind: part.type,
          author: part.type === "text" ? "Assistant" : part.type === "reasoning" ? "Reasoning" : part.name,
          text,
          source: part,
          group: part.type === "reasoning" ? "reasoning" : part.type === "tool" && ["read", "glob", "grep", "webfetch", "websearch"].includes(part.name.toLowerCase()) ? "exploration" : undefined
        });
      }
      if (message.finish && message.finish !== "tool-calls" && message.finish !== "unknown" || message.error || message.retry) {
        result.push({
          id: `footer:${message.id}`,
          messageID: message.id,
          kind: "footer",
          author: "",
          text: ""
        });
      }
    } else if (message.type === "synthetic" && (message.metadata?.source === "shell" || message.metadata?.source === "subagent") && message.description?.trim()) {
      const state = message.metadata.state;
      const status = state === "completed" ? "finished" : state === "error" ? "failed" : state ?? "finished";
      const shell = message.metadata.source === "shell";
      const agent = typeof message.metadata.agent === "string" ? message.metadata.agent : "Subagent";
      const actor = shell ? "Shell" : agent.replace(/\b\w/g, (letter) => letter.toUpperCase());
      const description = shell ? message.description.replace(/\s+/g, " ").trim() : message.description;
      result.push({
        id: message.id,
        messageID: message.id,
        kind: "message",
        author: actor,
        text: message.text,
        source: message,
        label: `${state === "completed" ? "\u21B3" : "!"} ${actor} ${status} \xB7 ${description}`
      });
    } else {
      result.push({
        id: message.id,
        messageID: message.id,
        kind: "message",
        author: message.type === "user" ? "You" : message.type,
        text: message.type === "user" ? message.text : "",
        source: message
      });
    }
  }
  return result;
}
function textOf(node) {
  if (!node.visible)
    return "";
  if (node instanceof MarkdownRenderable)
    return node.content;
  if (node instanceof TextBufferRenderable)
    return node.plainText;
  let text = "";
  let previous;
  for (const child of node.getChildren()) {
    const value = textOf(child);
    if (!value)
      continue;
    if (text)
      text += previous?.y === child.y ? " " : `
`;
    text += value;
    previous = child;
  }
  return text;
}
function groupAt(node) {
  const header = node.getChildren()[0];
  if (!header)
    return;
  const body = header.getChildren()[0];
  let label;
  if (body instanceof TextBufferRenderable) {
    if (!body.plainText.startsWith("\u22EF "))
      return;
    label = body.plainText.slice(2).trim();
  } else {
    const cells = body?.getChildren() ?? [];
    if (cells.length < 2 || !cells.slice(1).every((cell) => cell instanceof TextBufferRenderable))
      return;
    label = cells.slice(1).map((cell) => cell.plainText).join(" ").trim();
  }
  let kind;
  if (/^(Thought|Thinking)(?:$|[: \u00B7\u2026])/.test(label))
    kind = "reasoning";
  else if (/^Explor(?:ed|ing):/.test(label))
    kind = "exploration";
  else if (/^Instructions:/.test(label))
    kind = "instructions";
  else if (/^(?:\d+ (?:commands?|edits?|thoughts?|reads?|tools?|instructions?)(?:, |$))+$/.test(label) || /^(?:Running|Preparing) .+\u2026$/.test(label))
    kind = "activity";
  else
    return;
  return {
    header,
    kind,
    label,
    children: node.getChildren().slice(1)
  };
}
function patchFiles(node) {
  if (!node.visible || !node.height)
    return [];
  const header = node.getChildren()[0];
  const label = header?.getChildren()[0];
  if (label instanceof TextBufferRenderable && ["\u2190 Patched", "# Created", "# Deleted"].includes(label.plainText)) {
    return [node];
  }
  const files = [];
  for (const child of node.getChildren())
    files.push(...patchFiles(child));
  return files;
}
function transcriptItems(rows, messages, pendingTools = new Set) {
  const sources = parts(messages);
  const ranges = [];
  let cursor = 0;
  let lastSource = -1;
  function add(node, source, parentID) {
    if (source?.source?.type === "tool" && source.source.name === "patch") {
      const files = patchFiles(node);
      if (files.length > 1) {
        for (const [index, file] of files.entries())
          add(file, {
            ...source,
            id: `${source.id}:file:${index}`,
            fileIndex: index
          }, parentID);
        return;
      }
    }
    const text = source?.text || textOf(node);
    if (!text.trim())
      return;
    ranges.push({
      id: source?.id ?? node.id,
      author: source?.author ?? "Tool",
      text,
      source: source?.source,
      fileIndex: source?.fileIndex,
      node,
      top: node.y,
      bottom: node.y + node.height,
      parentID
    });
  }
  function belongs(part, kind) {
    if (kind !== "activity")
      return part.group === kind;
    if (part.source?.type === "tool" && part.source.name === "question")
      return false;
    return part.kind === "tool" || part.kind === "reasoning";
  }
  function group(node, items, parentID, pending = []) {
    const info = groupAt(node);
    if (!info)
      return false;
    const id = node.id;
    ranges.push({
      id,
      author: info.label,
      text: info.label,
      node: info.header,
      top: info.header.y,
      bottom: info.header.y + info.header.height,
      toggle: info.header,
      parentID
    });
    const ordinaryCount = info.children.length - pending.length;
    let children = info.children.slice(0, ordinaryCount);
    if (info.kind !== "exploration" && children.length) {
      children = children[0].getChildren();
    }
    let index = 0;
    for (const child of children) {
      if (!child.visible || !child.height)
        continue;
      const nested = groupAt(child);
      if (nested) {
        const start = index;
        while (index < items.length && belongs(items[index], nested.kind))
          index++;
        group(child, items.slice(start, index), id);
      } else
        add(child, items[index++], id);
    }
    for (let index = 0;index < pending.length; index++) {
      add(info.children[ordinaryCount + index], pending[index], id);
    }
    return true;
  }
  for (const row of rows) {
    if (row.id === "session-navigation-slack")
      break;
    if (!row.visible || !row.height)
      continue;
    const anchor = row.getChildren()[0];
    const info = anchor && groupAt(anchor);
    let index = sources.findIndex((part) => part.id === row.id);
    if (index === -1) {
      index = sources.findIndex((part, position) => position >= cursor && part.messageID === row.id);
      if (index !== -1 && !info) {
        const text = textOf(row).trim();
        const match = sources.findIndex((part, position) => position >= cursor && part.messageID === row.id && part.text.trim() === text);
        if (text && match !== -1)
          index = match;
      }
    }
    if (index === -1 && !info) {
      const text = textOf(row).trim();
      if (text)
        index = sources.findIndex((part, position) => position >= cursor && part.label !== undefined && (part.label === text || text.endsWith("\u2026") && part.label.startsWith(text.slice(0, -1))));
    }
    if (index !== -1)
      cursor = index;
    if (!info && index === -1 && sources[cursor]?.kind === "footer") {
      lastSource = cursor++;
      continue;
    }
    const container = anchor && !(anchor instanceof TextBufferRenderable) && !(anchor instanceof MarkdownRenderable);
    if (index === -1 && !info && sources[cursor]?.group && container)
      index = cursor;
    if (index === -1 && !info && sources[cursor]?.source?.type === "shell" && container)
      index = cursor;
    if (anchor && info) {
      const items = [];
      const pending = [];
      while (cursor < sources.length) {
        const part = sources[cursor];
        if (!belongs(part, info.kind))
          break;
        if (part.source?.type === "tool" && pendingTools.has(part.source.id))
          pending.push(part);
        else
          items.push(part);
        lastSource = cursor++;
      }
      group(anchor, items, undefined, pending);
    } else if (index !== -1) {
      const source = sources[index];
      if (source.kind === "footer") {
        lastSource = cursor++;
      } else if (source.group && container && anchor.getChildren().length) {
        const children = anchor.getChildren();
        const ordinary = [];
        const pending = [];
        for (const part of sources.slice(cursor, cursor + children.length)) {
          if (part.source?.type === "tool" && pendingTools.has(part.source.id))
            pending.push(part);
          else
            ordinary.push(part);
        }
        const ordered = [...ordinary, ...pending];
        for (const [index, child] of children.entries())
          add(child, ordered[index]);
        cursor += children.length;
        lastSource = cursor - 1;
      } else {
        add(row, source);
        lastSource = cursor++;
      }
    }
  }
  let last = sources.length - 1;
  while (last >= 0 && (sources[last].kind === "footer" || sources[last].kind === "message" && sources[last].source?.type !== "shell") && !sources[last].text)
    last--;
  return {
    ranges,
    hasLatest: lastSource >= last
  };
}

// src/transcript.tsx
function createTranscriptSelection(context, sessionID, select) {
  let scroll;
  let requestedID;
  let selectedParents = [];
  let navigation;
  function items(rows) {
    const pending = new Set;
    for (const request of context.data.session.permission.list(sessionID) ?? []) {
      if (request.source?.type === "tool")
        pending.add(request.source.id);
    }
    return transcriptItems(rows, context.data.session.message.list(sessionID), pending);
  }
  function choose(range, view) {
    requestedID = range.id;
    select(requestedID);
    let delta = 0;
    if (range.bottom <= view.top)
      delta = range.top - view.top;
    else if (range.top >= view.bottom) {
      delta = range.top - view.top - Math.max(0, view.bottom - view.top - (range.bottom - range.top));
    }
    if (delta) {
      const slack = view.scroll.getRenderable("session-navigation-slack")?.height ?? 0;
      const maximum = Math.max(0, view.scroll.scrollHeight - slack - view.scroll.viewport.height);
      const position = Math.max(0, Math.min(maximum, view.scroll.scrollTop + delta));
      if (slack)
        context.keymap.dispatch(delta < 0 ? "session.line.up" : "session.line.down");
      view.scroll.scrollTo(position);
    }
    context.renderer.requestRender();
  }
  function advance() {
    if (!navigation)
      return;
    const view = inspect();
    const ranges = view?.ranges ?? [];
    const from = navigation.from ? ranges.findIndex((range) => range.id === navigation.from) : ranges.length;
    if (navigation.from && from === -1) {
      navigation = undefined;
      return;
    }
    const target = navigation.latest ? ranges.length - 1 : from + navigation.offset;
    const loading = navigation.loading;
    if (loading && context.renderer.frameId < loading.frame) {
      context.renderer.requestRender();
      return;
    }
    if (view && loading?.up && view.scroll.scrollHeight > loading.height) {
      const maximum = Math.max(0, view.scroll.scrollHeight - view.scroll.viewport.height);
      const compensated = Math.max(0, Math.min(maximum, view.scroll.scrollHeight - loading.height - 1));
      if (view.scroll.scrollTop < compensated)
        return;
    }
    if (view && target >= 0 && target < ranges.length && (!navigation.latest || view.hasLatest)) {
      navigation = undefined;
      choose(ranges[target], view);
      return;
    }
    const up = !navigation.latest && target < 0;
    const messages = context.data.session.message.list(sessionID);
    const key = `${messages[0]?.id}:${messages.length}:${ranges[0]?.id}:${ranges.at(-1)?.id}:${view?.scroll.scrollHeight}`;
    if (loading?.key === key)
      return;
    navigation.loading = {
      key,
      frame: context.renderer.frameId + 2,
      up,
      height: view?.scroll.scrollHeight ?? 0
    };
    view?.scroll.scrollTo(up ? 0 : view.scroll.scrollHeight);
    context.keymap.dispatch(up ? "session.line.up" : "session.line.down");
    context.renderer.requestRender();
  }
  function latest() {
    if (!context.data.session.message.list(sessionID).length) {
      navigation = undefined;
      requestedID = undefined;
      select(undefined);
      return;
    }
    navigation = {
      from: undefined,
      offset: 0,
      latest: true
    };
    advance();
  }
  function move(direction, count) {
    if (navigation && (navigation.latest || navigation.offset < 0 && direction === "next" || navigation.offset > 0 && direction === "previous")) {
      navigation = undefined;
    }
    navigation ??= {
      from: requestedID ?? inspect()?.selected?.id,
      offset: 0
    };
    navigation.offset += direction === "next" ? count : -count;
    if (navigation.loading)
      navigation.loading.key = "";
    advance();
  }
  function inspect() {
    function findScroll(node) {
      if (!node.visible)
        return;
      if (node instanceof ScrollBoxRenderable && items(node.getChildren()).ranges.length)
        return node;
      for (const child of node.getChildren()) {
        const found = findScroll(child);
        if (found)
          return found;
      }
    }
    if (!scroll || scroll.isDestroyed)
      scroll = findScroll(context.renderer.root);
    if (!scroll) {
      select(undefined);
      return;
    }
    const {
      ranges,
      hasLatest
    } = items(scroll.getChildren());
    const top = scroll.viewport.y;
    const bottom = top + scroll.viewport.height;
    let selected = ranges.find((range) => range.id === requestedID);
    if (!selected && requestedID) {
      for (const id of selectedParents) {
        selected = ranges.find((range) => range.id === id);
        if (selected) {
          requestedID = id;
          break;
        }
      }
      if (!selected)
        requestedID = undefined;
    }
    selected ??= ranges.find((range) => range.top <= top + 1 && range.bottom > top + 1) ?? ranges.find((range) => range.bottom > top && range.top < bottom);
    selectedParents = [];
    let parent = selected?.parentID;
    while (parent) {
      selectedParents.push(parent);
      parent = ranges.find((range) => range.id === parent)?.parentID;
    }
    select(selected?.id);
    return {
      scroll,
      selected,
      ranges,
      hasLatest,
      top,
      bottom
    };
  }
  return {
    latest,
    move,
    get(id) {
      if (!scroll || scroll.isDestroyed)
        return;
      return items(scroll.getChildren()).ranges.find((range) => range.id === id);
    },
    toggle() {
      const range = inspect()?.selected;
      if (!range?.toggle)
        return false;
      navigation = undefined;
      requestedID = range.id;
      const node = range.toggle;
      node.processMouseEvent(new MouseEvent(node, {
        type: "up",
        button: 0,
        x: node.x,
        y: node.y,
        modifiers: {
          shift: false,
          alt: false,
          ctrl: false
        }
      }));
      context.renderer.requestRender();
      return true;
    },
    followViewport() {
      navigation = undefined;
      requestedID = undefined;
      selectedParents = [];
    },
    sync() {
      advance();
      navigation = undefined;
      return inspect();
    },
    draw(buffer, yankID) {
      advance();
      const view = inspect();
      if (!view?.selected)
        return;
      const top = Math.max(0, view.top, view.selected.top);
      const bottom = Math.min(buffer.height, view.bottom, view.selected.bottom);
      if (view.selected.id === yankID) {
        const node = view.selected.node;
        const left = Math.max(0, view.scroll.viewport.x, node.x);
        const right = Math.min(buffer.width, view.scroll.viewport.x + view.scroll.viewport.width, node.x + node.width);
        const foreground = context.theme.background.base.buffer;
        const background = context.theme.text.feedback.info.base.buffer;
        const colors = buffer.buffers;
        for (let y = top;y < bottom; y++) {
          for (let x = left;x < right; x++) {
            const offset = (y * buffer.width + x) * 4;
            colors.fg.set(foreground, offset);
            colors.bg.set(background, offset);
          }
        }
      }
      const x = view.scroll.x - 1;
      if (x < 0)
        return;
      for (let y = top;y < bottom; y++) {
        buffer.drawText("\u258E", x, y, context.theme.text.feedback.info.base, context.theme.background.base);
      }
    }
  };
}

// src/ui/session.tsx
var SESSION_MODE = "opencode-vim.session";
function createSessionMode(context, config, clipboard) {
  const mappings = createSessionKeymaps(config, false);
  const [active, setActive] = createSignal4(false);
  const [reading, setReading] = createSignal4();
  const [notice, setNotice] = createSignal4("");
  const positions = new Map;
  let sessionID = "";
  let selectedID;
  let prompt = null;
  let focusTarget;
  let transcript;
  let popMode;
  let prefix = "";
  let count = "";
  let disposed = false;
  let noticeTimer;
  let yankTimer;
  let yankID;
  context.keymap.layer(() => ({
    mode: SESSION_MODE,
    bindings: ["agent.cycle", "agent.cycle.reverse"]
  }));
  function selected() {
    return transcript?.get(selectedID);
  }
  function clearYankFlash() {
    if (yankTimer)
      clearTimeout(yankTimer);
    yankTimer = undefined;
    if (!yankID)
      return;
    yankID = undefined;
    context.renderer.requestRender();
  }
  function close(restoreFocus = true) {
    if (!active())
      return;
    clearYankFlash();
    if (reading())
      context.ui.dialog.clear();
    setActive(false);
    context.renderer.removePostProcessFn(draw);
    popMode?.();
    popMode = undefined;
    focusTarget?.destroy();
    focusTarget = undefined;
    transcript = undefined;
    const route = context.ui.router.current();
    if (restoreFocus && context.keymap.mode.current() === "base" && route.type === "session" && route.sessionID === sessionID && prompt && !prompt.isDestroyed)
      prompt.focus();
    prompt = null;
    context.renderer.requestRender();
  }
  function enter() {
    const route = context.ui.router.current();
    if (route.type !== "session")
      return false;
    sessionID = route.sessionID;
    prompt = context.renderer.currentFocusedEditor;
    prefix = count = "";
    positions.clear();
    setNotice("");
    popMode = context.keymap.mode.push(SESSION_MODE);
    transcript = createTranscriptSelection(context, sessionID, (id) => {
      selectedID = id;
    });
    setActive(true);
    prompt?.blur();
    focusTarget = new BoxRenderable(context.renderer, {
      id: "vim-session-focus",
      position: "absolute",
      width: 0,
      height: 0,
      focusable: true
    });
    context.renderer.root.add(focusTarget);
    focusTarget.focus();
    transcript.latest();
    context.renderer.addPostProcessFn(draw);
    context.renderer.requestRender();
    return true;
  }
  const draw = (buffer) => {
    if (active() && !reading() && context.keymap.mode.current() === SESSION_MODE)
      transcript?.draw(buffer, yankID);
  };
  async function copy(text) {
    const copied = await clipboard.write(text);
    if (disposed)
      return;
    if (noticeTimer)
      clearTimeout(noticeTimer);
    setNotice(copied ? "Copied" : "Yanked \xB7 clipboard unavailable");
    noticeTimer = setTimeout(() => setNotice(""), 1500);
  }
  function openMessage(message) {
    focusTarget?.focus();
    setReading(message);
    context.ui.dialog.show(() => _$createComponent8(Reader, {
      context,
      config,
      sessionID,
      message,
      get offset() {
        return positions.get(message.id) ?? 0;
      },
      copy,
      notice,
      remember: (offset) => positions.set(message.id, offset),
      back: () => context.ui.dialog.clear(),
      close
    }), () => {
      setReading(undefined);
      setNotice("");
    });
  }
  const onKey = (event) => {
    if (!active() || reading())
      return;
    const key = sessionModeKey(context, event, config.sessionKey, SESSION_MODE, mappings.accepts);
    if (!key)
      return;
    if (mappings.resolve(key) === "passthrough")
      return;
    event.preventDefault();
    event.stopPropagation();
    clearYankFlash();
    setNotice("");
    if (key === config.sessionKey || key === "<Esc>" || key === "<C-[>" || key === "<C-c>") {
      close();
      return;
    }
    if (/^[0-9]$/.test(key) && (count || key !== "0")) {
      count = (count + key).slice(0, 6);
      return;
    }
    const amount = Number(count) || 1;
    count = "";
    const previous = prefix;
    prefix = "";
    let command = pageCommand(key);
    if (key === "j" || key === "<Down>") {
      transcript?.move("next", amount);
      return;
    } else if (key === "k" || key === "<Up>") {
      transcript?.move("previous", amount);
      return;
    } else if (key === "G") {
      transcript?.latest();
      return;
    } else if (key === "g" && previous === "g")
      command = "session.first";
    else if (key === "y" && previous === "y") {
      const message = selected();
      if (message) {
        yankID = message.id;
        yankTimer = setTimeout(clearYankFlash, YANK_FLASH_MS);
        context.renderer.requestRender();
        copy(message.text);
      }
    } else if (key === "g" || key === "y")
      prefix = key;
    else if (key === "<CR>") {
      transcript?.sync();
      if (transcript?.toggle())
        return;
      const message = selected();
      if (message)
        openMessage(message);
    }
    if (command) {
      transcript?.followViewport();
      for (let index = 0;index < amount; index++)
        context.keymap.dispatch(command);
    }
  };
  createEffect3(() => {
    const route = context.ui.router.current();
    if (active() && (route.type !== "session" || route.sessionID !== sessionID))
      untrack2(close);
  });
  const onFocus = () => untrack2(() => {
    const focused = context.renderer.currentFocusedRenderable;
    if (active() && !reading() && context.keymap.mode.current() === SESSION_MODE && focused && focused !== focusTarget && focused !== prompt)
      close(false);
  });
  onMount3(() => {
    context.renderer.keyInput.prependListener("keypress", onKey);
    context.renderer.on("focused_renderable", onFocus);
  });
  onCleanup6(() => {
    disposed = true;
    close();
    if (noticeTimer)
      clearTimeout(noticeTimer);
    context.renderer.keyInput.off("keypress", onKey);
    context.renderer.off("focused_renderable", onFocus);
  });
  return {
    active,
    enter,
    close,
    Status() {
      return (() => {
        var _el$ = _$createElement6("box");
        _$setProp6(_el$, "flexDirection", "row");
        _$setProp6(_el$, "flexShrink", 0);
        _$insert6(_el$, _$createComponent8(Show5, {
          get when() {
            return !notice();
          },
          get fallback() {
            return (() => {
              var _el$5 = _$createElement6("text");
              _$insert6(_el$5, notice);
              _$effect6((_$p) => _$setProp6(_el$5, "fg", context.theme.text.feedback.info.base, _$p));
              return _el$5;
            })();
          },
          get children() {
            return [(() => {
              var _el$2 = _$createElement6("text");
              _$insertNode6(_el$2, _$createTextNode4(` SESSION `));
              _$setProp6(_el$2, "fg", "#242424");
              _$setProp6(_el$2, "bg", "#FABD2F");
              _$setProp6(_el$2, "wrapMode", "none");
              return _el$2;
            })(), (() => {
              var _el$4 = _$createElement6("text");
              _$setProp6(_el$4, "wrapMode", "none");
              _$insert6(_el$4, () => ` \xB7 Enter open \xB7 yy copy \xB7 ${config.sessionKey} prompt`);
              _$effect6((_$p) => _$setProp6(_el$4, "fg", context.theme.text.feedback.info.base, _$p));
              return _el$4;
            })()];
          }
        }));
        return _el$;
      })();
    }
  };
}

// src/clipboard.tsx
import { createClipboard, createHostClipboard, createRendererClipboardAdapter } from "opentui:runtime-module:%40opentui%2Fcore";
function createVimClipboard(renderer) {
  const terminal = createRendererClipboardAdapter(renderer);
  const clipboard = createClipboard({
    host: createHostClipboard(),
    terminal
  });
  let fallback = "";
  let revision = 0;
  let writes = Promise.resolve();
  let disposed = false;
  return {
    write(text) {
      text = text.replaceAll("\x00", "");
      fallback = text;
      revision++;
      const result = writes.then(async () => {
        if (disposed)
          return false;
        try {
          const result = await clipboard.writeText(text, {
            destination: "all-available",
            selection: "clipboard"
          });
          return result.host.status === "written" || result.terminal.status === "attempted";
        } catch {
          return false;
        }
      });
      writes = result.then(() => {});
      return result;
    },
    async read() {
      await writes;
      if (disposed || terminal.remote)
        return fallback;
      const before = revision;
      try {
        const result = await clipboard.read({
          preferredTypes: ["text/plain"],
          selection: "clipboard"
        });
        if (before !== revision)
          return fallback;
        if (result.status === "empty")
          fallback = "";
        else if (result.status === "read" && result.representation.mimeType === "text/plain") {
          fallback = new TextDecoder().decode(result.representation.bytes).replace(/\r\n?/g, `
`).replaceAll("\x00", "");
        }
      } catch {}
      return fallback;
    },
    dispose() {
      disposed = true;
      return clipboard.dispose();
    }
  };
}

// src/ui/form.tsx
import { effect as _$effect7 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insertNode as _$insertNode7 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert7 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { memo as _$memo7 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createComponent as _$createComponent9 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp7 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement7 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { KeyEvent as KeyEvent2, PasteEvent, RGBA as RGBA2 } from "opentui:runtime-module:%40opentui%2Fcore";
import { createEffect as createEffect4, onCleanup as onCleanup7, Show as Show6, untrack as untrack3 } from "opentui:runtime-module:solid-js";

// src/ui/native-keys.tsx
import { KeyEvent } from "opentui:runtime-module:%40opentui%2Fcore";
var vimArrowKeys = {
  h: ["left", "\x1B[D"],
  j: ["down", "\x1B[B"],
  k: ["up", "\x1B[A"],
  l: ["right", "\x1B[C"]
};
function sendNativeKey(context, name, sequence) {
  context.renderer.keyInput.emit("keypress", new KeyEvent({
    name,
    sequence,
    raw: sequence,
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    number: false,
    eventType: "press",
    source: "raw"
  }));
}

// src/ui/form.tsx
function createFormMode(context, config, log, enabled) {
  const state = createVimState("normal", log);
  const adapter = createVimeeAdapter(state, config, log);
  const active = () => enabled() && context.keymap.mode.current() === "form";
  let input = null;
  let cursorStyle;
  let forwarding = false;
  let opening;
  const editorContext = {
    input: () => input ?? undefined,
    get widthMethod() {
      return context.renderer.widthMethod;
    },
    get colors() {
      return {
        background: context.theme.background.base,
        yank: context.theme.text.feedback.info.base,
        selection: RGBA2.fromHex("#D8A657")
      };
    },
    setText(text) {
      if (input)
        editInput(input, text, context.renderer.widthMethod);
    },
    submit: () => sendKey("return", "\r"),
    blur: () => input?.blur(),
    dispatchCommand(command) {
      const ok = context.keymap.commands().some((item) => item.id === command);
      if (ok)
        context.keymap.dispatch(command);
      return {
        ok
      };
    },
    requestRender: () => context.renderer.requestRender()
  };
  const removeStatus = context.ui.slot({
    append: "session.composer.top",
    render: () => _$createComponent9(Show6, {
      get when() {
        return active();
      },
      get children() {
        var _el$ = _$createElement7("box"), _el$2 = _$createElement7("text");
        _$insertNode7(_el$, _el$2);
        _$setProp7(_el$, "paddingLeft", 3);
        _$setProp7(_el$, "marginBottom", 1);
        _$setProp7(_el$, "flexDirection", "row");
        _$insert7(_el$, _$createComponent9(VimStatus, {
          get mode() {
            return state.mode;
          },
          enabled,
          get colors() {
            return config.modeColors;
          },
          get theme() {
            return {
              success: context.theme.text.feedback.success.base,
              warning: context.theme.text.feedback.warning.base
            };
          }
        }), _el$2);
        _$insert7(_el$2, () => state.mode() === "normal" ? "j/k select \xB7 i type an answer" : "esc normal");
        _$effect7((_$p) => _$setProp7(_el$2, "fg", context.theme.text.muted, _$p));
        return _el$;
      }
    })
  });
  createEffect4(() => {
    if (!active())
      opening = undefined;
    untrack3(focus);
  });
  createEffect4(() => {
    const style = config.cursorStyles[state.mode()];
    if (input && !input.isDestroyed)
      input.cursorStyle = style;
  });
  onCleanup7(() => {
    opening = undefined;
    adapter.cleanup();
    restoreCursor();
    removeStatus();
  });
  function restoreCursor() {
    if (input && !input.isDestroyed && cursorStyle)
      input.cursorStyle = cursorStyle;
  }
  function focus() {
    const next = active() ? context.renderer.currentFocusedEditor : null;
    if (next === input)
      return;
    adapter.suspend();
    restoreCursor();
    input = next;
    cursorStyle = input?.cursorStyle;
    state.setMode(input ? "insert" : "normal");
    if (input)
      input.cursorStyle = config.cursorStyles[state.mode()];
  }
  function consume(event) {
    event.preventDefault();
    event.stopPropagation();
  }
  function sendKey(name, sequence) {
    forwarding = true;
    try {
      sendNativeKey(context, name, sequence);
    } finally {
      forwarding = false;
    }
  }
  function waitForFocus() {
    const queued = [];
    opening = queued;
    queueMicrotask(() => queueMicrotask(() => {
      if (opening !== queued)
        return;
      opening = undefined;
      focus();
      for (const event of queued) {
        if (!active())
          break;
        if (event instanceof PasteEvent)
          context.renderer.keyInput.emit("paste", event);
        else
          context.renderer.keyInput.emit("keypress", event);
      }
    }));
  }
  function paste(event) {
    if (!active())
      return;
    if (opening) {
      opening.push(new PasteEvent(event.bytes, event.metadata));
      consume(event);
    } else if (!input) {
      waitForFocus();
    }
  }
  function handle(event) {
    if (!active())
      return false;
    if (forwarding)
      return true;
    if (opening) {
      opening.push(new KeyEvent2(event));
      consume(event);
      return true;
    }
    if (context.keymap.pending().length)
      return true;
    const key = keyNotation(event);
    if (!key)
      return true;
    if (state.mode() === "insert") {
      const editor = input;
      const handled = adapter.handle(event, key, editorContext);
      if (handled)
        consume(event);
      if (state.mode() === "normal" && input === editor) {
        if (context.keymap.active().some((item) => item.group === "Form" && item.description === "Close answer edit")) {
          sendKey("escape", "\x1B");
          waitForFocus();
        }
      }
      return true;
    }
    if (event.ctrl || event.meta || event.option || event.super || event.hyper) {
      if (key === "<C-[>") {
        consume(event);
        sendKey("escape", "\x1B");
      }
      return true;
    }
    if (key === "i") {
      consume(event);
      if (input)
        state.setMode("insert");
      else {
        context.renderer.keyInput.emit("paste", new PasteEvent(new Uint8Array));
      }
      return true;
    }
    const arrow = vimArrowKeys[key];
    if (arrow) {
      consume(event);
      sendKey(...arrow);
      return true;
    }
    if (key === "<CR>" && !input)
      waitForFocus();
    if (/^[1-9]$/.test(key) || key === "<Space>") {
      consume(event);
      sendKey(event.name, "");
      if (!input)
        waitForFocus();
    } else if (event.sequence && !/[\p{C}]/u.test(event.sequence) && key !== "<CR>" && key !== "<Tab>") {
      consume(event);
    }
    return true;
  }
  return {
    handle,
    focus,
    paste
  };
}

// src/ui/composer.ts
var keys = {
  ...vimArrowKeys,
  "<C-[>": ["escape", "\x1B"]
};
function handleComposerKey(context, event) {
  if (context.keymap.mode.current() !== "composer")
    return false;
  if (context.keymap.pending().length || event.meta || event.option || event.super || event.hyper)
    return true;
  const key = keyNotation(event);
  const target = key && keys[key];
  if (!target)
    return true;
  event.preventDefault();
  event.stopPropagation();
  sendNativeKey(context, ...target);
  return true;
}

// src/ui/terminal.tsx
import { effect as _$effect8 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { insert as _$insert8 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { setProp as _$setProp8 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { createElement as _$createElement8 } from "opentui:runtime-module:%40opentui%2Fsolid";
import { EmbeddedTerminalRenderable } from "opentui:runtime-module:%40opentui%2Fcore";
import { createSignal as createSignal5, onCleanup as onCleanup8, untrack as untrack4 } from "opentui:runtime-module:solid-js";

// src/ui/pane-keys.ts
var TERMINAL_TOGGLE = "opencode-vim.terminal.toggle";
var DEFAULT_BINDINGS = {
  "<C-/>": `command:${TERMINAL_TOGGLE}`,
  "<M-h>": "command:pane.focus.left",
  "<M-l>": "command:pane.focus.right"
};
function createPaneKeymaps(config, log) {
  const commands = new Map;
  for (const bindings of [DEFAULT_BINDINGS, config.keymaps.panes ?? {}]) {
    for (const [keys, action] of Object.entries(bindings)) {
      try {
        const key = paneMappingKey(keys);
        if (action === "passthrough") {
          commands.delete(key);
          continue;
        }
        const command = mappedCommand(action);
        if (!command)
          throw new Error("Pane mappings support only command:<id> or passthrough");
        commands.set(key, command);
      } catch (error) {
        log("vim.pane.keymap.invalid", {
          keys,
          action,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
  function label(command) {
    for (const [key, action] of commands) {
      if (action !== command)
        continue;
      if (key.startsWith("<M-"))
        return `Alt+${key.slice(3, -1)}`;
      if (key.startsWith("<C-"))
        return `Ctrl+${key.slice(3, -1)}`;
      return key.startsWith("<") ? key.slice(1, -1) : key;
    }
    return "";
  }
  const hints = ["TERMINAL"];
  const left = label("pane.focus.left");
  const right = label("pane.focus.right");
  if (left && right) {
    let swap = `${left}/${right}`;
    for (const modifier of ["Alt+", "Ctrl+"]) {
      if (left.startsWith(modifier) && right.startsWith(modifier))
        swap = `${left}/${right.slice(modifier.length)}`;
    }
    hints.push(`${swap} swap`);
  } else if (left) {
    hints.push(`${left} prompt`);
  } else if (right) {
    hints.push(`${right} terminal`);
  }
  const toggle = label(TERMINAL_TOGGLE);
  if (toggle)
    hints.push(`${toggle} hide`);
  return {
    command: (key) => commands.get(key),
    hint: hints.join(" \xB7 ")
  };
}

// src/ui/terminal.tsx
function createTerminalControls(context, config, log, enabled, normal) {
  const mappings = createPaneKeymaps(config, log);
  const [focused, setFocused] = createSignal5(false);
  let terminal;
  let sessionID = "";
  function toggle() {
    if (!context.keymap.commands().some((command) => command.id === "terminal.toggle"))
      return false;
    const route = context.ui.router.current();
    if (!focused() && terminal && !terminal.isDestroyed && route.type === "session" && route.sessionID === sessionID) {
      context.keymap.dispatch("pane.focus.right");
    } else {
      context.keymap.dispatch("terminal.toggle");
    }
    return true;
  }
  function handle(event) {
    const mode = context.keymap.mode.current();
    if (mode !== "base" && mode !== SESSION_MODE || context.keymap.pending().length)
      return false;
    const key = paneEventKey(event);
    const command = key ? mappings.command(key) : undefined;
    if (!command)
      return false;
    const available = context.keymap.commands();
    if (!available.some((item) => item.id === command))
      return false;
    if (command === TERMINAL_TOGGLE && !available.some((item) => item.id === "terminal.toggle"))
      return false;
    event.preventDefault();
    event.stopPropagation();
    context.keymap.dispatch(command);
    return true;
  }
  const onFocus = () => untrack4(() => {
    const target = context.renderer.currentFocusedRenderable;
    setFocused(target instanceof EmbeddedTerminalRenderable);
    const route = context.ui.router.current();
    if (target instanceof EmbeddedTerminalRenderable && route.type === "session") {
      terminal = target;
      sessionID = route.sessionID;
    }
  });
  context.renderer.on("focused_renderable", onFocus);
  onFocus();
  context.keymap.layer(() => ({
    mode: "global",
    enabled,
    commands: [{
      id: TERMINAL_TOGGLE,
      title: "Toggle terminal (Vim)",
      palette: true,
      enabled: () => focused() || normal(),
      run: () => {
        if (!toggle())
          return false;
      }
    }]
  }));
  onCleanup8(() => {
    context.renderer.off("focused_renderable", onFocus);
  });
  return {
    focused,
    handle,
    Status
  };
  function Status() {
    return (() => {
      var _el$ = _$createElement8("text");
      _$setProp8(_el$, "flexShrink", 0);
      _$setProp8(_el$, "wrapMode", "none");
      _$insert8(_el$, () => mappings.hint);
      _$effect8((_$p) => _$setProp8(_el$, "fg", context.theme.text.feedback.info.base, _$p));
      return _el$;
    })();
  }
}

// src/ui/session-navigation.ts
function cycleSession(context, direction) {
  if (context.ui.tabs.enabled()) {
    context.keymap.dispatch(direction === -1 ? "session.tab.previous" : "session.tab.next");
    return;
  }
  const route = context.ui.router.current();
  const current = route.type === "session" ? context.data.session.root(route.sessionID) : undefined;
  const sessions = context.data.session.list().filter((session) => !session.parentID && session.time.archived === undefined).toSorted((a, b) => a.time.created - b.time.created || a.id.localeCompare(b.id));
  if (!sessions.length)
    return;
  const index = sessions.findIndex((session) => session.id === current);
  const next = index < 0 ? direction === -1 ? sessions.length - 1 : 0 : (index + direction + sessions.length) % sessions.length;
  if (sessions[next].id === current)
    return;
  context.ui.router.navigate({
    type: "session",
    sessionID: sessions[next].id
  });
}

// src/plugin.tsx
var plugin_default = Plugin.define({
  id: "opencode-vim",
  setup(context) {
    context.ui.slot({
      append: "app",
      render: () => _$createComponent10(VimHost, {
        context
      })
    });
  }
});
function VimHost(props) {
  const config = createVimConfig(props.context.options);
  const normalMappings = Object.keys(config.keymaps.normal ?? {});
  const nativeInsertTyping = Object.keys(config.keymaps.insert ?? {}).every((key) => /^<C-[^>]+>/.test(key));
  const log = createVimLog(config);
  const clipboard = createVimClipboard(props.context.renderer);
  const clipboardOptions = {
    onYank: (text) => {
      clipboard.write(text);
    },
    readClipboard: clipboard.read
  };
  const state = createVimState(config.defaultMode, log);
  const vimee = createVimeeAdapter(state, config, log, clipboardOptions);
  const dialogState = createVimState(config.defaultMode, log);
  const dialogVimee = createVimeeAdapter(dialogState, config, log, clipboardOptions);
  const [dialogFocused, setDialogFocused] = createSignal6(false);
  let commandModeRestore;
  let commandModeActive = false;
  const promptVim = {
    state,
    vimee
  };
  const dialogVim = {
    state: dialogState,
    vimee: dialogVimee
  };
  let dialogInput = null;
  const [saved, setSaved] = props.context.storage.store("state", {
    initial: {
      enabled: true
    }
  });
  const enabled = () => saved.enabled;
  const form = createFormMode(props.context, config, log, enabled);
  const editorContext = createEditorContext(props.context, dispatchVimCommand);
  let cursorMode = "";
  let cursorInput = null;
  let originalCursorStyle;
  const session = createSessionMode(props.context, config, clipboard);
  const terminal = createTerminalControls(props.context, config, log, enabled, () => session.active() || state.mode() === "normal" && props.context.keymap.mode.current() === "base");
  let pendingKeys;
  let disposed = false;
  const removeStatus = props.context.ui.slot({
    prepend: "prompt.footer",
    render: (footer) => {
      if (enabled() && terminal.focused())
        return _$createComponent10(terminal.Status, {});
      if (footer.mode !== "normal")
        return null;
      if (session.active() && !dialogFocused())
        return _$createComponent10(session.Status, {});
      if (config.modeIndicator === "none")
        return null;
      return _$createComponent10(VimStatus, {
        mode: () => dialogFocused() ? dialogState.mode() : state.mode(),
        enabled,
        get colors() {
          return config.modeColors;
        },
        theme: {
          get success() {
            return props.context.theme.text.feedback.success.base;
          },
          get warning() {
            return props.context.theme.text.feedback.warning.base;
          }
        }
      });
    }
  });
  props.context.keymap.layer(() => ({
    mode: "global",
    commands: [{
      id: "opencode-vim.session.previous",
      title: "Previous session",
      group: "Vim",
      run: () => cycleSession(props.context, -1)
    }, {
      id: "opencode-vim.session.next",
      title: "Next session",
      group: "Vim",
      run: () => cycleSession(props.context, 1)
    }, {
      id: "opencode-vim.toggle",
      title: "Toggle Vim Mode",
      description: "Enable or disable Vim key handling",
      group: "Vim",
      palette: true,
      slash: {
        name: "vim"
      },
      run() {
        const next = !enabled();
        setSaved((draft) => {
          draft.enabled = next;
        });
        if (!next) {
          pendingKeys = undefined;
          session.close();
          vimee.suspend();
          dialogVimee.suspend();
        }
        props.context.ui.toast.show({
          message: `Vim mode ${next ? "enabled" : "disabled"}`,
          variant: "info"
        });
        props.context.renderer.requestRender();
      }
    }]
  }));
  const onKey = (event) => {
    if (!enabled() || event.defaultPrevented)
      return;
    if (terminal.handle(event))
      return;
    if (form.handle(event))
      return;
    if (handleComposerKey(props.context, event))
      return;
    if (nativeInsertTyping && !pendingKeys && promptVim.state.mode() === "insert" && cursorMode === "insert" && cursorInput !== null && props.context.renderer.currentFocusedEditor === cursorInput && props.context.keymap.mode.current() === "base" && !event.ctrl && !event.meta && !event.option && !event.super && !event.hyper && event.name.length === 1 && /^[\x20-\x7e]$/.test(event.name) && !props.context.keymap.pending().length && !promptVim.vimee.isPending() && promptVim.vimee.prepareNativeInsert()) {
      return;
    }
    if (pendingKeys) {
      pendingKeys.push(new KeyEvent3(event));
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (props.context.keymap.mode.current() === SESSION_MODE)
      return;
    const kind = inputKind(props.context);
    if (!kind)
      return;
    if (props.context.keymap.pending().length)
      return;
    const {
      state,
      vimee
    } = kind === "dialog" ? dialogVim : promptVim;
    const key = keyNotation(event);
    if (!key)
      return;
    const vimMode = state.mode();
    const opensCommandPalette = kind === "prompt" && key === "<C-p>" && !isCompletionToken(props.context) && props.context.keymap.commands().some((item) => item.id === "command.palette.show");
    if (opensCommandPalette) {
      beginCommandMode(state);
      return;
    }
    const mapped = vimMode === "normal" && normalMappings.some((sequence) => sequence.startsWith(key));
    if (kind === "prompt" && key === config.sessionKey && !mapped && vimMode === "normal" && !vimee.isPending()) {
      if (session.enter()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    if (passThroughKey(event, key, vimMode, vimee.isPending(), mapped))
      return;
    if (key === "<Esc>" && vimMode === "normal" && !vimee.isPending())
      return;
    if (kind === "dialog" && !vimee.isPending() && !mapped && vimMode === "normal") {
      if (key === "<Tab>" || key === "<Home>" || key === "<End>" || key === "<PageUp>" || key === "<PageDown>")
        return;
      const command = key === "j" ? "dialog.select.next" : key === "k" ? "dialog.select.prev" : undefined;
      if (command && props.context.keymap.commands().some((item) => item.id === command)) {
        event.preventDefault();
        event.stopPropagation();
        props.context.keymap.dispatch(command);
        return;
      }
    }
    if (kind === "prompt" && !vimee.isPending() && sendCompletionKey(event, props.context, key, state.mode())) {
      syncCursor(true);
      return;
    }
    const before = state.mode();
    let consumed = false;
    try {
      const result = vimee.handle(event, key, editorContext);
      if (typeof result === "boolean")
        consumed = result;
      else {
        consumed = true;
        const queued = [];
        pendingKeys = queued;
        const input = props.context.renderer.currentFocusedEditor;
        result.then((handled) => {
          if (pendingKeys !== queued)
            return;
          pendingKeys = undefined;
          if (!handled)
            return;
          syncCursor(true);
          for (const event of queued) {
            if (!enabled() || props.context.renderer.currentFocusedEditor !== input)
              break;
            if (event instanceof PasteEvent2)
              props.context.renderer.keyInput.emit("paste", event);
            else
              props.context.renderer.keyInput.emit("keypress", event);
          }
        }).catch((error) => {
          if (pendingKeys === queued)
            pendingKeys = undefined;
          log("vim.clipboard.paste.error", {
            error: String(error)
          });
        });
      }
    } finally {
      if (consumed || state.mode() !== before) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    if (consumed)
      syncCursor(true);
  };
  const onFocus = () => untrack5(() => {
    pendingKeys = undefined;
    vimee.suspend();
    dialogVimee.suspend();
    syncCursor();
    form.focus();
    queueMicrotask(() => {
      if (!disposed)
        untrack5(() => syncCursor(true));
    });
  });
  const onPaste = (event) => {
    if (event.defaultPrevented)
      return;
    if (!pendingKeys) {
      form.paste(event);
      return;
    }
    pendingKeys.push(new PasteEvent2(event.bytes, event.metadata));
    event.preventDefault();
    event.stopPropagation();
  };
  props.context.renderer.keyInput.prependListener("keypress", onKey);
  props.context.renderer.keyInput.prependListener("paste", onPaste);
  props.context.renderer.on("focused_editor", onFocus);
  createEffect5(() => syncCursor());
  let route = routeKey(props.context.ui.router.current());
  createEffect5(() => {
    const next = routeKey(props.context.ui.router.current());
    if (next === route)
      return;
    route = next;
    resetMode();
    if (pendingKeys)
      onFocus();
  });
  onCleanup9(() => {
    disposed = true;
    pendingKeys = undefined;
    removeStatus();
    session.close();
    props.context.renderer.keyInput.off("keypress", onKey);
    props.context.renderer.keyInput.off("paste", onPaste);
    props.context.renderer.off("focused_editor", onFocus);
    vimee.cleanup();
    dialogVimee.cleanup();
    clipboard.dispose();
    restoreCursor();
  });
  return null;
  function beginCommandMode(target) {
    if (!commandModeRestore) {
      commandModeRestore = {
        target,
        mode: target.mode()
      };
      commandModeActive = false;
    }
    target.setMode("insert");
  }
  function dispatchVimCommand(command) {
    const target = dialogFocused() ? dialogState : state;
    beginCommandMode(target);
    const modeBefore = props.context.keymap.mode.current();
    props.context.keymap.dispatch(command);
    if (props.context.keymap.mode.current() !== modeBefore || inputKind(props.context) === "dialog") {
      commandModeActive = true;
      return;
    }
    if (!commandModeActive && commandModeRestore?.target === target) {
      const previous = commandModeRestore.mode;
      commandModeRestore = undefined;
      target.setMode(previous);
    }
  }
  function resetMode() {
    untrack5(() => {
      if (state.mode() === config.defaultMode)
        return;
      vimee.suspend();
      state.setMode(config.defaultMode);
      syncCursor(true);
    });
  }
  function syncCursor(force = false) {
    const input = props.context.renderer.currentFocusedEditor;
    const kind = inputKind(props.context);
    const keymapMode = props.context.keymap.mode.current();
    if (commandModeRestore) {
      if (!commandModeActive && (keymapMode !== "base" || kind === "dialog"))
        commandModeActive = true;
      else if (commandModeActive && keymapMode === "base" && kind !== "dialog") {
        const {
          target,
          mode
        } = commandModeRestore;
        commandModeRestore = undefined;
        commandModeActive = false;
        target.setMode(mode);
      }
    }
    setDialogFocused(kind === "dialog");
    if (!enabled() || !kind || !input) {
      restoreCursor();
      return;
    }
    const {
      state,
      vimee
    } = kind === "dialog" ? dialogVim : promptVim;
    if (kind === "dialog" && dialogInput !== input) {
      dialogInput = input;
      dialogVimee.suspend();
      dialogState.setMode(commandModeActive ? "insert" : promptVim.state.mode());
    }
    const mode = state.mode();
    vimee.attach(editorContext);
    const inputChanged = cursorInput !== input;
    if (inputChanged) {
      restoreCursor();
      cursorInput = input;
      originalCursorStyle = input.cursorStyle;
    }
    if (!force && !inputChanged && cursorMode === mode)
      return;
    input.cursorStyle = config.cursorStyles[mode];
    cursorMode = mode;
    props.context.renderer.requestRender();
  }
  function restoreCursor() {
    if (cursorInput && !cursorInput.isDestroyed && originalCursorStyle)
      cursorInput.cursorStyle = originalCursorStyle;
    cursorInput = null;
    cursorMode = "";
  }
}
function createEditorContext(context, dispatchVimCommand) {
  return {
    input: () => inputKind(context) ? context.renderer.currentFocusedEditor ?? undefined : undefined,
    get widthMethod() {
      return context.renderer.widthMethod;
    },
    get colors() {
      return {
        selection: RGBA3.fromHex("#D8A657"),
        selectionForeground: context.keymap.mode.current() === "modal" ? undefined : RGBA3.fromHex("#242424"),
        yank: context.theme.text.feedback.info.base,
        background: context.theme.background.base
      };
    },
    setText(text) {
      const input = context.renderer.currentFocusedEditor;
      if (input)
        editInput(input, text, context.renderer.widthMethod);
    },
    submit() {
      if (inputKind(context) === "dialog") {
        const command = context.keymap.commands().some((item) => item.id === "dialog.select.submit") ? "dialog.select.submit" : "dialog.prompt.submit";
        context.keymap.dispatch(command);
      } else {
        context.keymap.dispatch("prompt.submit");
      }
    },
    blur() {
      context.renderer.currentFocusedEditor?.blur();
    },
    dispatchCommand(command) {
      const ok = context.keymap.commands().some((item) => item.id === command);
      if (ok)
        dispatchVimCommand(command);
      return {
        ok
      };
    },
    requestRender: () => context.renderer.requestRender()
  };
}
function routeKey(route) {
  return route.type === "session" ? `session:${route.sessionID}` : route.type;
}
function inputKind(context) {
  if (context.keymap.mode.current() === SESSION_MODE)
    return;
  if (!context.renderer.currentFocusedEditor)
    return;
  const commands = context.keymap.commands();
  if (context.keymap.mode.current() === "modal") {
    if (commands.some((item) => item.id === "dialog.select.submit" || item.id === "dialog.prompt.submit"))
      return "dialog";
    return;
  }
  if (commands.some((item) => item.id === "prompt.submit" || item.id === "prompt.autocomplete.next" || item.id === "prompt.history.previous"))
    return "prompt";
}
function passThroughKey(event, key, mode, pending, mapped) {
  if (key === "<Tab>" && event.shift)
    return true;
  if (mode !== "normal")
    return false;
  if (mapped)
    return false;
  if (event.ctrl && key !== "<C-r>" && key !== "<C-[>")
    return true;
  return event.super === true || event.meta === true || isArrowKey(key) && !pending;
}
function sendCompletionKey(event, context, key, mode) {
  if (mode !== "normal")
    return false;
  const command = key === "j" ? "prompt.autocomplete.next" : key === "k" ? "prompt.autocomplete.prev" : undefined;
  if (!command || !isCompletionToken(context) || !context.keymap.commands().some((item) => item.id === command))
    return false;
  event.preventDefault();
  event.stopPropagation();
  context.keymap.dispatch(command);
  return true;
}
function isCompletionToken(context) {
  const input = context.renderer.currentFocusedEditor;
  const text = input?.plainText ?? "";
  const index = displayToChar(text, Math.max(0, input?.cursorOffset ?? 0));
  const before = text.slice(0, Math.min(index + 1, text.length));
  return /^\/\S*$/.test(before) || /(?:^|\s)@\S*$/.test(before);
}
function isArrowKey(key) {
  return key === "<Left>" || key === "<Down>" || key === "<Up>" || key === "<Right>";
}
export {
  plugin_default as default
};
