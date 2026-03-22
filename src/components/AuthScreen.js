import { useState } from 'react';
import { signInWithEmail } from '../supabase';

export default function AuthScreen({ onSkip }) {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleLogin = async () => {
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
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-icon">📧</div>
          <h2 className="auth-title">Vérifie ta boite mail</h2>
          <p className="auth-desc">
            Un lien de connexion a été envoyé à <strong>{email}</strong>.
            Clique dessus pour te connecter.
          </p>
          <button className="btn btn--ghost" onClick={() => setSent(false)}>
            ← Changer d'email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-icon">✂</div>
        <h2 className="auth-title">PanelCut Pro</h2>
        <p className="auth-desc">
          Connecte-toi pour sauvegarder et retrouver tes projets depuis n'importe quel appareil.
        </p>

        <div className="auth-form">
          <input
            type="email"
            className="input"
            placeholder="ton@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          {error && <div className="auth-error">{error}</div>}
          <button
            className="btn btn--primary btn--large"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Envoi...' : '✉ Recevoir un lien de connexion'}
          </button>
        </div>

        <div className="auth-divider">ou</div>

        <button className="btn btn--ghost btn--large" onClick={onSkip}>
          Continuer sans compte
        </button>

        <p className="auth-note">
          Pas de mot de passe — tu reçois un lien par email à chaque connexion.
        </p>
      </div>
    </div>
  );
}
