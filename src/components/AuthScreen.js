import { useState } from 'react';
import { signInWithEmail, verifyOtp } from '../supabase';

export default function AuthScreen({ onSkip }) {
  const [email, setEmail]     = useState('');
  const [code, setCode]       = useState('');
  const [step, setStep]       = useState('email'); // 'email' | 'code'
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Email invalide');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await signInWithEmail(email.trim().toLowerCase());
    setLoading(false);
    if (error) {
      setError('Erreur : ' + error.message);
    } else {
      setStep('code');
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length !== 6) {
      setError('Code à 6 chiffres requis');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await verifyOtp(email.trim().toLowerCase(), code.trim());
    setLoading(false);
    if (error) {
      setError('Code incorrect ou expiré — réessaie');
    }
    // Si succès, onAuthStateChange dans App.js détecte la session automatiquement
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-icon">✂</div>
        <h2 className="auth-title">PanelCut Pro</h2>

        {step === 'email' && (
          <>
            <p className="auth-desc">
              Entre ton email pour recevoir un code de connexion à 6 chiffres.
            </p>
            <div className="auth-form">
              <input
                type="email"
                className="input"
                placeholder="ton@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                autoFocus
              />
              {error && <div className="auth-error">{error}</div>}
              <button
                className="btn btn--primary btn--large"
                onClick={handleSendCode}
                disabled={loading}
              >
                {loading ? 'Envoi...' : '✉ Recevoir mon code'}
              </button>
            </div>
            <div className="auth-divider">ou</div>
            <button className="btn btn--ghost btn--large" onClick={onSkip}>
              Continuer sans compte
            </button>
            <p className="auth-note">
              Un code à 6 chiffres sera envoyé à ton email. Valable 10 minutes.
            </p>
          </>
        )}

        {step === 'code' && (
          <>
            <p className="auth-desc">
              Code envoyé à <strong>{email}</strong>.<br/>
              Entre les 6 chiffres reçus par email.
            </p>
            <div className="auth-form">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="input otp-input"
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,6))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
                autoFocus
              />
              {error && <div className="auth-error">{error}</div>}
              <button
                className="btn btn--primary btn--large"
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Vérification...' : '✓ Se connecter'}
              </button>
            </div>
            <button
              className="btn btn--ghost"
              onClick={() => { setStep('email'); setCode(''); setError(''); }}
              style={{ marginTop: 4 }}
            >
              ← Changer d'email
            </button>
            <button
              className="btn btn--ghost"
              onClick={handleSendCode}
              disabled={loading}
            >
              ↩ Renvoyer le code
            </button>
            <p className="auth-note">
              Le code expire après 10 minutes.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
