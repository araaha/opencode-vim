# opencode-vim

Vim-style prompt editing and session navigation for OpenCode 2.

![Vim prompt editing, dialog navigation, and session mode](./assets/vim-in-motion-dialogs.gif)

## Installation

```sh
opencode plugin add github:araaha/opencode-vim
```

## Updating

```sh
opencode plugin update github:araaha/opencode-vim
```

Restart the terminal UI after updating to load the new version.

## Development

The compiled `dist/tui.js` is committed so installs from GitHub do not require
build tools. After changing the source, run `bun run build` and commit the
updated build output along with the source changes.

## Usage

Press `Esc` to enter normal mode and `i` to type again in insert mode.

In a session, press `s` from normal mode to browse messages and tools. Use `j`/`k`
to navigate, `Enter` to open an item, and `s` to return to the prompt.

Subagent entries open the full saved response, with Vim navigation, selection,
and copying. Background completion entries use the same reader.

Use `/vim` to toggle the plugin on or off.

## Documentation

- [Keybindings and modes](./docs/vim-behavior.md)
- [Configuration](./docs/configuration.md)
- [Custom keymaps](./docs/keymap-actions.md)
