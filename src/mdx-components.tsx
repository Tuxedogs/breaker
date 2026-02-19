import type { MDXComponents } from 'mdx/types'

export const mdxComponents: MDXComponents = {
  h1: (props) => <h1 className="scroll-mt-20" {...props} />,
  h2: (props) => <h2 className="scroll-mt-20" {...props} />,
  h3: (props) => <h3 className="scroll-mt-20 text-lg font-semibold text-ink" {...props} />,
}
