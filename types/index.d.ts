export type Post = {
  id: number
  title: string
  author: string
  tags: string[]
  minutes: number
  reactions: number
  comments: number
  date: string
  url: string
}

export type Article = Post & { body: string }

export type View =
  | { mode: 'loading'; tag: string }
  | { mode: 'list'; tag: string; posts: Post[] }
  | { mode: 'article'; tag: string; posts: Post[]; article: Article }
  | { mode: 'error'; tag: string; posts: Post[]; message: string }

declare module 'claude-code' {
  interface PluginState {
    'dev-reader': { view: View }
  }
}
