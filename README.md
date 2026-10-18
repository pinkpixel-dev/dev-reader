# dev-reader

dev-reader is a Claude Code mod that lets you browse and read DEV posts in a side pane while Claude is working.

I made it because I kept sitting there waiting on long turns with nothing to do. Now I type `/dev` and read something until Claude's done, and I don't have to leave the terminal.

## What it does

- `/dev` opens a pane with the 30 newest posts on [DEV](https://dev.to)
- `/dev <tag>` shows posts for one tag, like `/dev rust` or `/dev #javascript`
- Pick a post and it opens as rendered markdown, with the author, date, reading time, reactions, and an "Open on DEV" link
- The command runs right away, even in the middle of a turn, so it doesn't wait in the queue
- If DEV can't be reached, the error shows up inside the pane, not in your conversation

It only reads public data from the DEV API. There's no API key, no login, and nothing gets posted anywhere.

## Requirements

You need a Claude Code version that supports mods (plugin hooks modules). I built and tested this on Claude Code 2.1.303. The mod API is early access, so a future Claude Code update could break it.

## Installation

The repo is its own plugin marketplace, so you can install it from inside Claude Code with one command:

```text
/plugin install dev-reader --marketplace pinkpixel-dev/dev-reader
```

Claude Code asks whether to add the `pinkpixel-dev/dev-reader` marketplace. Press `y`, then pick a scope: just you, or the project you're in. After that, `/dev` is ready to use.

That one-step install needs Claude Code 2.1.275 or later. On an older version, add the marketplace first and then install from it:

```text
/plugin marketplace add pinkpixel-dev/dev-reader
/plugin install dev-reader@dev-reader
```

### Running from a local clone

If you want to hack on it, clone the repo and point Claude Code at the folder:

```bash
git clone https://github.com/pinkpixel-dev/dev-reader.git
claude --plugin-dir /path/to/dev-reader
```

## Usage

```text
/dev            newest posts
/dev rust       posts tagged #rust
/dev close      close the pane
```

When the pane opens, it has the keyboard:

| Key | What it does |
| --- | --- |
| Tab / arrows | Move between posts |
| Enter | Open the selected post |
| `b` | Back to the list (while reading a post) |
| `r` | Refresh the list |
| `q` | Close the pane |
| Esc | Give the keyboard back to the prompt (the pane stays open) |

Scroll a long post with the mouse wheel or the arrow keys. In a fullscreen terminal, you can also click posts and buttons.

## Things to know

- With no tag, the list comes from DEV's `/articles/latest` endpoint, so it's newest first. With a tag, it uses `/articles?tag=...`, which I think sorts by DEV's own ranking, not strictly by date.
- In fullscreen at 110 columns or wider, the pane opens beside the conversation. In a narrower terminal, it opens inline above the prompt.
- The pane has its own dark background (`#1e1f22`) so it stays readable no matter what your terminal theme puts behind it. Article text uses Claude Code's normal markdown colors.

## How it works

Everything lives in `hooks/register.tsx`. On session start it registers `/dev` as an immediate command. Running the command opens a pane and fetches posts through Claude Code's `$.http.fetch`. The current view (loading, list, article, or error) is kept in one `$.state` value, and the pane redraws whenever that value changes. Opening a post makes a second request to `/api/articles/{id}` to get the full `body_markdown`.

```text
.claude-plugin/plugin.json   mod manifest
hooks/hooks.json             points Claude Code at the hooks module
hooks/register.tsx           command, DEV requests, and the pane
types/index.d.ts             type for the pane's saved state
tests/dev-reader.test.tsx    tests
```

## Development

Check the manifest and module:

```bash
claude plugin validate .
```

Run the tests:

```bash
claude plugin test .
```

The tests fake DEV's responses, so they don't hit the network. They cover the tag list, opening a post, going back, the default feed, and the error state, on both the terminal and desktop surfaces.

## License

Apache 2.0. See [LICENSE](LICENSE).

Made with 💖 by [Pink Pixel](https://pinkpixel.dev)
