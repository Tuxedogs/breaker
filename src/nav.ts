export type NavItem = {
  title: string
  path: string
  summary: string
}

export const nav: NavItem[] = [
  {
    title: 'Introduction',
    path: '/docs/introduction',
    summary: 'Project structure and visual direction.',
  },
  {
    title: 'Getting Started',
    path: '/docs/getting-started',
    summary: 'Run dev/build and begin authoring docs.',
  },
  {
    title: 'Writing With MDX',
    path: '/docs/writing-mdx',
    summary: 'Add MDX pages and keep layout consistent.',
  },
]
