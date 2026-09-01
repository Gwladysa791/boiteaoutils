/*
  AXIS MUNDI — session-live.js
  Module générique pour les sessions en direct (formateur ↔ participants).
  v1 pré-authentification : accès anonyme encadré par un code de session à 5 caractères.
  Nécessite le SDK Supabase chargé avant ce script :
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
*/
(function () {
  const SUPABASE_URL = 'https://iyjvvzvzachsxikfikts.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_O0m8OtE7btm0RaZ6_Bmj-Q_Pi9-e_ZW';
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I/L)

  function getClient() {
    if (!window.supabase || !window.supabase.createClient) {
      console.error('Supabase SDK non chargé — ajoutez le script CDN avant session-live.js');
      return null;
    }
    if (!window.__axmSupabaseClient) {
      window.__axmSupabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return window.__axmSupabaseClient;
  }

  function genererCode(longueur) {
    longueur = longueur || 5;
    let code = '';
    for (let i = 0; i < longueur; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  async function creerSession(outil, titre) {
    const client = getClient();
    if (!client) throw new Error('Supabase indisponible');
    for (let tentative = 0; tentative < 5; tentative++) {
      const code = genererCode();
      const { data, error } = await client.from('sessions').insert({ code, outil, titre: titre || null }).select().single();
      if (!error) return data;
      if (error.code !== '23505') throw error; // erreur autre qu'une collision de code
    }
    throw new Error('Impossible de générer un code de session unique, réessayez.');
  }

  async function recupererSessionParCode(code) {
    const client = getClient();
    if (!client) throw new Error('Supabase indisponible');
    const { data, error } = await client.from('sessions').select('*').eq('code', (code || '').toUpperCase().trim()).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function envoyerReponse(sessionId, pseudo, payload) {
    const client = getClient();
    if (!client) throw new Error('Supabase indisponible');
    const { data, error } = await client.from('reponses').insert({ session_id: sessionId, pseudo: pseudo || null, payload }).select().single();
    if (error) throw error;
    return data;
  }

  async function listerReponses(sessionId) {
    const client = getClient();
    if (!client) throw new Error('Supabase indisponible');
    const { data, error } = await client.from('reponses').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function ecouterReponses(sessionId, callback) {
    const client = getClient();
    if (!client) return null;
    const channel = client
      .channel('reponses-' + sessionId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reponses', filter: 'session_id=eq.' + sessionId }, function (payload) {
        callback(payload.new);
      })
      .subscribe();
    return channel; // pour se désabonner : client.removeChannel(channel)
  }

  function ecouterSession(sessionId, callback) {
    const client = getClient();
    if (!client) return null;
    const channel = client
      .channel('session-' + sessionId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: 'id=eq.' + sessionId }, function (payload) {
        callback(payload.new);
      })
      .subscribe();
    return channel; // pour se désabonner : client.removeChannel(channel)
  }

  async function definirConsigne(sessionId, consigne) {
    const client = getClient();
    if (!client) throw new Error('Supabase indisponible');
    const { error } = await client.from('sessions').update({ consigne: consigne || null }).eq('id', sessionId);
    if (error) throw error;
  }

  async function mettreAJourSession(sessionId, champs) {
    const client = getClient();
    if (!client) throw new Error('Supabase indisponible');
    const { error } = await client.from('sessions').update(champs).eq('id', sessionId);
    if (error) throw error;
  }

  async function fermerSession(sessionId) {
    const client = getClient();
    if (!client) throw new Error('Supabase indisponible');
    const { error } = await client.from('sessions').update({ statut: 'fermee' }).eq('id', sessionId);
    if (error) throw error;
  }

  window.AXMSession = {
    genererCode,
    creerSession,
    recupererSessionParCode,
    envoyerReponse,
    listerReponses,
    ecouterReponses,
    ecouterSession,
    definirConsigne,
    mettreAJourSession,
    fermerSession,
    getClient
  };
})();
