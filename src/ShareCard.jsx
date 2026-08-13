// ShareCard.jsx — Beautiful shareable scripture cards
// Drop into src/ and import wherever needed
// Uses html2canvas to generate PNG for WhatsApp/Instagram sharing

const SHARE_STYLES = `
  .sc-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 20px;
  }
  .sc-modal {
    width: 100%; max-width: 400px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .sc-card {
    width: 100%;
    background: linear-gradient(135deg, #1a0f00 0%, #2d1a00 50%, #1a0f00 100%);
    border: 1px solid rgba(200,140,60,0.3);
    border-radius: 16px;
    padding: 32px 28px;
    font-family: 'Crimson Pro', Georgia, serif;
    position: relative;
    overflow: hidden;
  }
  .sc-card::before {
    content: '🕉️';
    position: absolute;
    top: 16px; right: 20px;
    font-size: 28px; opacity: 0.15;
  }
  .sc-card::after {
    content: '';
    position: absolute;
    top: -60px; left: 50%;
    transform: translateX(-50%);
    width: 200px; height: 200px;
    background: radial-gradient(circle, rgba(200,140,60,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .sc-divider {
    width: 40px; height: 1px;
    background: rgba(200,140,60,0.4);
    margin: 16px 0;
  }
  .sc-sanskrit {
    font-size: 20px;
    color: #e8dcc8;
    line-height: 1.8;
    margin-bottom: 16px;
    font-weight: 400;
  }
  .sc-translation {
    font-size: 15px;
    color: #c4a87a;
    line-height: 1.7;
    font-style: italic;
    margin-bottom: 16px;
  }
  .sc-source {
    font-size: 12px;
    color: rgba(200,140,60,0.6);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    font-family: 'Inter', sans-serif;
    font-style: normal;
  }
  .sc-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .sc-brand-name {
    font-size: 13px;
    color: rgba(200,140,60,0.5);
    font-family: 'Inter', sans-serif;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .sc-brand-url {
    font-size: 11px;
    color: rgba(200,140,60,0.3);
    font-family: 'Inter', sans-serif;
  }
  .sc-actions {
    display: flex; gap: 10px;
  }
  .sc-btn {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    border: none;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .sc-btn-primary {
    background: rgba(200,140,60,0.2);
    border: 0.5px solid rgba(200,140,60,0.4);
    color: #c88c3c;
  }
  .sc-btn-primary:hover { background: rgba(200,140,60,0.3); }
  .sc-btn-secondary {
    background: rgba(255,255,255,0.05);
    border: 0.5px solid rgba(255,255,255,0.1);
    color: #8a7a60;
  }
  .sc-btn-secondary:hover { background: rgba(255,255,255,0.08); }
  .sc-close {
    position: absolute; top: 16px; right: 16px;
    background: none; border: none;
    color: #6b5f4a; font-size: 20px;
    cursor: pointer; padding: 4px;
  }
  .sc-generating {
    text-align: center;
    color: #6b5f4a;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    padding: 8px;
  }
`;

export default function ShareCard({ passage, onClose }) {
  const [generating, setGenerating] = React.useState(false);
  const [shareUrl, setShareUrl]     = React.useState(null);
  const cardRef = React.useRef(null);

  if (!passage) return null;

  const sanskrit    = passage.sanskrit_text?.trim() || "";
  const translation = passage.english_translation?.trim() || "";
  const source      = [
    passage.book_name,
    passage.chapter    ? `Ch. ${passage.chapter}`     : "",
    passage.verse_number ? `v. ${passage.verse_number}` : "",
  ].filter(Boolean).join(" · ");

  // Truncate for card display
  const displaySanskrit    = sanskrit.split("\n").slice(0, 4).join("\n");
  const displayTranslation = translation.length > 200
    ? translation.slice(0, 200) + "..."
    : translation;

  const generateImage = async () => {
    setGenerating(true);
    try {
      // Dynamically load html2canvas
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.onload  = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const canvas = await window.html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,  // High resolution for mobile screens
        useCORS: true,
        logging: false,
      });

      const url = canvas.toDataURL("image/png");
      setShareUrl(url);
    } catch (err) {
      console.error("Image generation failed:", err);
      alert("Could not generate image. Try copying the text instead.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!shareUrl) return;
    const a = document.createElement('a');
    a.href     = shareUrl;
    a.download = `dharma-ai-${passage.book_name?.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  };

  const shareNative = async () => {
    if (!shareUrl) await generateImage();
    if (!shareUrl) return;

    const text = `${displaySanskrit}\n\n"${displayTranslation}"\n— ${source}\n\nDharma AI`;

    if (navigator.share) {
      try {
        // Convert dataURL to blob for native share
        const res   = await fetch(shareUrl);
        const blob  = await res.blob();
        const file  = new File([blob], 'dharma-wisdom.png', { type: 'image/png' });
        await navigator.share({ files: [file], text });
      } catch {
        // Fallback to text share
        await navigator.share({ text });
      }
    } else {
      // Desktop: copy to clipboard
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard! Paste in WhatsApp or Instagram.");
    }
  };

  const copyText = async () => {
    const text = `${displaySanskrit}\n\n"${displayTranslation}"\n— ${source}\n\nDharma AI`;
    await navigator.clipboard.writeText(text);
    alert("Copied!");
  };

  return (
    <>
      <style>{SHARE_STYLES}</style>
      <div className="sc-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="sc-modal">
          <button className="sc-close" onClick={onClose}>✕</button>

          {/* The actual card that gets screenshotted */}
          <div className="sc-card" ref={cardRef}>
            {displaySanskrit && (
              <div className="sc-sanskrit">{displaySanskrit}</div>
            )}
            {displayTranslation && (
              <>
                <div className="sc-divider" />
                <div className="sc-translation">"{displayTranslation}"</div>
              </>
            )}
            <div className="sc-source">{source}</div>
            <div className="sc-brand">
              <span className="sc-brand-name">Dharma AI</span>
              <span className="sc-brand-url">dharma-ai.app</span>
            </div>
          </div>

          {generating && (
            <div className="sc-generating">Generating image...</div>
          )}

          {shareUrl && (
            <img src={shareUrl} alt="Preview"
              style={{borderRadius:12, width:"100%", opacity:0.8}} />
          )}

          <div className="sc-actions">
            {!shareUrl ? (
              <button className="sc-btn sc-btn-primary" onClick={generateImage}>
                🖼️ Generate Image
              </button>
            ) : (
              <button className="sc-btn sc-btn-primary" onClick={downloadImage}>
                ⬇️ Download
              </button>
            )}
            <button className="sc-btn sc-btn-primary" onClick={shareNative}>
              📤 Share
            </button>
            <button className="sc-btn sc-btn-secondary" onClick={copyText}>
              📋 Copy Text
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
