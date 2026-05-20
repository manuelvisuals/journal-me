"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  initialTitle: string;
  initialSnippet: string;
  initialBody: string;
  onSave: (patch: {
    title: string;
    snippet: string;
    body: string;
  }) => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Full-screen editor for a recap: edit title (serif headline), snippet
 * (2-3 sentences), and body (long prose). Save replaces the saved fields;
 * no AI re-generation happens here — the user is the author.
 */
export function RecapEditor({
  initialTitle,
  initialSnippet,
  initialBody,
  onSave,
  onCancel,
}: Props) {
  const [title, setTitle] = useState<string>(initialTitle);
  const [snippet, setSnippet] = useState<string>(initialSnippet);
  const [body, setBody] = useState<string>(initialBody);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const dirty =
    title !== initialTitle ||
    snippet !== initialSnippet ||
    body !== initialBody;

  return (
    <div className="jm-editor-overlay" role="dialog" aria-modal="true">
      <div className="jm-editor-card">
        <div className="jm-editor-header">
          <span className="jm-editor-title">Modifica recap</span>
          <div className="jm-editor-actions">
            <button
              type="button"
              className="jm-editor-btn cancel"
              onClick={onCancel}
            >
              Annulla
            </button>
            <button
              type="button"
              className="jm-editor-btn save"
              onClick={() => onSave({ title, snippet, body })}
              disabled={!dirty || title.trim().length === 0}
            >
              Salva
            </button>
          </div>
        </div>

        <div className="jm-recap-editor-body">
          <label className="jm-recap-field">
            <span className="jm-recap-field-label">Titolo</span>
            <textarea
              ref={titleRef}
              className="jm-recap-field-input title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              spellCheck
              autoCorrect="on"
              autoCapitalize="sentences"
            />
          </label>

          <label className="jm-recap-field">
            <span className="jm-recap-field-label">Snippet</span>
            <textarea
              className="jm-recap-field-input snippet"
              value={snippet}
              onChange={(e) => setSnippet(e.target.value)}
              rows={3}
              spellCheck
              autoCorrect="on"
              autoCapitalize="sentences"
            />
          </label>

          <label className="jm-recap-field grow">
            <span className="jm-recap-field-label">Corpo</span>
            <textarea
              className="jm-recap-field-input body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              spellCheck
              autoCorrect="on"
              autoCapitalize="sentences"
            />
          </label>
        </div>

        <div className="jm-editor-hint">
          paragrafi separati da riga vuota . citazioni tra virgolette
        </div>
      </div>
    </div>
  );
}
