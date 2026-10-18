import { expect, test } from 'claude-code/testing'

const LIST = [
  {
    id: 101,
    title: 'Borrowing without tears',
    user: { name: 'Ferris', username: 'ferris' },
    tag_list: ['rust', 'beginners'],
    reading_time_minutes: 4,
    public_reactions_count: 12,
    comments_count: 3,
    readable_publish_date: 'Oct 18',
    url: 'https://dev.to/ferris/borrowing',
  },
]

const ARTICLE = {
  ...LIST[0],
  tag_list: 'rust, beginners',
  body_markdown: '---\ntitle: Borrowing\n---\nLifetimes are **fine**, honestly.\r\n',
}

// Stand in for the engine's pane placement, which nothing beneath a test provides.
const engineUi = (on: any) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.scroll', () => ({ value: {} }))
}

// What the person's Enter in a fullscreen terminal stamps on a command.
const TYPED = {
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
} as const

const PANE_PROPS = {
  title: 'DEV #rust',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as const

test('/dev <tag> lists tagged posts and opens one as markdown', async ($, on) => {
  engineUi(on)
  const urls: string[] = []
  on('http.fetch', ($, e) => {
    urls.push(e.url)
    const body = e.url.endsWith('/articles/101') ? ARTICLE : LIST

    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } }
  })

  await $.command.run({ ...TYPED, command: 'dev', args: '#Rust' })
  expect(urls[0]).toBe('https://dev.to/api/articles?per_page=30&tag=rust')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'dev-reader',
      surface,
      component: 'Pane',
      requestId: 'dev-reader',
      props: PANE_PROPS,
    })
    expect((await ui.find({ key: 'post-101' }))?.text).toContain('Borrowing without tears')

    await ui.press({ key: 'post-101' })
    const md = await ui.find({ type: 'Markdown' })
    const text = String(md?.props.text)
    expect(text).toContain('# Borrowing without tears')
    expect(text).toContain('Lifetimes are **fine**, honestly.')
    expect(text.includes('title: Borrowing')).toBe(false)
    expect(text.includes('\r')).toBe(false)

    await ui.press({ key: 'back' })
    expect(await ui.find({ key: 'post-101' })).toBeDefined()
    await ui.unmount()
  }
})

test('/dev with no tag uses the latest feed, and errors show in the pane', async ($, on) => {
  engineUi(on)
  const urls: string[] = []
  on('http.fetch', ($, e) => {
    urls.push(e.url)

    return { value: { status: 503, ok: false, headers: {}, text: '' } }
  })

  await $.command.run({ ...TYPED, command: 'dev', args: '' })
  expect(urls[0]).toBe('https://dev.to/api/articles/latest?per_page=30')

  const ui = await $.ui.mount({
    plugin: 'dev-reader',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'dev-reader',
    props: { ...PANE_PROPS, title: 'DEV latest' },
  })
  expect(await ui.find({ type: 'Text', text: /DEV answered 503/ })).toBeDefined()
  await ui.unmount()
})
