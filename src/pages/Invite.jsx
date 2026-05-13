import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { KeyRound, ArrowRight } from 'lucide-react';

export default function Invite() {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const codeFromUrl = searchParams.get('invite');
    if (codeFromUrl) {
      setInviteCode(codeFromUrl);
      validateCode(codeFromUrl);
    }
  }, [searchParams]);

  const validateCode = async (code) => {
    if (!code) {
      setError('Inserisci un codice di invito.');
      return;
    }
    setLoading(true);
    setError('');

    const { data, error: dbError } = await supabase
      .from('invitation_codes')
      .select('code')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .is('used_by', null)
      .single();

    setLoading(false);

    if (dbError || !data) {
      setError('Codice di invito non valido o già utilizzato.');
    } else {
      localStorage.setItem('fleofit_invite_code', data.code);
      navigate('/login', { state: { fromInvite: true } });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    validateCode(inviteCode);
  };

  return (
    <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] text-white">
      <div className="w-full max-w-md text-center">
        <h1 className="text-5xl font-black text-white tracking-tight">FLEO<span className="text-[#f1ba17]">FIT</span></h1>
        <p className="text-gray-400 mt-4">La piattaforma di coaching per atleti e allenatori.</p>
        
        <div className="mt-12 bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white">Codice di Invito Richiesto</h2>
          <p className="text-gray-500 text-sm mt-2 mb-6">Per accedere, inserisci il codice di invito che ti è stato fornito.</p>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Il tuo codice di invito" className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-4 pl-11 text-white placeholder-gray-500 focus:outline-none focus:border-[#f1ba17] transition uppercase text-base" disabled={loading} />
            </div>
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            <button type="submit" disabled={loading || !inviteCode} className="w-full flex items-center justify-center gap-2 bg-[#f1ba17] text-black font-bold py-4 rounded-xl hover:brightness-110 transition disabled:opacity-50">{loading ? 'Verifica...' : 'Accedi'}{!loading && <ArrowRight size={18} />}</button>
          </form>
        </div>
        <p className="text-xs text-gray-600 mt-6">Sei già registrato? <a href="/login" className="text-[#f1ba17] hover:underline">Accedi qui</a>.</p>
      </div>
    </div>
  );
}