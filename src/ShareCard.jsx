// ShareCard.jsx — Safe version without html2canvas crash

import React from 'react';

const SHARE_STYLES = `
  .sc-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999; padding: 20px;
    box-sizing: border-box;
  }
  .sc-modal {
    width: 100%; max-width: 380px;
    display: flex; flex-direction: column; gap: 12px;
    position: relative;
  }
  .sc-close {
    position: absolute; top: -40px; right: 0;
    background: none; border: none;
    color: #c88c3c; font-size: 24px;
    cursor: pointer; padding: 8px;
    z-index: 10;
  }
  .sc-card {
    width: 100%;
    background: linear-gradient(135deg, #1a0f00 0%, #2d1a00 50%, #1a0f00 100%);
    border: 1px solid rgba(200,140,60,0.3);
    border-radius: 16px;
    padding: 28px 24px;
    box-sizing: border-box;
  }
  .sc-om {
    font-size: 24px;
    text-align: center;
    margin-bottom: 16px;
    opacity: 0.4;
  }
  .sc-sanskrit {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 18px;
    color: #e8dcc8;
    line-height: 1.8;
    margin-bottom: 14px;
    white-space: pre-wrap;
  }
  .sc-divider {
    width: 40px; height: 1px;
    background: rgba(200,140,60,0.4);
    margin: 12px 0;
  }
  .sc-translation {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 14px;
    color: #c4a87a;
    line-height: 1.7;
    font-style: italic;
    margin-bottom: 14px;
  }
  .sc-source {
    font-size: 11px;
    color: rgba(200,140,60,0.5);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    font-family: 'Inter', sans-serif;
  }
  .sc-brand {
    display: flex;
    justify-content: space-between;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .sc-brand span {
    font-size: 11px;
    color: rgba(200,140,60,0.35);
    font-family: 'Inter', sans-serif;
    letter-spacing: 1.5px;
  }
  .sc-actions {
    display: flex; gap: 8px;
  }
  .sc-btn {
    flex: 1; padding: 12px 8px;
    border-radius: 10px; border: none;
    font-family: 'Inter', sans-serif;
    font-size: 12px; cursor: pointer;
    transition: all 0.2s;
  }
  .sc-btn-gold {
    background: rgba(200,140,60,0.15);
    border: 0.5px solid rgba(200,140,60,0.4);
    color: #c88c3c;
  }
  .sc-btn-gold:hover { background: rgba(200,140,60,0.25); }
  .sc-btn-dim {
    background: rgba(255,255,255,0.05);
    border: 0.5px solid rgba(255,255,255,0.1);
    color: #6b5f4a;
  }
  .sc-btn-dim:hover { background: rgba(255,255,255,0.08); }
  .sc-msg {
    text-align: center;
    font-size: 12px;
    color: #6b5f4a;
    font-family: 'Inter', sans-serif;
    min-height: 18px;
  }
`;

export default function ShareCard({ passage, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const [status, setStatus] = React.useState('');

  if (!passage) return null;

  const sanskrit = (passage.sanskrit_text || '').trim();
  const rawEnglish = (passage.english_translation || '').trim();

  // Don't show auto-generated labels as translation
  const translation = rawEnglish.length > 100 &&
    !rawEnglish.startsWith('Mahabharata') &&
    !rawEnglish.startsWith('Bhagavad')
      ? (rawEnglish.length > 220 ? rawEnglish.slice(0, 220) + '...' : rawEnglish)
      : '';

  const displaySanskrit = sanskrit
    ? sanskrit.split('\n').slice(0, 4).join('\n')
    : '';

  const source = [
    passage.book_name,
    passage.chapter    ? `Ch. ${passage.chapter}`      : '',
    passage.verse_number ? `v. ${passage.verse_number}` : '',
  ].filter(Boolean).join(' · ');

  const shareText = [
    displaySanskrit,
    translation ? `"${translation}"` : '',
    `— ${source}`,
    '',
    'Dharma AI',
  ].filter(Boolean).join('\n\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setStatus('Copied! Paste in WhatsApp or Instagram 🙏');
      setTimeout(() => { setCopied(false); setStatus(''); }, 3000);
    } catch {
      setStatus('Copy failed — try selecting text manually');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, title: 'Dharma AI Wisdom' });
        setStatus('Shared! 🙏');
      } catch (e) {
        if (e.name !== 'AbortError') handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <>
      <style>{SHARE_STYLES}</style>
      <div className="sc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="sc-modal">
          <button className="sc-close" onClick={onClose}>✕</button>

          <div className="sc-card">
            <div className="sc-om">🕉️</div>

            {displaySanskrit ? (
              <div className="sc-sanskrit">{displaySanskrit}</div>
            ) : null}

            {displaySanskrit && translation ? (
              <div className="sc-divider" />
            ) : null}

            {translation ? (
              <div className="sc-translation">"{translation}"</div>
            ) : null}

            {!displaySanskrit && !translation ? (
              <div className="sc-translation" style={{fontStyle:'normal', color:'#6b5f4a'}}>
                No displayable content for this passage
              </div>
            ) : null}

            <div className="sc-source">{source}</div>

            <div className="sc-brand">
              <span>DHARMA AI</span>
              <span>dharma-ai.app</span>
            </div>
          </div>

          <div className="sc-msg">{status}</div>

          <div className="sc-actions">
            <button className="sc-btn sc-btn-gold" onClick={handleShare}>
              📤 Share
            </button>
            <button className="sc-btn sc-btn-gold" onClick={handleCopy}>
              {copied ? '✓ Copied' : '📋 Copy Text'}
            </button>
            <button className="sc-btn sc-btn-dim" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
