import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './MarkdownRenderer.css';

interface Props {
  content: string;
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="markdown__code">
      <div className="markdown__code-head">
        <span className="markdown__code-lang">{language}</span>
        <button type="button" className="markdown__code-copy" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter style={oneDark} language={language} PreTag="div" className="markdown__code-block">
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MarkdownRenderer({ content }: Props) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !className;
            if (isInline) {
              return (
                <code className="markdown__inline-code" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match ? match[1] : 'text'} value={String(children).replace(/\n$/, '')} />;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="markdown__link">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
