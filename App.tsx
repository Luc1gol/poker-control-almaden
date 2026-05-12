import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { GameState, Player, Rebuy, HOUSE_FEE_FIXED } from './types';
import { supabase } from './src/supabaseClient';
import { PokerLogo } from './components/PokerLogo';
import { Button, Card, Input, Badge } from './components/UI';
import { Trash2, Plus, Users, DollarSign, Trophy, ArrowRight, RefreshCcw, Save, AlertTriangle, CheckCircle, Activity, Share2, X, Pencil, Check, LogOut, Lock, Settings } from 'lucide-react';

// --- Constants ---
const STORAGE_KEY = 'poker_control_state_v1';
const INITIAL_STATE: GameState = {
  isStarted: false,
  finished: false,
  config: { buyInAmount: 50 },
  players: []
};

const generateId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

// --- Helper: Formatters ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number) => {
  if (!isFinite(value) || isNaN(value)) return '---';
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
};

export default function App() {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [view, setView] = useState<'SETUP' | 'DASHBOARD' | 'PLAYER_DETAIL' | 'CASHOUT' | 'RANKING' | 'RANKING_GERAL' | 'ESTATISTICAS' | 'JOGADORES' | 'CAIXA'>('SETUP');
  
  // UI Control States
  const [showResetModal, setShowResetModal] = useState(false);
  // Database & Auth States
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState('');
  const [caixaData, setCaixaData] = useState<{id: string, created_at: string, descricao: string, valor: number, tipo: 'ENTRADA' | 'SAIDA'}[]>([]);
  const [isFetchingCaixa, setIsFetchingCaixa] = useState(false);
  const [newDespesaDesc, setNewDespesaDesc] = useState('');
  const [newDespesaValor, setNewDespesaValor] = useState('');
  const [registeredPlayers, setRegisteredPlayers] = useState<{ id: string; nome: string }[]>([]);
  const [rankingData, setRankingData] = useState<{ 
    nome: string; 
    pt: number; 
    buy: number; 
    out: number;
    firsts: number;
    seconds: number;
    thirds: number;
  }[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [newRegistredName, setNewRegistredName] = useState('');
  const [resultadosSalvos, setResultadosSalvos] = useState(false);
  const [caixaSalvo, setCaixaSalvo] = useState(false);
  const [salvandoResultados, setSalvandoResultados] = useState(false);
  const [salvandoCaixa, setSalvandoCaixa] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');

  // Player Detail Modal State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [rebuyAmount, setRebuyAmount] = useState<string>('50');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- Database Fetching ---
  const fetchRegisteredPlayers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setRegisteredPlayers([]);
        return;
      }
      const { data, error } = await supabase.from('jogadores_cadastrados').select('id, nome');
      if (error) throw error;
      setRegisteredPlayers((data || []).sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch(e) {
      console.error(e);
    }
  };

  const fetchHistorico = async () => {
    setIsFetchingHistory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setRankingData([]);
        return;
      }
      const { data, error } = await supabase.from('registros_poker').select('nome, pontos, buy_in_total, saida_total, performance_percentual');
      if (error) throw error;
      
      const agg = new Map();
      (data || []).forEach(row => {
        if (!agg.has(row.nome)) agg.set(row.nome, { nome: row.nome, pt: 0, buy: 0, out: 0, firsts: 0, seconds: 0, thirds: 0 });
        const cur = agg.get(row.nome);
        cur.pt += (row.pontos || 0);
        cur.buy += (row.buy_in_total || 0);
        cur.out += (row.saida_total || 0);
        
        if (row.pontos === 20) cur.firsts += 1;
        else if (row.pontos === 15) cur.seconds += 1;
        else if (row.pontos === 12) cur.thirds += 1;
      });
      setRankingData(Array.from(agg.values()).sort((a,b) => {
         if (b.pt !== a.pt) return b.pt - a.pt;
         if (b.firsts !== a.firsts) return b.firsts - a.firsts;
         if (b.seconds !== a.seconds) return b.seconds - a.seconds;
         if (b.thirds !== a.thirds) return b.thirds - a.thirds;
         const aLucro = a.out - a.buy;
         const bLucro = b.out - b.buy;
         return bLucro - aLucro;
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const fetchCaixa = async () => {
    setIsFetchingCaixa(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setCaixaData([]);
        return;
      }
      const { data, error } = await supabase.from('caixa_clube').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setCaixaData(data || []);
    } catch (e) {
      console.error("Erro ao buscar caixa", e);
    } finally {
      setIsFetchingCaixa(false);
    }
  };

  const handleAddDespesa = async () => {
    if (!newDespesaDesc.trim() || !newDespesaValor) return;
    const val = parseFloat(newDespesaValor.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        alert('Sessão inválida. Faça login novamente para lançar no caixa.');
        return;
      }
      const { error } = await supabase.from('caixa_clube').insert({
        descricao: newDespesaDesc.trim(),
        valor: val,
        tipo: 'SAIDA',
        user_id: session.user.id,
      });
      if (error) throw error;
      setNewDespesaDesc('');
      setNewDespesaValor('');
      fetchCaixa();
    } catch(e) {
      console.error(e);
      alert('Erro ao registrar despesa. Verifique a tabela no banco.');
    }
  };

  const handleRegisterPlayer = async () => {
    if (!newRegistredName.trim()) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        alert('Sessão inválida. Faça login novamente para cadastrar jogadores.');
        return;
      }
      const { error } = await supabase.from('jogadores_cadastrados').insert([
        { nome: newRegistredName.trim(), user_id: session.user.id },
      ]);
      if (error) {
        console.log('Erro RLS ou insert (jogadores_cadastrados):', error);
        throw error;
      }
      setNewRegistredName('');
      fetchRegisteredPlayers();
    } catch (error) {
      console.log('Erro ao salvar:', error);
      alert('Erro ao cadastrar jogador. Verifique a tabela e as regras do Supabase.');
    }
  };

  const handleEditPlayer = async (id: string) => {
    if (!editingPlayerName.trim()) return;
    try {
      const { error } = await supabase.from('jogadores_cadastrados').update({ nome: editingPlayerName.trim() }).eq('id', id);
      if (error) throw error;
      setEditingPlayerId(null);
      setEditingPlayerName('');
      fetchRegisteredPlayers();
    } catch(e) {
      console.error(e);
      alert('Erro ao editar jogador.');
    }
  };

  useEffect(() => {
    if (session) {
      fetchRegisteredPlayers();
    } else {
      setRegisteredPlayers([]);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setRankingData([]);
      setCaixaData([]);
      return;
    }
    if (view === 'RANKING_GERAL' || view === 'ESTATISTICAS') {
      fetchHistorico();
    }
    if (view === 'CAIXA') {
      fetchCaixa();
    }
  }, [session, view]);

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Sanitize: Remove potential ghost players from saved state
        if (parsed.players) {
          parsed.players = parsed.players.filter((p: Player) => p.name && p.name.trim() !== '');
        }

        setGameState(parsed);
        if (parsed.isStarted) setView(parsed.finished ? 'RANKING' : 'DASHBOARD');
      } catch (e) {
        console.error("Failed to load state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Reset UI states when changing views/players
  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [selectedPlayerId, view]);

  // --- Helpers & Computed ---
  const getPlayer = (id: string) => gameState.players.find(p => p.id === id);

  // Derived state for rendering to ensure consistency
  const validPlayers = gameState.players.filter(p => p.name && p.name.trim() !== '');

  const calculateTotals = () => {
    let totalBuyIns = 0; // Raw money collected
    let totalRebuys = 0;
    let totalFees = 0;
    let totalChips = 0; // Chips distributed
    let totalPaid = 0;
    let totalPending = 0;

    // Use validPlayers for calculations too, just to be safe
    validPlayers.forEach(p => {
      // Buy-in logic
      totalBuyIns += gameState.config.buyInAmount;
      totalFees += HOUSE_FEE_FIXED; // Fixed fee per player buy-in
      
      // Chips Logic: Buy-in defined - House Fee
      const buyInChips = gameState.config.buyInAmount - HOUSE_FEE_FIXED;
      totalChips += buyInChips;
      
      if (p.buyInStatus === 'PAID') totalPaid += gameState.config.buyInAmount;
      else totalPending += gameState.config.buyInAmount;

      // Rebuy logic (No Fee)
      p.rebuys.forEach(r => {
        totalRebuys += r.amount;
        totalChips += r.amount; // Rebuy goes 100% to chips
        if (r.status === 'PAID') totalPaid += r.amount;
        else totalPending += r.amount;
      });
    });

    return { totalBuyIns, totalRebuys, totalFees, totalChips, totalPaid, totalPending };
  };

  const totals = calculateTotals();

  // Determine debtors for the sidebar
  const debtors = validPlayers.map(player => {
    const paidCash = (player.buyInStatus === 'PAID' ? gameState.config.buyInAmount : 0) + 
                    player.rebuys.reduce((sum, r) => r.status === 'PAID' ? sum + r.amount : sum, 0);
    const totalCostCash = gameState.config.buyInAmount + player.rebuys.reduce((sum, r) => sum + r.amount, 0);
    const pendingCash = totalCostCash - paidCash;
    
    return {
        id: player.id,
        name: player.name,
        pending: pendingCash
    };
  }).filter(p => p.pending > 0);

  // --- Actions ---

  const handleStartGame = (amount: number) => {
    setGameState(prev => ({
      ...prev,
      isStarted: true,
      finished: false,
      config: { buyInAmount: amount }
    }));
    setView('DASHBOARD');
  };

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newPlayer: Player = {
      id: generateId(),
      name: newPlayerName.trim(),
      buyInStatus: 'PENDING',
      rebuys: [],
    };
    setGameState(prev => ({ ...prev, players: [...prev.players, newPlayer] }));
    setNewPlayerName('');
  };

  const updatePlayerStatus = (id: string, status: 'PAID' | 'PENDING') => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === id ? { ...p, buyInStatus: status } : p)
    }));
  };

  const addRebuy = (playerId: string, amount: number) => {
    if (amount < 1) {
      alert("O valor do Rebuy deve ser maior que zero.");
      return;
    }
    const newRebuy: Rebuy = {
      id: generateId(),
      amount,
      status: 'PENDING',
      timestamp: Date.now()
    };
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, rebuys: [...p.rebuys, newRebuy] } : p)
    }));
  };

  const removeRebuy = (playerId: string, rebuyId: string) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, rebuys: p.rebuys.filter(r => r.id !== rebuyId) } : p)
    }));
  };

  const toggleRebuyStatus = (playerId: string, rebuyId: string) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => 
        p.id === playerId 
          ? { ...p, rebuys: p.rebuys.map(r => r.id === rebuyId ? { ...r, status: r.status === 'PAID' ? 'PENDING' : 'PAID' } : r) } 
          : p
      )
    }));
  };

  const removePlayer = (playerId: string) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== playerId)
    }));
    setView('DASHBOARD');
    setSelectedPlayerId(null);
    setShowDeleteConfirm(false);
  };

  const confirmResetGame = () => {
    // 1. Limpeza explícita do storage
    localStorage.removeItem(STORAGE_KEY);
    
    // 2. Reset de variáveis locais de UI
    setNewPlayerName('');
    setRebuyAmount('50');
    setSelectedPlayerId(null);
    setShowResetModal(false);
    setResultadosSalvos(false);
    setCaixaSalvo(false);
    
    // 3. Reset do estado global para o inicial
    const emptyState: GameState = {
      isStarted: false,
      finished: false,
      config: { buyInAmount: 50 },
      players: []
    };
    
    setGameState(emptyState);
    
    // 4. Navegação forçada
    setView('SETUP');
    window.scrollTo(0, 0);
  };

  const submitCashout = (playerId: string, amount: number) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === playerId ? { ...p, cashoutAmount: amount } : p)
    }));
  };

  const getRankedPlayersForCashoutSave = () => {
    const getPoints = (index: number) => {
      if (index === 0) return 20;
      if (index === 1) return 15;
      if (index === 2) return 12;
      return 5;
    };
    return [...validPlayers].map(p => {
      const buyInChips = gameState.config.buyInAmount - HOUSE_FEE_FIXED;
      const rebuysTotal = p.rebuys.reduce((sum, r) => sum + r.amount, 0);
      const investedChips = buyInChips + rebuysTotal;
      const out = p.cashoutAmount || 0;
      const performanceRatio = investedChips > 0 ? (out / investedChips) : 0;
      return { ...p, investedChips, out, performanceRatio };
    }).sort((a, b) => {
      if (a.performanceRatio === b.performanceRatio) return b.out - a.out;
      return b.performanceRatio - a.performanceRatio;
    }).map((p, index) => ({
      ...p,
      points: getPoints(index)
    }));
  };

  const handleResultados = async () => {
    setSalvandoResultados(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setSalvandoResultados(false);
        alert('Sessão inválida. Faça login novamente para salvar na nuvem.');
        return;
      }
      const rankedPlayers = getRankedPlayersForCashoutSave();
      if (rankedPlayers.length === 0) {
        setResultadosSalvos(true);
        setSalvandoResultados(false);
        return;
      }
      const records = rankedPlayers.map(p => ({
        nome: p.name,
        pontos: p.points,
        "buy_in_total": p.investedChips,
        "saida_total": p.out,
        "performance_percentual": p.performanceRatio,
        user_id: session.user.id,
      }));
      const { error } = await supabase.from('registros_poker').insert(records);
      setSalvandoResultados(false);
      if (error) {
        console.error('Erro ao salvar resultados:', error);
        alert('Houve um erro ao salvar os resultados na nuvem.');
        return;
      }
      setResultadosSalvos(true);
    } catch (e) {
      console.error(e);
      setSalvandoResultados(false);
      alert('Erro de conexão ao salvar os resultados na nuvem.');
    }
  };

  const handleCaixa = async () => {
    setSalvandoCaixa(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setSalvandoCaixa(false);
        alert('Sessão inválida. Faça login novamente para salvar na nuvem.');
        return;
      }
      const totalCashout = validPlayers.reduce((sum, p) => sum + (p.cashoutAmount || 0), 0);
      const taxaDaCasa = totalCashout * 0.10;
      if (taxaDaCasa <= 0) {
        setCaixaSalvo(true);
        setSalvandoCaixa(false);
        return;
      }
      const { error } = await supabase.from('caixa_clube').insert({
        descricao: '10% da Partida',
        valor: taxaDaCasa,
        tipo: 'ENTRADA',
        user_id: session.user.id,
      });
      setSalvandoCaixa(false);
      if (error) {
        console.error('Erro ao salvar caixa:', error);
        alert('Houve um erro ao salvar o caixa na nuvem.');
        return;
      }
      setCaixaSalvo(true);
    } catch (e) {
      console.error(e);
      setSalvandoCaixa(false);
      alert('Erro de conexão ao salvar o caixa na nuvem.');
    }
  };
  // --- Image Share Functions ---
  const executeImageShare = async (elementId: string, title: string, filenamePrefix: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Check if html2canvas is loaded globally
    const html2canvas = (window as any).html2canvas;
    if (!html2canvas) {
        console.error("Biblioteca de captura não carregada.");
        return;
    }

    try {
        const canvas = await html2canvas(element, {
            backgroundColor: '#111111', // Force dark background
            scale: 2, // Better resolution
            logging: false,
            useCORS: true
        });
        
        canvas.toBlob(async (blob: Blob | null) => {
            if (!blob) return;
            
            const file = new File([blob], `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.png`, { type: blob.type });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: title,
                    });
                    console.log("Compartilhamento nativo de imagem bem sucedido.");
                    return;
                } catch (error) {
                    console.error("Compartilhamento nativo cancelado ou falhou:", error);
                    return; 
                }
            }
            
            console.log("Compartilhamento nativo indisponível. Iniciando download de imagem.");
            const link = document.createElement('a');
            link.download = file.name;
            link.href = canvas.toDataURL();
            link.click();
        });
    } catch (e) {
        console.error("Screenshot failed", e);
    }
  };

  const handleShareRankingGeral = () => executeImageShare('ranking-geral-card', 'Ranking Poker Control', 'poker-ranking');
  const handleShareEstatisticas = () => executeImageShare('stats-card', 'Estatísticas Poker Control', 'poker-stats');
  const handleShare = () => executeImageShare('results-card', 'Resultado Poker Control', 'poker-result');

  // --- Auth Effect ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthenticating(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAuthenticating(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      setAuthError(error.message);
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    setRegisteredPlayers([]);
    setCaixaData([]);
    setRankingData([]);
    setNewRegistredName('');
    setEditingPlayerId(null);
    setEditingPlayerName('');
    setNewDespesaDesc('');
    setNewDespesaValor('');
    setResultadosSalvos(false);
    setCaixaSalvo(false);
    setSalvandoResultados(false);
    setSalvandoCaixa(false);
    setIsFetchingCaixa(false);
    setIsFetchingHistory(false);
    setAuthPassword('');
    setAuthError('');
    await supabase.auth.signOut();
  };

  // --- Views ---

  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 poker-felt">
         <Activity className="text-poker-red animate-spin mb-4" size={32} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center poker-felt">
        <PokerLogo size={100} className="mb-6 drop-shadow-[0_0_15px_rgba(208,2,27,0.5)]" />
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">CASSINO ALMADEN</h1>
        <p className="text-gray-400 mb-8 max-w-xs mx-auto text-sm">Acesso restrito. Insira suas credenciais para continuar.</p>
        
        <Card className="w-full max-w-md p-6 bg-gradient-to-b from-[#111] to-black border border-poker-red/30 shadow-[0_0_30px_rgba(208,2,27,0.1)]">
           <form onSubmit={handleLogin} className="flex flex-col gap-4 text-left">
              {authError && (
                 <div className="bg-red-900/30 border border-red-500/50 p-3 rounded flex items-start justify-center gap-2 text-red-500 text-sm">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" /> <span className="flex-1">{authError}</span>
                 </div>
              )}
              <div>
                 <label className="block text-xs font-bold text-gray-400 uppercase mb-2">E-mail</label>
                 <Input 
                   type="email" 
                   value={authEmail} 
                   onChange={(e) => setAuthEmail(e.target.value)} 
                   placeholder="admin@almaden.com"
                   required
                 />
              </div>
              <div className="mb-2">
                 <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Senha</label>
                 <Input 
                   type="password" 
                   value={authPassword} 
                   onChange={(e) => setAuthPassword(e.target.value)} 
                   placeholder="••••••••"
                   required
                 />
              </div>
              <Button type="submit" className="w-full h-12 uppercase tracking-wide flex items-center justify-center gap-2 font-bold" variant="primary">
                 <Lock size={18} /> Entrar
              </Button>
           </form>
        </Card>
      </div>
    );
  }

  if (view === 'SETUP') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center poker-felt relative">
        <div className="absolute top-4 left-4">
          <Button variant="outline" className="border-none !p-2 hover:bg-white/10 text-gray-400 hover:text-red-400" onClick={handleLogout} title="Sair do App">
             <LogOut size={20} />
          </Button>
        </div>
        <PokerLogo size={120} className="mb-8 drop-shadow-[0_0_15px_rgba(208,2,27,0.5)]" />
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight flex items-center justify-center gap-3">
           POKER CONTROL <Settings size={28} className="text-gray-600 hover:text-white transition-colors cursor-pointer" />
        </h1>
        <p className="text-gray-400 mb-8 max-w-xs mx-auto">Configure a partida, gerencie buy-ins e controle o bankroll com precisão profissional.</p>
        
        <Card className="w-full max-w-md p-6 bg-gradient-to-b from-gray-800 to-gray-900 border-poker-red/30">
          <label className="block text-left text-sm font-bold text-poker-red uppercase mb-2">Valor do Buy-in Inicial</label>
          <div className="relative mb-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R$</span>
            <input 
              type="number" 
              className="w-full bg-black border border-white/20 rounded-lg py-4 pl-12 pr-4 text-2xl font-bold text-white focus:border-poker-red focus:outline-none transition-colors"
              placeholder="0.00"
              defaultValue={50}
              id="buyInInput"
            />
          </div>
          
          <Button 
            className="w-full py-4 text-lg"
            onClick={() => {
              const el = document.getElementById('buyInInput') as HTMLInputElement;
              handleStartGame(Number(el.value));
            }}
          >
            INICIAR PARTIDA
          </Button>
        </Card>
      </div>
    );
  }

  const selectedPlayer = getPlayer(selectedPlayerId || '');

  if (view === 'PLAYER_DETAIL' && selectedPlayer) {
    // Invested (Fichas) calculation: (BuyIn - 10) + Rebuys
    const buyInChips = gameState.config.buyInAmount - HOUSE_FEE_FIXED;
    const investedChips = buyInChips + selectedPlayer.rebuys.reduce((sum, r) => sum + r.amount, 0);

    // Paid calculation (Actual Cash)
    const paidCash = (selectedPlayer.buyInStatus === 'PAID' ? gameState.config.buyInAmount : 0) + 
                     selectedPlayer.rebuys.reduce((sum, r) => r.status === 'PAID' ? sum + r.amount : sum, 0);
    
    // Total Cost (Cash) calculation to determine pending
    const totalCostCash = gameState.config.buyInAmount + selectedPlayer.rebuys.reduce((sum, r) => sum + r.amount, 0);
    const pendingCash = totalCostCash - paidCash;

    return (
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center gap-4 mb-6">
             <Button variant="outline" onClick={() => setView('DASHBOARD')} className="!p-2">
               <ArrowRight className="rotate-180" size={20} />
             </Button>
             <h2 className="text-2xl font-bold">{selectedPlayer.name}</h2>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Card className="text-center py-3">
              <div className="text-xs text-gray-400 uppercase">Buy-in</div>
              <div className="text-xl font-bold text-white">{formatCurrency(investedChips)}</div>
            </Card>
            <Card className="text-center py-3">
              <div className="text-xs text-gray-400 uppercase">Pago (Cx)</div>
              <div className="text-xl font-bold text-green-400">{formatCurrency(paidCash)}</div>
            </Card>
            <Card className="text-center py-3">
              <div className="text-xs text-gray-400 uppercase">Pendente</div>
              <div className="text-xl font-bold text-red-500">{formatCurrency(pendingCash)}</div>
            </Card>
          </div>

          <Card title="Buy-In Inicial">
             <div className="flex justify-between items-center">
               <div>
                  <div className="font-bold">Buy-In ({formatCurrency(gameState.config.buyInAmount)})</div>
                  <div className="text-xs text-gray-500">
                    Fichas: {formatCurrency(gameState.config.buyInAmount - HOUSE_FEE_FIXED)} | Taxa: {formatCurrency(HOUSE_FEE_FIXED)}
                  </div>
               </div>
               <Button 
                 onClick={() => updatePlayerStatus(selectedPlayer.id, selectedPlayer.buyInStatus === 'PAID' ? 'PENDING' : 'PAID')}
                 variant={selectedPlayer.buyInStatus === 'PAID' ? 'outline' : 'danger'}
                 className="text-xs py-1"
               >
                 {selectedPlayer.buyInStatus === 'PAID' ? 'PAGO' : 'PAGAR'}
               </Button>
             </div>
          </Card>

          <Card title="Gerenciar Rebuys">
            <div className="flex gap-2 mb-4 items-end">
              <Input 
                label="Valor (R$)" 
                type="number" 
                value={rebuyAmount} 
                onChange={(e) => setRebuyAmount(e.target.value)}
              />
              <Button onClick={() => addRebuy(selectedPlayer.id, Number(rebuyAmount))} className="h-[50px] mb-[1px]">
                <Plus size={20} /> Adicionar
              </Button>
            </div>
            
            <div className="space-y-2">
              {selectedPlayer.rebuys.map((rebuy, idx) => (
                <div key={rebuy.id} className="flex justify-between items-center bg-black/20 p-3 rounded border border-white/5">
                  <div className="flex items-center gap-3">
                     <span className="text-xs font-mono text-gray-500">#{idx + 1}</span>
                     <span className="font-bold text-white">{formatCurrency(rebuy.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => toggleRebuyStatus(selectedPlayer.id, rebuy.id)}
                      className={`text-xs px-2 py-1 rounded border ${rebuy.status === 'PAID' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'}`}
                    >
                      {rebuy.status}
                    </button>
                    <button onClick={() => removeRebuy(selectedPlayer.id, rebuy.id)} className="text-gray-500 hover:text-red-500 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {selectedPlayer.rebuys.length === 0 && (
                <div className="text-center text-gray-500 py-4 text-sm">Nenhum rebuy registrado</div>
              )}
            </div>
          </Card>

          <div className="pt-4 pb-8">
            {showDeleteConfirm ? (
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
                    <p className="text-red-200 font-bold text-center mb-3 text-sm">Tem certeza? Essa ação não pode ser desfeita.</p>
                    <div className="flex gap-2">
                        <Button 
                            variant="secondary" 
                            className="flex-1 py-2 text-xs"
                            onClick={() => setShowDeleteConfirm(false)}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="danger" 
                            className="flex-1 py-2 text-xs bg-red-600 hover:bg-red-700 border-none text-white"
                            onClick={() => removePlayer(selectedPlayer.id)}
                        >
                            Confirmar Exclusão
                        </Button>
                    </div>
                </div>
            ) : (
                <Button 
                    variant="danger" 
                    className="w-full opacity-80 hover:opacity-100 border-red-500/20 bg-red-900/20 text-red-400" 
                    onClick={() => setShowDeleteConfirm(true)}
                >
                    <Trash2 size={18} /> Excluir Jogador
                </Button>
            )}
            {!showDeleteConfirm && (
                <p className="text-center text-xs text-gray-600 mt-2">
                    Esta ação removerá permanentemente o jogador da partida.
                </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'RANKING' || view === 'CASHOUT') {
    // Logic for Chip Verification
    const totalCashoutDeclared = validPlayers.reduce((sum, p) => sum + (p.cashoutAmount || 0), 0);
    const chipsDifference = totals.totalChips - totalCashoutDeclared;
    const isBalanced = Math.abs(chipsDifference) < 0.1; // Floating point tolerance

    const getPoints = (index: number) => {
      if (index === 0) return 20;
      if (index === 1) return 15;
      if (index === 2) return 12;
      return 5;
    };

    // Ranking Logic
    const rankedPlayers = [...validPlayers].map(p => {
      // Calculate Total Input (Chips Value): (BuyIn - 10) + Rebuys
      const buyInChips = gameState.config.buyInAmount - HOUSE_FEE_FIXED;
      const rebuysTotal = p.rebuys.reduce((sum, r) => sum + r.amount, 0);
      const investedChips = buyInChips + rebuysTotal; // EntradaTotal

      const out = p.cashoutAmount || 0;
      
      // Performance Formula: Out / In (Ratio)
      // If In is 0 (shouldn't happen if they bought in), avoid division by zero
      const performanceRatio = investedChips > 0 ? (out / investedChips) : 0;
      
      const rankingFee = out * 0.10;
      const net = out - rankingFee;

      return { ...p, investedChips, out, performanceRatio, rankingFee, net };
    }).sort((a, b) => {
      // Sort by performance ratio (descending)
      // Handle cases where ratio is same: sort by cashout amount
      if (a.performanceRatio === b.performanceRatio) return b.out - a.out;
      return b.performanceRatio - a.performanceRatio;
    }).map((p, index) => ({
      ...p,
      points: getPoints(index)
    }));

    return (
      <div className="min-h-screen bg-black text-white p-4 pb-20">
         <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               {view === 'CASHOUT' && (
                 <Button variant="outline" onClick={() => setView('DASHBOARD')} className="!p-2">
                  <ArrowRight className="rotate-180" size={20} />
                 </Button>
               )}
               <h2 className="text-2xl font-bold uppercase tracking-widest text-poker-red">
                 {view === 'CASHOUT' ? 'Registro de Saída' : 'Ranking Final'}
               </h2>
            </div>
            <div className="flex gap-2 relative z-50 max-w-[60%] min-w-0 overflow-x-auto flex-nowrap pb-2 custom-scrollbar">
              {view === 'CASHOUT' && (
                <>
                  <Button onClick={handleResultados} variant="primary" className={`shrink-0 whitespace-nowrap ${resultadosSalvos ? "bg-green-600 text-white border-green-500 hover:bg-green-700" : ""}`} disabled={salvandoResultados || resultadosSalvos}>
                    {salvandoResultados ? "Salvando..." : (resultadosSalvos ? "Salvo" : "Resultados")}
                  </Button>
                  <Button onClick={handleCaixa} variant="primary" className={`shrink-0 whitespace-nowrap ${caixaSalvo ? "bg-green-600 text-white border-green-500 hover:bg-green-700" : ""}`} disabled={salvandoCaixa || caixaSalvo}>
                    {salvandoCaixa ? "Salvando..." : (caixaSalvo ? "Salvo" : "Caixa")}
                  </Button>
                  {resultadosSalvos && caixaSalvo && (
                    <Button onClick={confirmResetGame} variant="secondary" className="shrink-0 whitespace-nowrap">
                       Iniciar Nova Partida
                    </Button>
                  )}
                </>
              )}
            </div>
            {view === 'RANKING' && (
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowResetModal(true);
                }} 
                variant="outline" 
                className="text-xs relative z-50"
              >
                Nova Partida
              </Button>
            )}
          </div>
          
          {/* Chip Verification Section */}
          <Card className={`p-4 border-l-4 ${isBalanced ? 'border-l-green-500 bg-green-900/10' : 'border-l-red-500 bg-red-900/10'}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-1 ${isBalanced ? 'text-green-500' : 'text-red-500'}`}>
                {isBalanced ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div className="flex-1">
                <h3 className={`font-bold uppercase mb-1 ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                  {isBalanced ? 'Conferência OK' : 'Atenção: Diferença de Fichas'}
                </h3>
                <div className="text-sm space-y-1 text-gray-300">
                  <div className="flex justify-between">
                    <span>Fichas em Jogo (Distribuídas):</span>
                    <span className="font-mono">{formatCurrency(totals.totalChips)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Cashout (Recolhidas):</span>
                    <span className="font-mono">{formatCurrency(totalCashoutDeclared)}</span>
                  </div>
                  {!isBalanced && (
                     <div className="flex justify-between pt-2 border-t border-white/10 mt-1 font-bold text-red-400">
                       <span>Diferença:</span>
                       <span>{chipsDifference > 0 ? `Faltam ${formatCurrency(chipsDifference)}` : `Fichas a mais ${formatCurrency(Math.abs(chipsDifference))}`}</span>
                     </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {view === 'CASHOUT' && (
            <div className="space-y-3">
              {validPlayers.map(p => (
                <Card key={p.id} className="flex justify-between items-center p-3">
                  <span className="font-bold">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Valor de Saída:</span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">R$</span>
                      <input 
                        type="number" 
                        className="bg-black border border-white/20 w-28 pl-6 pr-2 py-1 text-right text-white rounded focus:border-poker-red outline-none"
                        value={p.cashoutAmount === undefined ? '' : p.cashoutAmount}
                        onChange={(e) => submitCashout(p.id, Number(e.target.value))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          
          {/* Ranking Table Preview (Visible in Cashout too) */}
          <Card 
            title="Resultado Financeiro" 
            id="results-card"
            action={
               <Button variant="outline" onClick={handleShare} className="!p-1.5 h-8 text-xs gap-2">
                  <Share2 size={14} /> <span className="hidden sm:inline">Compartilhar</span>
               </Button>
            }
          >
            {/* Mobile View: Cards */}
            <div className="md:hidden flex flex-col gap-3">
               {rankedPlayers.map((p, idx) => {
                 const isPositive = p.performanceRatio >= 1;
                 return (
                   <div key={p.id} className="bg-white/5 rounded-lg p-3 border border-white/5 flex flex-col gap-3">
                      {/* Header: Rank + Name + Net */}
                      <div className="flex justify-between items-center pb-2 border-b border-white/5">
                         <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                               <span className="text-lg font-bold text-white/50 leading-none">#{idx + 1}</span>
                            </div>
                            <div>
                               <div className="font-bold text-white">{p.name}</div>
                               <div className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">+{p.points} PTS</div>
                            </div>
                         </div>
                         <div className="text-right">
                            <div className="text-[10px] text-gray-500 uppercase font-bold">Líquido</div>
                            <div className="text-xl font-bold text-green-400 leading-none">{formatCurrency(p.net)}</div>
                         </div>
                      </div>
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                          <div className="flex justify-between pr-2 border-r border-white/5">
                             <span className="text-gray-500">Buy-in</span>
                             <span className="text-gray-300 font-mono">{formatCurrency(p.investedChips)}</span>
                          </div>
                          <div className="flex justify-between pl-2">
                             <span className="text-gray-500">Saída</span>
                             <span className="text-white font-mono font-bold">{formatCurrency(p.out)}</span>
                          </div>
                          
                          <div className="flex justify-between pr-2 border-r border-white/5">
                             <span className="text-gray-500">Taxa (10%)</span>
                             <span className="text-red-400 font-mono">{formatCurrency(p.rankingFee)}</span>
                          </div>
                          <div className="flex justify-between pl-2">
                             <span className="text-gray-500">Perf.</span>
                             <span className={`font-mono font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>{formatPercent(p.performanceRatio)}</span>
                          </div>
                      </div>
                   </div>
                 );
               })}

               {/* Mobile Totals Card */}
               <div className="bg-white/5 rounded-lg p-3 border border-white/5 mt-2">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-xs uppercase font-bold text-gray-500">Total Fichas</span>
                     <span className="font-mono text-white">{formatCurrency(totals.totalChips)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-xs uppercase font-bold text-gray-500">Taxa da Casa (10%)</span>
                     <span className="font-mono text-red-400">{formatCurrency(totalCashoutDeclared * 0.10)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                     <span className="text-xs uppercase font-bold text-green-500">Líquido Geral</span>
                     <span className="font-mono font-bold text-green-400">{formatCurrency(totalCashoutDeclared * 0.90)}</span>
                  </div>
               </div>
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-gray-500 border-b border-white/10 uppercase text-xs">
                  <tr>
                    <th className="py-2 pl-2">Pos</th>
                    <th className="py-2">Jogador</th>
                    <th className="py-2 text-right">Buy-in</th>
                    <th className="py-2 text-right">Taxa Casa</th>
                    <th className="py-2 text-right">Saída</th>
                    <th className="py-2 text-right text-poker-red">Taxa (10%)</th>
                    <th className="py-2 text-right text-green-400">Líquido</th>
                    <th className="py-2 text-right">Performance (%)</th>
                    <th className="py-2 text-center pr-2">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rankedPlayers.map((p, idx) => {
                    const isPositive = p.performanceRatio >= 1; // 100% or more
                    
                    return (
                      <tr key={p.id} className="hover:bg-white/5">
                        <td className="py-3 pl-2 font-bold">{idx + 1}º</td>
                        <td className="py-3 font-medium">{p.name}</td>
                        <td className="py-3 text-right text-gray-400">{formatCurrency(p.investedChips)}</td>
                        <td className="py-3 text-right text-gray-500">{formatCurrency(HOUSE_FEE_FIXED)}</td>
                        <td className="py-3 text-right font-medium text-white">{formatCurrency(p.out)}</td>
                        <td className="py-3 text-right text-red-400">{formatCurrency(p.rankingFee)}</td>
                        <td className="py-3 text-right font-bold text-green-400">{formatCurrency(p.net)}</td>
                        <td className={`py-3 text-right font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                          {formatPercent(p.performanceRatio)}
                        </td>
                        <td className="py-3 text-center font-bold text-yellow-500 pr-2">+{p.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer Totals */}
                <tfoot className="border-t border-white/20 bg-white/5 font-bold">
                  <tr>
                    <td colSpan={2} className="py-3 pl-2 text-right uppercase text-xs text-gray-400">Totais</td>
                    <td className="py-3 text-right">{formatCurrency(totals.totalChips)}</td>
                    <td className="py-3 text-right text-gray-500">{formatCurrency(totals.totalFees)}</td>
                    <td className="py-3 text-right">{formatCurrency(totalCashoutDeclared)}</td>
                    <td className="py-3 text-right text-red-400">{formatCurrency(totalCashoutDeclared * 0.10)}</td>
                    <td className="py-3 text-right text-green-400">{formatCurrency(totalCashoutDeclared * 0.90)}</td>
                    <td className="py-3 text-right"></td>
                    <td className="py-3 text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
         </div>
         
         {/* Reset Confirmation Modal */}
         {showResetModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-[fadeIn_0.2s_ease-out]">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mb-4 mx-auto border border-red-500/20">
                    <AlertTriangle className="text-poker-red" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">Iniciar Nova Partida?</h3>
                  <p className="text-gray-400 text-center text-sm mb-6 leading-relaxed">
                    Tem certeza que deseja encerrar a partida atual e voltar ao início? Todo o progresso não salvo será perdido.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setShowResetModal(false)}>
                      Cancelar
                    </Button>
                    <Button variant="danger" className="flex-1" onClick={confirmResetGame}>
                      Sim, Iniciar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
         )}
      </div>
    );
  }

  // --- Dashboard View ---

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-none !p-1.5 hover:bg-white/10 text-gray-500 hover:text-white mr-1" onClick={handleLogout} title="Sair do Cofre">
             <LogOut size={18} />
          </Button>
          <PokerLogo size={32} />
          <span className="font-bold tracking-wider text-sm hidden sm:inline text-poker-red">POKER CONTROL</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs !px-2" onClick={() => setShowResetModal(true)}>
            <RefreshCcw size={14} />
          </Button>
          <Button variant="primary" className="text-xs" onClick={() => setView('CASHOUT')}>
            <Trophy size={14} /> Encerrar
          </Button>
        </div>
      </header>

      {/* Navegação principal */}
      <div className="flex justify-center mt-4 px-4 overflow-x-auto">
        <div className="bg-white/5 p-1 rounded-lg flex gap-1 border border-white/10 min-w-max">
          <button onClick={() => setView('DASHBOARD')} className={`px-4 py-2 text-sm rounded transition-all ${view === 'DASHBOARD' ? 'bg-poker-red text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Mesa Atual</button>
          <button onClick={() => setView('JOGADORES')} className={`px-4 py-2 text-sm rounded transition-all ${view === 'JOGADORES' ? 'bg-poker-red text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Jogadores</button>
          <button onClick={() => setView('RANKING_GERAL')} className={`px-4 py-2 text-sm rounded transition-all ${view === 'RANKING_GERAL' ? 'bg-poker-red text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Ranking Geral</button>
          <button onClick={() => setView('ESTATISTICAS')} className={`px-4 py-2 text-sm rounded transition-all ${view === 'ESTATISTICAS' ? 'bg-poker-red text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Estatísticas</button>
          <button onClick={() => setView('CAIXA')} className={`px-4 py-2 text-sm rounded transition-all ${view === 'CAIXA' ? 'bg-poker-red text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Caixa</button>
        </div>
      </div>

      <main className="p-4 max-w-4xl mx-auto space-y-6">
        {view === 'DASHBOARD' && (
          <>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 bg-gradient-to-br from-gray-800 to-black border-l-4 border-l-poker-red">
            <div className="text-xs text-gray-400 uppercase tracking-wide">Fichas em Jogo</div>
            <div className="text-xl font-bold text-white">{formatCurrency(totals.totalChips)}</div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-gray-800 to-black border-l-4 border-l-gray-500">
            <div className="text-xs text-gray-400 uppercase tracking-wide">Taxa da Casa</div>
            <div className="text-xl font-bold text-gray-300">{formatCurrency(totals.totalFees)}</div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-gray-800 to-black">
             <div className="text-xs text-gray-400 uppercase tracking-wide">Buy-ins Totais</div>
             <div className="text-xl font-bold">{formatCurrency(totals.totalBuyIns)}</div>
          </Card>
          <Card className="p-3 bg-gradient-to-br from-gray-800 to-black">
             <div className="text-xs text-gray-400 uppercase tracking-wide">Rebuys Totais</div>
             <div className="text-xl font-bold">{formatCurrency(totals.totalRebuys)}</div>
          </Card>
        </div>

        {/* Financial Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold uppercase text-white/80">Jogadores ({validPlayers.length})</h3>
               <div className="text-xs text-right">
                 <span className="text-green-400 mr-2">Pago: {formatCurrency(totals.totalPaid)}</span>
                 <span className="text-red-500">Pendente: {formatCurrency(totals.totalPending)}</span>
               </div>
            </div>
            
            {/* Player List Inlined */}
            <div className="grid grid-cols-1 gap-3">
              {/* Filtered list rendering */}
              {validPlayers.map(player => {
                // Invested logic for list: (BuyIn - 10) + Rebuys
                const buyInChips = gameState.config.buyInAmount - HOUSE_FEE_FIXED;
                const investedChips = buyInChips + player.rebuys.reduce((sum, r) => sum + r.amount, 0);

                // Payment Status Logic
                const paidCash = (player.buyInStatus === 'PAID' ? gameState.config.buyInAmount : 0) + 
                                player.rebuys.reduce((sum, r) => r.status === 'PAID' ? sum + r.amount : sum, 0);
                const totalCostCash = gameState.config.buyInAmount + player.rebuys.reduce((sum, r) => sum + r.amount, 0);
                const pendingCash = totalCostCash - paidCash;

                return (
                  <div key={player.id} 
                      onClick={() => { setSelectedPlayerId(player.id); setView('PLAYER_DETAIL'); }}
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center border border-white/10 text-lg font-bold">
                        {player.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white group-hover:text-poker-red transition-colors">{player.name}</h4>
                        <div className="flex gap-2 text-xs">
                          <span className={pendingCash > 0 ? "text-red-400" : "text-green-400"}>
                            {pendingCash > 0 ? `Pendente: ${formatCurrency(pendingCash)}` : "Pago"}
                          </span>
                          {player.rebuys.length > 0 && <span className="text-gray-500">• {player.rebuys.length} Rebuys</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 uppercase mr-1">Buy-in</div>
                      <div className="text-sm font-bold text-gray-200 inline">{formatCurrency(investedChips)}</div>
                      <ArrowRight size={16} className="text-gray-600 inline ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}

              {/* Empty State Message - Now uses validPlayers to check length */}
              {validPlayers.length === 0 && (
                <div className="text-center py-6 text-gray-500 border border-dashed border-white/10 rounded-lg">
                  <Users size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum jogador na mesa</p>
                </div>
              )}
              
              {/* Quick Add Player Input */}
              <div className="flex gap-2 mt-2">
                <select 
                  className="flex-1 bg-black/50 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-poker-red transition-colors appearance-none"
                  value={newPlayerName} 
                  onChange={(e) => setNewPlayerName(e.target.value)}
                >
                  <option value="">Selecione um jogador...</option>
                  {registeredPlayers
                    .filter(p => !gameState.players.some(gp => gp.name === p.nome))
                    .map(p => (
                      <option key={p.id} value={p.nome}>{p.nome}</option>
                    ))}
                </select>
                <Button onClick={addPlayer} variant="secondary"><Plus size={20} /></Button>
              </div>
            </div>

          </div>

          <div className="md:col-span-1 space-y-4">
             {/* Dynamic Status Card: Shows Pending Payments Table if there are debtors, otherwise shows Distribution Chart */}
             {debtors.length > 0 ? (
                <Card title="Pagamentos Pendentes" className="h-64 relative" noPadding>
                   <div className="flex flex-col h-full relative">
                       <div className="absolute top-3 right-3 z-10">
                          <div className="w-2 h-2 rounded-full bg-poker-red animate-pulse"></div>
                       </div>
                       
                       <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
                         <table className="w-full text-sm">
                           <tbody className="divide-y divide-white/10">
                             {debtors.map(d => (
                               <tr key={d.id} 
                                   className="hover:bg-white/5 cursor-pointer transition-colors"
                                   onClick={() => { setSelectedPlayerId(d.id); setView('PLAYER_DETAIL'); }}
                               >
                                 <td className="py-3 pl-2 flex items-center gap-2">
                                   <div className="w-1.5 h-1.5 rounded-full bg-red-500/50"></div>
                                   <span className="text-gray-300 font-medium">{d.name}</span>
                                 </td>
                                 <td className="py-3 pr-2 text-right text-red-500 font-bold tracking-wide">
                                   {formatCurrency(d.pending)}
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                       
                       <div className="p-3 bg-white/5 border-t border-white/10 flex justify-between items-center text-xs shrink-0">
                          <span className="text-gray-500 uppercase font-bold">Total a receber</span>
                          <span className="font-bold text-red-500 text-sm">{formatCurrency(debtors.reduce((a,b) => a + b.pending, 0))}</span>
                       </div>
                   </div>
                </Card>
             ) : (
                 <Card title="Distribuição" className="h-64" noPadding>
                    {validPlayers.length > 0 ? (
                        <div className="flex flex-col justify-center h-full px-6 space-y-6">
                            {/* Chips Section */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Fichas em Jogo</span>
                                    <div className="text-right">
                                        <span className="text-white font-bold text-lg">{formatCurrency(totals.totalChips)}</span>
                                        <span className="text-xs text-gray-500 ml-2">({formatPercent(totals.totalChips / (totals.totalChips + totals.totalFees))})</span>
                                    </div>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                                    <div 
                                        className="bg-gradient-to-r from-poker-red to-red-600 h-full rounded-full shadow-[0_0_10px_rgba(208,2,27,0.4)]" 
                                        style={{ width: `${(totals.totalChips / (totals.totalChips + totals.totalFees)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Fees Section */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Taxa da Casa</span>
                                    <div className="text-right">
                                        <span className="text-gray-300 font-bold text-lg">{formatCurrency(totals.totalFees)}</span>
                                        <span className="text-xs text-gray-500 ml-2">({formatPercent(totals.totalFees / (totals.totalChips + totals.totalFees))})</span>
                                    </div>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                                    <div 
                                        className="bg-gray-600 h-full rounded-full" 
                                        style={{ width: `${(totals.totalFees / (totals.totalChips + totals.totalFees)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                            <Activity size={32} className="opacity-20" />
                            <div className="text-sm italic">Aguardando dados...</div>
                        </div>
                    )}
                 </Card>
             )}

             <Card title="Conferência do Caixa">
                <div className="flex flex-col items-center justify-center py-6">
                   <span className="text-sm text-gray-400 uppercase font-bold tracking-widest mb-2">Total no Banco</span>
                   <span className="text-4xl font-bold text-green-500 tracking-tight">{formatCurrency(totals.totalPaid)}</span>
                </div>
             </Card>
          </div>
        </div>

          </>
        )}
        {view === 'JOGADORES' && (
           <Card className="py-6 border-l-4 border-l-poker-red bg-gradient-to-br from-gray-900 to-black">
              <h2 className="text-xl font-bold mb-4 text-white uppercase px-4 flex items-center gap-2"><Users size={20} className="text-poker-red" /> Cadastro de Jogadores</h2>
              <div className="px-4 flex gap-2 mb-6">
                 <Input 
                   placeholder="Nome do Novo Jogador" 
                   value={newRegistredName} 
                   onChange={(e) => setNewRegistredName(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleRegisterPlayer()}
                 />
                 <Button onClick={handleRegisterPlayer} variant="secondary"><Plus size={20} /></Button>
              </div>
              <div className="px-4">
                 <h3 className="text-sm font-bold text-gray-400 uppercase mb-3 border-b border-white/10 pb-2">Nomes Disponíveis ({registeredPlayers.length})</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {registeredPlayers.map(p => (
                       <div key={p.id} className="bg-white/5 p-3 rounded border border-white/5 flex items-center justify-between gap-3 hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center font-bold text-sm shadow-inner shadow-black/50 text-white shrink-0">
                                {p.nome.charAt(0)}
                             </div>
                             {editingPlayerId === p.id ? (
                                <Input 
                                   autoFocus
                                   value={editingPlayerName} 
                                   onChange={(e) => setEditingPlayerName(e.target.value)}
                                   onKeyDown={(e) => e.key === 'Enter' && handleEditPlayer(p.id)}
                                   className="py-1 px-2 text-sm h-8 w-full min-w-[120px]"
                                />
                             ) : (
                                <span className="font-medium text-gray-200">{p.nome}</span>
                             )}
                          </div>
                          {editingPlayerId === p.id ? (
                             <div className="flex gap-1 shrink-0">
                                <button onClick={() => handleEditPlayer(p.id)} className="p-1 text-green-400 hover:bg-white/10 rounded"><Check size={16} /></button>
                                <button onClick={() => setEditingPlayerId(null)} className="p-1 text-red-400 hover:bg-white/10 rounded"><X size={16} /></button>
                             </div>
                          ) : (
                             <button onClick={() => { setEditingPlayerId(p.id); setEditingPlayerName(p.nome); }} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors shrink-0">
                                <Pencil size={14} />
                             </button>
                          )}
                       </div>
                    ))}
                    {registeredPlayers.length === 0 && (
                        <div className="col-span-full text-center py-6 text-gray-500 italic">
                            Nenhum jogador cadastrado no banco.
                        </div>
                    )}
                 </div>
              </div>
           </Card>
        )}
        
        {view === 'RANKING_GERAL' && (
           <Card id="ranking-geral-card" className="py-6 border-l-4 border-l-yellow-500 bg-gradient-to-br from-gray-900 to-black">
              <div className="px-4 mb-4 flex justify-between items-center border-b border-white/10 pb-2">
                 <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2"><Trophy size={20} className="text-yellow-500" /> Ranking Global</h2>
                 <div className="flex items-center gap-2">
                   {isFetchingHistory && <Activity size={16} className="text-gray-400 animate-spin" />}
                   <Button variant="outline" onClick={handleShareRankingGeral} className="!p-1.5 h-8 text-xs gap-2">
                     <Share2 size={14} /> <span className="hidden sm:inline">Compartilhar</span>
                   </Button>
                 </div>
              </div>
              <div className="overflow-x-auto px-4">
                 <table className="w-full text-sm text-left">
                   <thead className="text-gray-500 border-b border-white/10 uppercase text-xs bg-black/40">
                     <tr>
                       <th className="py-3 pl-4 rounded-tl-lg">Pos</th>
                       <th className="py-3">Jogador</th>
                       <th className="py-3 text-center">Pódios</th>
                       <th className="py-3 text-right pr-4 rounded-tr-lg">Pts</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {rankingData.map((p, idx) => (
                       <tr key={p.nome} className="hover:bg-white/5 transition-colors">
                         <td className="py-3 pl-4 font-bold text-gray-400">{idx + 1}º</td>
                         <td className="py-3 font-medium text-white">{p.nome}</td>
                         <td className="py-3 text-center text-xs space-x-2">
                            {p.firsts > 0 && <span title="1º Lugar">🥇 {p.firsts}</span>}
                            {p.seconds > 0 && <span title="2º Lugar">🥈 {p.seconds}</span>}
                            {p.thirds > 0 && <span title="3º Lugar">🥉 {p.thirds}</span>}
                            {(p.firsts === 0 && p.seconds === 0 && p.thirds === 0) && <span className="text-gray-600">-</span>}
                         </td>
                         <td className="py-3 text-right font-bold text-yellow-500 pr-4">{p.pt}</td>
                       </tr>
                     ))}
                     {rankingData.length === 0 && !isFetchingHistory && (
                        <tr><td colSpan={4} className="text-center py-8 text-gray-500">Nenhum dado encontrado no histórico.</td></tr>
                     )}
                   </tbody>
                 </table>
              </div>
           </Card>
        )}

        {view === 'ESTATISTICAS' && (
           <Card id="stats-card" className="py-6 border-l-4 border-l-blue-400 bg-gradient-to-br from-gray-900 to-black">
              <div className="px-4 mb-4 flex justify-between items-center border-b border-white/10 pb-2">
                 <h2 className="text-xl font-bold text-white uppercase flex items-center gap-2"><Activity size={20} className="text-blue-400" /> Estatísticas Globais</h2>
                 <div className="flex items-center gap-2">
                    {isFetchingHistory && <Activity size={16} className="text-gray-400 animate-spin" />}
                    <Button variant="outline" onClick={handleShareEstatisticas} className="!p-1.5 h-8 text-xs gap-2">
                      <Share2 size={14} /> <span className="hidden sm:inline">Compartilhar</span>
                    </Button>
                 </div>
              </div>
              <div className="overflow-x-auto px-4">
                 <table className="w-full text-sm text-left">
                   <thead className="text-gray-500 border-b border-white/10 uppercase text-xs bg-black/40">
                     <tr>
                       <th className="py-3 pl-4 rounded-tl-lg">Jogador</th>
                       <th className="py-3 text-right">Investido</th>
                       <th className="py-3 text-right">Retorno</th>
                       <th className="py-3 text-right pr-4 rounded-tr-lg">Lucro / Perf.</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {rankingData.map(p => {
                       const lucro = p.out - p.buy;
                       const perf = p.buy > 0 ? ((p.out - p.buy) / p.buy) : 0;
                       return (
                         <tr key={p.nome} className="hover:bg-white/5 transition-colors">
                           <td className="py-3 pl-4 font-medium text-white">{p.nome}</td>
                           <td className="py-3 text-right text-gray-400">{formatCurrency(p.buy)}</td>
                           <td className="py-3 text-right text-white font-medium">{formatCurrency(p.out)}</td>
                           <td className="py-3 text-right pr-4">
                              <div className={`font-bold ${lucro >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(lucro)}</div>
                              <div className={`text-xs ${perf >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatPercent(perf)}</div>
                           </td>
                         </tr>
                       );
                     })}
                     {rankingData.length === 0 && !isFetchingHistory && (
                        <tr><td colSpan={4} className="text-center py-8 text-gray-500">Nenhum histórico para estatísticas.</td></tr>
                     )}
                   </tbody>
                 </table>
              </div>
           </Card>
        )}

        {view === 'CAIXA' && (
           <div className="space-y-6">
              {/* Saldo Líquido */}
              <Card className="p-6 bg-gradient-to-br from-gray-900 to-black text-center">
                 <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                    <DollarSign size={16} /> Saldo Líquido do Clube
                 </h2>
                 {isFetchingCaixa ? (
                    <Activity className="animate-spin text-gray-500 mx-auto" size={24} />
                 ) : (
                    <div className={`text-4xl font-bold tracking-tighter ${
                       caixaData.reduce((acc, c) => c.tipo === 'ENTRADA' ? acc + c.valor : acc - c.valor, 0) >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                       {formatCurrency(caixaData.reduce((acc, c) => c.tipo === 'ENTRADA' ? acc + c.valor : acc - c.valor, 0))}
                    </div>
                 )}
              </Card>

              {/* Formulário de Despesa */}
              <Card title="Nova Transação Opcional" className="border-l-4 border-l-red-600">
                 <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                       <Input 
                          placeholder="Ex: Baralho Novo" 
                          value={newDespesaDesc} 
                          onChange={(e) => setNewDespesaDesc(e.target.value)} 
                       />
                    </div>
                    <div className="w-full sm:w-32">
                       <Input 
                          type="number" 
                          placeholder="Valor R$" 
                          value={newDespesaValor} 
                          onChange={(e) => setNewDespesaValor(e.target.value)} 
                       />
                    </div>
                    <Button onClick={handleAddDespesa} variant="danger" className="shrink-0 flex items-center justify-center gap-2">
                       <Plus size={18} /> Lançar Saída
                    </Button>
                 </div>
                 <p className="text-xs text-gray-500 mt-3">* Entradas (10%) são salvas automaticamente ao Contabilizar Pontos no Cashout.</p>
              </Card>

              {/* Histórico Timeline */}
              <Card title="Histórico do Caixa" className="bg-black border border-white/10" noPadding>
                 <div className="max-h-96 overflow-y-auto custom-scrollbar p-2">
                    {isFetchingCaixa && caixaData.length === 0 ? (
                       <div className="py-8 text-center text-gray-500 flex flex-col items-center"><Activity className="animate-spin mb-2" size={20} /> Carregando...</div>
                    ) : caixaData.length === 0 ? (
                       <div className="py-8 text-center text-gray-600 italic">Nenhuma movimentação registrada.</div>
                    ) : (
                       <div className="flex flex-col space-y-2 p-2">
                          {caixaData.map(item => (
                             <div key={item.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                                <div>
                                   <div className="text-sm font-bold text-white mb-1">{item.descricao}</div>
                                   <div className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString('pt-BR')}</div>
                                </div>
                                <div className={`font-mono font-bold ${item.tipo === 'ENTRADA' ? 'text-green-500' : 'text-red-500'}`}>
                                   {item.tipo === 'ENTRADA' ? '+' : '- '} {formatCurrency(item.valor)}
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              </Card>
           </div>
        )}

        {/* Global Reset Modal for Dashboard */}
        {showResetModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all animate-[fadeIn_0.2s_ease-out]">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mb-4 mx-auto border border-red-500/20">
                    <AlertTriangle className="text-poker-red" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">Iniciar Nova Partida?</h3>
                  <p className="text-gray-400 text-center text-sm mb-6 leading-relaxed">
                    Tem certeza que deseja encerrar a partida atual e voltar ao início? Todo o progresso não salvo será perdido.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setShowResetModal(false)}>
                      Cancelar
                    </Button>
                    <Button variant="danger" className="flex-1" onClick={confirmResetGame}>
                      Sim, Iniciar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
         )}

      </main>
    </div>
  );
}