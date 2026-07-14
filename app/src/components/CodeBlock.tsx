import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './CodeBlock.css';

interface Props {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = 'typescript' }: Props) {
  return (
    <div className="code-block">
      <div className="code-block__header">
        <span className="code-block__lang">{language}</span>
        <button
          type="button"
          className="code-block__copy"
          onClick={() => navigator.clipboard.writeText(code)}
        >
          Copy
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        showLineNumbers
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: 'var(--bg-raised)',
          fontSize: 13,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
