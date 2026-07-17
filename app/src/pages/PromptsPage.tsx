import { useState, useEffect } from 'react';
import { fetchPrompts } from '../lib/api';
import type { PromptTemplate } from '../types/index';
import './PromptsPage.css';

function preview(content: string): string {
  return content.length > 100 ? `${content.slice(0, 100)}...` : content;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrompts()
      .then(setPrompts)
      .catch((err) => console.error('Failed to load prompts:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="prompts">
      <div className="prompts__header">
        <h1 className="prompts__title">Prompt Templates</h1>
        <p className="prompts__subtitle">Reusable prompts for your assistants</p>
      </div>
      {loading ? (
        <div className="prompts__empty">Loading...</div>
      ) : prompts.length === 0 ? (
        <div className="prompts__empty">No prompts yet</div>
      ) : (
        <div className="prompts__grid">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="prompts__card">
              <div className="prompts__card-title">{prompt.title}</div>
              <div className="prompts__card-content">{preview(prompt.content)}</div>
              <div className="prompts__tags">
                {prompt.tags.map((tag: string) => (
                  <span key={tag} className="prompts__tag">{tag}</span>
                ))}
              </div>
              <div className="prompts__workspace">{prompt.workspace.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
