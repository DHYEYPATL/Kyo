'use client';

import { useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { IconBrain } from './Icon';
import styles from './LandingPage.module.css';

export function LandingPage({ onClose }: { onClose?: () => void }) {
  const { settings, updateSettings } = useSettings();
  const [key, setKey] = useState(settings.groqApiKey || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed.startsWith('gsk_')) {
      setError('Invalid format. Requires a valid Groq API key.');
      return;
    }
    setError('');
    updateSettings({ groqApiKey: trimmed });
    if (onClose) onClose();
  };

  const hasValidKey = settings.groqApiKey && settings.groqApiKey.startsWith('gsk_');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandIconWrap}>
            <IconBrain size={16} />
          </div>
          <span>Kyo</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.heroSection}>
          <h1 className={styles.headline}>Your Live Copilot.</h1>
          
          <div className={styles.formBox}>
            <div className={styles.formSub}>
              {hasValidKey 
                ? <p>Your system is fully authorized and ready.</p>
                : (
                  <ol className={styles.stepList}>
                    <li>1. Open the <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className={styles.anchor}>Groq Console</a></li>
                    <li>2. Create a new API key</li>
                    <li>3. Paste it securely below</li>
                  </ol>
                )
              }
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.inputGroup}>
                <input
                  type="password"
                  className={styles.inputField}
                  placeholder="Attach your key (gsk_...)"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <button type="submit" disabled={!key.trim() || key === settings.groqApiKey} className={styles.actionBtn}>
                  {key === settings.groqApiKey ? 'Set' : 'Enter'}
                </button>
              </div>
              {error && <div className={styles.error}>{error}</div>}
              
              {hasValidKey && onClose && (
                <button type="button" onClick={onClose} className={styles.secondaryBtn}>
                  Return to Active Session
                </button>
              )}
            </form>
          </div>
        </div>

        <p className={styles.desc}>
          Kyo is a private, browser-based AI that interprets your meetings in real time. Absolute privacy with infinite context.
        </p>

        <div className={styles.editorialGrid}>
          <div className={styles.cell}>
            <div className={styles.cellHeader}>Live Transcripts</div>
            <div className={styles.cellBody}>
              Capture microphone and system audio simultaneously. Instantly converted to text locally.
            </div>
          </div>
          
          <div className={styles.cell}>
            <div className={styles.cellHeader}>Smart Insights</div>
            <div className={styles.cellBody}>
              Kyo detects patterns and logic, silently offering relevant context and facts as you speak.
            </div>
          </div>

          <div className={styles.cell}>
            <div className={styles.cellHeader}>Zero Data Kept</div>
            <div className={styles.cellBody}>
              Your dialogue stays encrypted in your browser's RAM. We maintain zero databases or server logs. 
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          100% Client Side • No Server State • Privacy First Architecture
        </div>
      </main>
    </div>
  );
}
