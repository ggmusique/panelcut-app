import { useState } from 'react';
import { signInWithEmail, verifyOtp } from '../supabase';
import { Scissors, Mail, Lock, ChevronLeft, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

export default function AuthScreen({ onSkip }) {
  const [email, setEmail]     = useState('');
  const [code, setCode]       = useState('');
  const [step, setStep]       = useState('email');
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
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Arrière-plan animé avec lueurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-blue-600/5 rounded-full blur-[100px]"></div>
        
        {/* Grille subtile en fond */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNDBMODAgMEgwTDQwIDQweiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiIC8+PC9zdmc+')] opacity-20"></div>
      </div>

      {/* Carte de connexion Glassmorphism */}
      <div className="relative z-10 w-full max-w-md">
        
        {/* Effet de lueur derrière la carte */}
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-purple-600 to-blue-600 rounded-3xl opacity-20 blur-xl"></div>
        
        <div className="relative bg-[#0f0f0f]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          
          {/* En-tête avec Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg shadow-orange-900/30 mb-4 transform hover:scale-105 transition-transform duration-300">
              <Scissors className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
              PanelCut <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">Pro</span>
            </h1>
            <p className="text-slate-400 text-sm font-medium">Optimisation de découpe intelligente</p>
          </div>

          {/* ÉTAPE 1 : EMAIL */}
          {step === 'email' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/10 rounded-full mb-3">
                  <Mail className="w-6 h-6 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Connexion sécurisée</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Entre ton email pour recevoir un code magique à 6 chiffres. Pas de mot de passe à retenir.
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative group">
                  <input
                    type="email"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-4 pl-12 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300 font-medium"
                    placeholder="ton@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                    autoFocus
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-shake">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/20 transform transition-all duration-300 hover:-translate-y-0.5 hover:shadow-orange-900/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  onClick={handleSendCode}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Recevoir mon code
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0f0f0f] px-3 text-slate-500 font-medium">ou</span>
                </div>
              </div>

              <button 
                className="w-full py-4 rounded-xl border border-white/10 text-slate-400 font-bold hover:bg-white/5 hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
                onClick={onSkip}
              >
                Continuer sans compte
              </button>

              <p className="text-center text-xs text-slate-500 leading-relaxed">
                🔒 Un code à 6 chiffres sera envoyé à ton email.<br/>
                Valable 10 minutes. Aucun spam, promis.
              </p>
            </div>
          )}

          {/* ÉTAPE 2 : CODE OTP */}
          {step === 'code' && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/10 rounded-full mb-3">
                  <Lock className="w-6 h-6 text-green-400" />
                </div>
                <h2 className="text-lg font-bold text-white mb-2">Vérification</h2>
                <p className="text-slate-400 text-sm">
                  Code envoyé à <span className="text-orange-400 font-semibold">{email}</span>
                </p>
              </div>

              <div className="space-y-4">
                <div className="relative group">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-4 pl-12 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder-slate-600 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all duration-300"
                    placeholder="000000"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,6))}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
                    autoFocus
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-green-500 transition-colors" />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 transform transition-all duration-300 hover:-translate-y-0.5 hover:shadow-green-900/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  onClick={handleVerifyCode}
                  disabled={loading || code.length !== 6}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Se connecter
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  className="flex-1 py-3 rounded-lg border border-white/10 text-slate-400 text-sm font-medium hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2"
                  onClick={() => { setStep('email'); setCode(''); setError(''); }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Changer d'email
                </button>
                <button
                  className="flex-1 py-3 rounded-lg border border-white/10 text-slate-400 text-sm font-medium hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2"
                  onClick={handleSendCode}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Renvoyer
                </button>
              </div>

              <p className="text-center text-xs text-slate-500">
                Le code expire après 10 minutes.
              </p>
            </div>
          )}

        </div>
        
        {/* Footer discret */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-600 font-medium">
            Propulsé par PanelCut Pro © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
