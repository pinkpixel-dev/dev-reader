import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Article, Post, View } from '../types'

const PANE = 'dev-reader'
const API = 'https://dev.to/api'
const HEADERS = {
  accept: 'application/vnd.forem.api-v1+json',
  'user-agent': 'dev-reader-claude-mod/0.1.0',
}

const BG = '#1e1f22'

const view = atom({ plugin: 'dev-reader', key: 'view' } as const, {
  mode: 'loading',
  tag: '',
} as View)

// Tab and newline are the only control characters a drawing accepts.
const clean = (text: string) =>
  text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')

const stripFrontMatter = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n/, '')

export const normalizeTag = (raw: string | undefined) => (raw ?? '').trim().replace(/^#/, '').toLowerCase()

export const toPost = (raw: any): Post => ({
  id: raw.id,
  title: clean(String(raw.title ?? 'Untitled')),
  author: clean(String(raw.user?.name ?? raw.user?.username ?? 'unknown')),
  tags: Array.isArray(raw.tag_list)
    ? raw.tag_list
    : String(raw.tag_list ?? '').split(',').map((t: string) => t.trim()).filter(Boolean),
  minutes: raw.reading_time_minutes ?? 1,
  reactions: raw.public_reactions_count ?? 0,
  comments: raw.comments_count ?? 0,
  date: clean(String(raw.readable_publish_date ?? '')),
  url: String(raw.url ?? ''),
})

const setView = ($: EngineInterface, next: View) => update($, view, () => next)

const getJson = async ($: EngineInterface, url: string) => {
  const res = await $.http.fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`DEV answered ${res.status}`)

  return JSON.parse(res.text)
}

const loadList = async ($: EngineInterface, tag: string) => {
  await setView($, { mode: 'loading', tag })
  try {
    const url = tag
      ? `${API}/articles?per_page=30&tag=${encodeURIComponent(tag)}`
      : `${API}/articles/latest?per_page=30`
    const posts = (await getJson($, url)).map(toPost)
    await setView($, { mode: 'list', tag, posts })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await setView($, { mode: 'error', tag, posts: [], message })
  }
}

const loadArticle = async ($: EngineInterface, post: Post) => {
  const current = await read($, view)
  const posts = 'posts' in current ? current.posts : []
  const { tag } = current
  try {
    const raw = await getJson($, `${API}/articles/${post.id}`)
    const article: Article = {
      ...toPost(raw),
      body: clean(stripFrontMatter(String(raw.body_markdown ?? ''))),
    }
    await setView($, { mode: 'article', tag, posts, article })
    await $.ui.scroll({ in: PANE, to: 'start' }).catch(() => undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await setView($, { mode: 'error', tag, posts, message })
  }
}

const backToList = ($: EngineInterface) =>
  update($, view, (v): View => ({ mode: 'list', tag: v.tag, posts: 'posts' in v ? v.posts : [] }))

const openPane = ($: EngineInterface, tag: string) =>
  $.ui.open({ id: PANE, title: tag ? `DEV #${tag}` : 'DEV latest', focus: true })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'dev',
      description: 'Browse the latest DEV posts in a pane',
      argumentHint: '[tag | close]',
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'dev' }, async ($, e) => {
    const arg = normalizeTag(e.args)

    if (arg === 'close') {
      await $.ui.close({ id: PANE })

      return { text: 'DEV pane closed.' }
    }

    const opened = await openPane($, arg)
    void loadList($, arg)

    return {
      text: opened.isPlaced
        ? `DEV pane open${arg ? ` for #${arg}` : ''}.`
        : `DEV pane is waiting for room: ${opened.reason}`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Markdown, Text } = $.ui.resolve(e)
    const v = await read($, view)
    const width = Math.max(20, e.props.bodyColumns)
    const label = v.tag ? `#${v.tag}` : 'latest'

    // Paint the whole pane so it reads dark whatever the surface draws behind it.
    const shell = (child: RenderChildren) => (
      <Box
        flexDirection="column"
        backgroundColor={BG}
        width="100%"
        minHeight={e.props.scroll.bodyRows}
        paddingX={1}
      >
        {child}
      </Box>
    )

    const toolbar = (
      <Box flexDirection="row" gap={1}>
        {v.mode === 'article' && (
          <Button key="back" hotkey="b" plain onPress={() => backToList($)} label="Back" />
        )}
        <Button key="refresh" hotkey="r" plain onPress={() => loadList($, v.tag)} label="Refresh" />
        <Button key="close" hotkey="q" plain onPress={() => $.ui.close({ id: PANE })} label="Close" />
      </Box>
    )

    if (v.mode === 'loading') {
      return shell(
        <Box flexDirection="column">
          <Text dimColor>Loading {label} posts...</Text>
        </Box>
      )
    }

    if (v.mode === 'error') {
      return shell(
        <Box flexDirection="column" gap={1}>
          <Text color="error">Couldn't reach DEV: {v.message}</Text>
          {toolbar}
        </Box>
      )
    }

    if (v.mode === 'article') {
      const a = v.article
      const meta = `${a.author} · ${a.date} · ${a.minutes} min · ${a.reactions} reactions · ${a.comments} comments`
      const header = `# ${a.title}\n\n${a.tags.map(t => `#${t}`).join(' ')}\n\n[Open on DEV](${a.url})\n\n---\n\n`

      return shell(
        <Box flexDirection="column" gap={1}>
          {toolbar}
          <Text dimColor wrap="truncate-end">{meta}</Text>
          <Markdown text={(header + a.body).slice(0, 99000)} />
        </Box>
      )
    }

    return shell(
      <Box flexDirection="column">
        {toolbar}
        <Text dimColor>{v.posts.length} {label} posts</Text>
        {v.posts.length === 0 && <Text dimColor>Nothing here yet. Try another tag.</Text>}
        {v.posts.map((post, i) => (
          <Box key={`row-${post.id}`} flexDirection="column" marginTop={1} width={width}>
            <Button
              key={`post-${post.id}`}
              plain
              autoFocus={i === 0 ? true : undefined}
              onPress={() => loadArticle($, post)}
            >
              {post.title}
            </Button>
            <Text dimColor wrap="truncate-end">
              {post.author} · {post.minutes} min · {post.reactions} reactions
              {post.tags.length > 0 ? ` · ${post.tags.slice(0, 3).map(t => `#${t}`).join(' ')}` : ''}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
