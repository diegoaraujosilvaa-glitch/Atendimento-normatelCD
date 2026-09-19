import React, { useState, useEffect, useMemo } from 'react';
import { PrismaEntry, PrismaClientType, PrismaTargetConfig, User, Ticket } from '../types';
import DataService from '../services/dataService';

interface PrismaModuleProps {
  sessionDate: string;
  currentUser: User | null;
  tickets?: Ticket[];
}

const VEHICLE_TYPES = [
  { label: 'Veículo de Passeio', icon: 'fa-car' },
  { label: 'Pickup / Fiorino', icon: 'fa-truck-pickup' },
  { label: 'Van / Utilitário', icon: 'fa-van-shuttle' },
  { label: 'Caminhão Toco (3/4)', icon: 'fa-truck' },
  { label: 'Caminhão Truck', icon: 'fa-truck-moving' },
  { label: 'Carreta / Bitrem', icon: 'fa-trailer' },
  { label: 'Motocicleta', icon: 'fa-motorcycle' },
];

const PROBLEM_SUGGESTIONS = [
  'Demora na separação de itens no CD',
  'Atraso no carregamento e estiva da carga',
  'Divergência na conferência da mercadoria',
  'Aguardando faturamento / emissão de NF',
  'Liberação pendente do setor financeiro',
  'Veículo com avaria mecânica no pátio',
  'Fila nos boxes de expedição',
  'Outro motivo'
];

const PrismaModule: React.FC<PrismaModuleProps> = ({ sessionDate, currentUser, tickets = [] }) => {
  const [entries, setEntries] = useState<PrismaEntry[]>([]);
  const [targets, setTargets] = useState<PrismaTargetConfig>({
    clientTargetMinutes: 45,
    freightTargetMinutes: 90
  });

  // Formulário de Entrada
  const [clientType, setClientType] = useState<PrismaClientType>('CLIENTE');
  const [plate, setPlate] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [vehicleType, setVehicleType] = useState(VEHICLE_TYPES[0].label);
  const [driverName, setDriverName] = useState('');
  const [initialObservation, setInitialObservation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modais
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [tempClientTarget, setTempClientTarget] = useState(45);
  const [tempFreightTarget, setTempFreightTarget] = useState(90);

  const [completingEntry, setCompletingEntry] = useState<PrismaEntry | null>(null);
  const [exitJustification, setExitJustification] = useState('');
  const [customJustification, setCustomJustification] = useState('');

  // Filtros da tabela
  const [activeTab, setActiveTab] = useState<'IN_CD' | 'COMPLETED' | 'BREACHED' | 'ALL'>('IN_CD');
  const [searchQuery, setSearchQuery] = useState('');

  // Contador de tempo vivo (atualiza a cada 30 segundos para o pátio)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Escuta registros do PRISMA no Firestore
  useEffect(() => {
    if (!sessionDate) return;
    const unsub = DataService.subscribePrismaEntries(sessionDate, (items) => {
      setEntries(items);
    });
    return () => unsub();
  }, [sessionDate]);

  // Escuta configuração de metas
  useEffect(() => {
    const unsub = DataService.subscribePrismaTargets((cfg) => {
      setTargets(cfg);
      setTempClientTarget(cfg.clientTargetMinutes);
      setTempFreightTarget(cfg.freightTargetMinutes);
    });
    return () => unsub();
  }, []);

  // Formatação de placa (ex: ABC-1234 ou BRA2E19)
  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 7) val = val.slice(0, 7);
    if (val.length >= 4 && !val.includes('-') && /^[A-Z]{3}[0-9]/.test(val)) {
      // Padrão antigo ou Mercosul
      if (/^[A-Z]{3}[0-9]{4}$/.test(val)) {
        val = `${val.slice(0, 3)}-${val.slice(3)}`;
      }
    }
    setPlate(val);
  };

  // Sugestões de pedidos da Recepção
  const orderSuggestions = useMemo(() => {
    if (!orderNumber || orderNumber.length < 2) return [];
    return tickets.filter(t => 
      t.orderNumber?.toLowerCase().includes(orderNumber.toLowerCase())
    ).slice(0, 5);
  }, [orderNumber, tickets]);

  const selectSuggestedOrder = (t: Ticket) => {
    setOrderNumber(t.orderNumber);
    if (t.customerName) setDriverName(t.customerName);
    if (t.clientType === 'Frete') setClientType('FRETE');
    else setClientType('CLIENTE');
  };

  // Submissão da entrada no portão
  const handleRegisterEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !orderNumber.trim()) {
      alert("Por favor, informe a Placa do veículo e o Número do pedido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const target = clientType === 'CLIENTE' ? targets.clientTargetMinutes : targets.freightTargetMinutes;
      await DataService.addPrismaEntry(sessionDate, {
        sessionDate,
        clientType,
        plate: plate.trim().toUpperCase(),
        orderNumber: orderNumber.trim(),
        vehicleType,
        driverName: driverName.trim() || undefined,
        targetMinutes: target,
        problemJustification: initialObservation.trim() || undefined,
        registeredBy: currentUser?.name || 'Portaria'
      });

      // Limpa campos
      setPlate('');
      setOrderNumber('');
      setDriverName('');
      setInitialObservation('');
    } catch (err) {
      alert("Erro ao registrar entrada. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal para finalizar saída
  const openExitModal = (entry: PrismaEntry) => {
    setCompletingEntry(entry);
    setExitJustification('');
    setCustomJustification('');
  };

  // Confirmar saída
  const handleConfirmExit = async () => {
    if (!completingEntry) return;

    let finalJustification = exitJustification;
    if (exitJustification === 'Outro motivo') {
      finalJustification = customJustification.trim() || 'Desvio registrado pela portaria';
    } else if (customJustification.trim()) {
      finalJustification = finalJustification ? `${finalJustification} - ${customJustification.trim()}` : customJustification.trim();
    }

    try {
      await DataService.completePrismaExit(completingEntry, finalJustification);
      setCompletingEntry(null);
    } catch (err) {
      alert("Erro ao registrar saída.");
    }
  };

  // Salvar metas
  const handleSaveTargets = async () => {
    if (tempClientTarget < 5 || tempFreightTarget < 5) {
      alert("As metas devem ter pelo menos 5 minutos.");
      return;
    }
    await DataService.savePrismaTargets({
      clientTargetMinutes: Number(tempClientTarget),
      freightTargetMinutes: Number(tempFreightTarget)
    });
    setIsTargetModalOpen(false);
  };

  // Cálculos Estatísticos
  const stats = useMemo(() => {
    const total = entries.length;
    const activeInCd = entries.filter(e => e.status === 'IN_CD');
    const completed = entries.filter(e => e.status === 'COMPLETED');

    const completedClients = completed.filter(e => e.clientType === 'CLIENTE');
    const completedFreight = completed.filter(e => e.clientType === 'FRETE');

    // Tempo médio geral dos concluídos
    const totalDuration = completed.reduce((acc, e) => acc + (e.durationMinutes || 0), 0);
    const avgDurationGeneral = completed.length > 0 ? Math.round(totalDuration / completed.length) : 0;

    // Tempo médio Clientes
    const clientDuration = completedClients.reduce((acc, e) => acc + (e.durationMinutes || 0), 0);
    const avgDurationClient = completedClients.length > 0 ? Math.round(clientDuration / completedClients.length) : 0;

    // Tempo médio Frete
    const freightDuration = completedFreight.reduce((acc, e) => acc + (e.durationMinutes || 0), 0);
    const avgDurationFreight = completedFreight.length > 0 ? Math.round(freightDuration / completedFreight.length) : 0;

    // Percentual atendido dentro do prazo (SLA)
    const withinTargetCount = completed.filter(e => e.withinTarget).length;
    const slaPercentGeneral = completed.length > 0 ? Math.round((withinTargetCount / completed.length) * 100) : 100;

    // SLA Cliente
    const clientWithinTarget = completedClients.filter(e => e.withinTarget).length;
    const slaPercentClient = completedClients.length > 0 ? Math.round((clientWithinTarget / completedClients.length) * 100) : 100;

    // SLA Frete
    const freightWithinTarget = completedFreight.filter(e => e.withinTarget).length;
    const slaPercentFreight = completedFreight.length > 0 ? Math.round((freightWithinTarget / completedFreight.length) * 100) : 100;

    // Quantidade fora da meta
    const breachedCount = completed.filter(e => !e.withinTarget).length;

    return {
      total,
      activeInCdCount: activeInCd.length,
      completedCount: completed.length,
      avgDurationGeneral,
      avgDurationClient,
      avgDurationFreight,
      slaPercentGeneral,
      slaPercentClient,
      slaPercentFreight,
      withinTargetCount,
      breachedCount,
      activeClients: activeInCd.filter(e => e.clientType === 'CLIENTE').length,
      activeFreight: activeInCd.filter(e => e.clientType === 'FRETE').length,
    };
  }, [entries]);

  // Tempo decorrido para um veículo no pátio
  const getElapsedMinutes = (entryTime: Date | string) => {
    const entryDate = new Date(entryTime);
    return Math.max(1, Math.round((currentTime.getTime() - entryDate.getTime()) / 60000));
  };

  // Filtragem da tabela
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (activeTab === 'IN_CD' && e.status !== 'IN_CD') return false;
      if (activeTab === 'COMPLETED' && e.status !== 'COMPLETED') return false;
      if (activeTab === 'BREACHED') {
        if (e.status === 'COMPLETED' && e.withinTarget) return false;
        if (e.status === 'IN_CD') {
          const elapsed = getElapsedMinutes(e.entryTime);
          if (elapsed <= e.targetMinutes) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPlate = e.plate.toLowerCase().includes(q);
        const matchOrder = e.orderNumber.toLowerCase().includes(q);
        const matchDriver = e.driverName?.toLowerCase().includes(q);
        if (!matchPlate && !matchOrder && !matchDriver) return false;
      }

      return true;
    });
  }, [entries, activeTab, searchQuery, currentTime]);

  // Exportar CSV do PRISMA
  const exportPrismaCSV = () => {
    if (entries.length === 0) {
      alert("Nenhum dado para exportar.");
      return;
    }

    const headers = [
      "Data",
      "Placa",
      "Pedido",
      "Tipo Atendimento",
      "Tipo Veiculo",
      "Motorista/Obs",
      "Hora Entrada",
      "Hora Saida",
      "Tempo Permanencia (min)",
      "Meta Estipulada (min)",
      "Dentro da Meta?",
      "Status",
      "Justificativa/Problema",
      "Operador Portaria"
    ];

    const rows = entries.map(e => {
      const entryFormatted = new Date(e.entryTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const exitFormatted = e.exitTime ? new Date(e.exitTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "No Pátio";
      const duration = e.durationMinutes ?? getElapsedMinutes(e.entryTime);
      const isWithin = e.status === 'COMPLETED' ? (e.withinTarget ? 'SIM' : 'NÃO') : (duration <= e.targetMinutes ? 'NO PRAZO' : 'EXCEDIDO');

      return [
        `"${e.sessionDate}"`,
        `"${e.plate}"`,
        `"${e.orderNumber}"`,
        `"${e.clientType}"`,
        `"${e.vehicleType}"`,
        `"${(e.driverName || '').replace(/"/g, '""')}"`,
        `"${entryFormatted}"`,
        `"${exitFormatted}"`,
        `"${duration}"`,
        `"${e.targetMinutes}"`,
        `"${isWithin}"`,
        `"${e.status === 'IN_CD' ? 'No Pátio' : 'Finalizado'}"`,
        `"${(e.problemJustification || '').replace(/"/g, '""')}"`,
        `"${e.registeredBy || 'Portaria'}"`
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `prisma_permanencia_cd_${sessionDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="bg-white p-3.5 sm:p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#1a1a1a] text-[#e67324] flex items-center justify-center text-base sm:text-xl shadow-md shrink-0">
            <i className="fas fa-warehouse"></i>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base md:text-xl font-black uppercase tracking-tight text-gray-900 truncate">
              PRISMA <span className="text-[#e67324]">•</span> PORTARIA CD
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase truncate mt-0.5">
              Permanência no CD • Portão de Entrada e Saída
            </p>
          </div>
        </div>

        {/* Ações da Portaria */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Botão Catraca de Configuração (Metas de SLA) */}
          <button
            id="btn-prisma-settings"
            onClick={() => setIsTargetModalOpen(true)}
            className="h-9 sm:h-10 px-2.5 sm:px-3.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-800 font-black text-xs rounded-xl transition-all flex items-center gap-2 uppercase tracking-wider border border-gray-300 shadow-xs group"
            title="Catraca de Configuração: Definir Metas de SLA de Permanência (Cliente e Frete)"
            aria-label="Configurar Metas de SLA"
          >
            <i className="fas fa-gear text-sm sm:text-base text-[#e67324] group-hover:rotate-90 transition-transform duration-300"></i>
            <span className="hidden sm:inline">Metas SLA</span>
            <span className="hidden xl:inline text-[9px] font-bold bg-orange-100 text-[#e67324] px-1.5 py-0.5 rounded">
              {targets.clientTargetMinutes}m / {targets.freightTargetMinutes}m
            </span>
          </button>

          {/* Botão Exportar CSV */}
          <button
            id="btn-prisma-export-csv"
            onClick={exportPrismaCSV}
            className="h-9 sm:h-10 px-2.5 sm:px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 uppercase tracking-wider shrink-0"
            title="Exportar planilha CSV da permanência"
            aria-label="Exportar CSV"
          >
            <i className="fas fa-file-csv text-sm sm:text-base"></i>
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* DASHBOARD DE MÉTRICAS & INDICADORES DE PERFORMANCE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {/* Card 1: Veículos no CD Agora */}
        <div className="bg-[#1a1a1a] text-white p-3.5 sm:p-5 md:p-6 rounded-2xl flex justify-between items-center shadow-lg border-b-4 border-[#e67324]">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase text-[#e67324] truncate">No Pátio Agora</p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">{stats.activeInCdCount}</p>
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase mt-1 truncate">
              <span>{stats.activeClients} Cli</span>
              <span>•</span>
              <span>{stats.activeFreight} Fre</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-white/5 flex items-center justify-center text-lg sm:text-2xl text-[#e67324] shrink-0 ml-2">
            <i className="fas fa-truck-ramp-box"></i>
          </div>
        </div>

        {/* Card 2: Saídas Finalizadas */}
        <div className="bg-white border border-gray-200 p-3.5 sm:p-5 md:p-6 rounded-2xl flex justify-between items-center shadow-sm border-b-4 border-emerald-500">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase text-emerald-600 truncate">Saídas Concluídas</p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 mt-0.5">{stats.completedCount}</p>
            <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase mt-1 truncate">
              Total hoje: {stats.total}
            </p>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg sm:text-2xl shrink-0 ml-2">
            <i className="fas fa-circle-check"></i>
          </div>
        </div>

        {/* Card 3: Tempo Médio de Permanência */}
        <div className="bg-white border border-gray-200 p-3.5 sm:p-5 md:p-6 rounded-2xl flex justify-between items-center shadow-sm border-b-4 border-amber-500">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500 truncate">Média Permanência</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <p className="text-2xl sm:text-3xl font-black text-[#e67324] tracking-tight">{stats.avgDurationGeneral}m</p>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-[8px] sm:text-[9px] text-gray-500 font-bold uppercase mt-1">
              <span className="bg-gray-100 px-1 py-0.5 rounded">C:{stats.avgDurationClient}m</span>
              <span className="bg-gray-100 px-1 py-0.5 rounded">F:{stats.avgDurationFreight}m</span>
            </div>
          </div>
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg sm:text-2xl shrink-0 ml-2">
            <i className="fas fa-stopwatch"></i>
          </div>
        </div>

        {/* Card 4: Percentual Atendido Dentro do Prazo (% SLA) */}
        <div className={`bg-white border border-gray-200 p-3.5 sm:p-5 md:p-6 rounded-2xl flex justify-between items-center shadow-sm border-b-4 ${
          stats.slaPercentGeneral >= 85 ? 'border-emerald-500' : stats.slaPercentGeneral >= 70 ? 'border-amber-500' : 'border-red-500'
        }`}>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500 truncate">Dentro do SLA</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <p className={`text-2xl sm:text-3xl font-black tracking-tight ${
                stats.slaPercentGeneral >= 85 ? 'text-emerald-600' : stats.slaPercentGeneral >= 70 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {stats.slaPercentGeneral}%
              </p>
              <span className="text-[9px] font-bold text-gray-400">({stats.withinTargetCount})</span>
            </div>
            <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-bold uppercase mt-1 truncate">
              <span className="text-blue-600">C:{stats.slaPercentClient}%</span>
              <span className="text-gray-300">•</span>
              <span className="text-purple-600">F:{stats.slaPercentFreight}%</span>
            </div>
          </div>
          <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-2xl shrink-0 ml-2 ${
            stats.slaPercentGeneral >= 85 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}>
            <i className="fas fa-gauge-high"></i>
          </div>
        </div>
      </div>

      {/* ÁREA OPERACIONAL DA PORTARIA: LANÇAMENTO DE ENTRADA + VEÍCULOS NO PÁTIO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* COLUNA ESQUERDA: FORMULÁRIO DE ENTRADA DO PORTÃO (4 colunas) */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
              <i className="fas fa-door-open text-[#e67324]"></i> LANÇAMENTO DE ENTRADA (PORTARIA)
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
              Registrar veículo passando pelo portão
            </p>
          </div>

          <form onSubmit={handleRegisterEntry} className="space-y-4">
            {/* TIPO DE CLIENTE: CLIENTE vs FRETE */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5">
                Tipo de Atendimento:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClientType('CLIENTE')}
                  className={`py-3 px-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                    clientType === 'CLIENTE'
                      ? 'bg-[#1a1a1a] text-[#e67324] border-[#1a1a1a] shadow-md'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <i className="fas fa-user"></i> CLIENTE
                </button>
                <button
                  type="button"
                  onClick={() => setClientType('FRETE')}
                  className={`py-3 px-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                    clientType === 'FRETE'
                      ? 'bg-[#e67324] text-white border-[#e67324] shadow-md'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <i className="fas fa-truck-moving"></i> FRETE
                </button>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mt-1.5 px-1">
                <span>Meta aplicada:</span>
                <span className="font-black text-gray-700 uppercase">
                  {clientType === 'CLIENTE' ? `${targets.clientTargetMinutes} minutos` : `${targets.freightTargetMinutes} minutos`}
                </span>
              </div>
            </div>

            {/* PLACA DO VEÍCULO */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5">
                Placa do Veículo:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="EX: ABC1D23 OU ABC-1234"
                  value={plate}
                  onChange={handlePlateChange}
                  maxLength={8}
                  className="w-full p-3 pl-10 border-2 border-gray-200 rounded-xl outline-none focus:border-[#e67324] font-black text-base text-gray-800 uppercase tracking-wider bg-gray-50 focus:bg-white transition-all font-mono"
                  required
                />
                <i className="fas fa-id-card text-gray-400 absolute left-3.5 top-4 text-sm"></i>
              </div>
            </div>

            {/* NÚMERO DO PEDIDO */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5">
                Número do Pedido:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Número do pedido..."
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full p-3 pl-10 border-2 border-gray-200 rounded-xl outline-none focus:border-[#e67324] font-black text-sm text-gray-800 uppercase bg-gray-50 focus:bg-white transition-all"
                  required
                />
                <i className="fas fa-receipt text-gray-400 absolute left-3.5 top-4 text-sm"></i>
              </div>

              {/* Sugestões de pedidos da Recepção */}
              {orderSuggestions.length > 0 && (
                <div className="mt-1.5 p-2 bg-orange-50/70 border border-orange-200 rounded-xl space-y-1">
                  <p className="text-[9px] font-black text-[#e67324] uppercase tracking-wider">
                    <i className="fas fa-bolt mr-1"></i> Pedidos encontrados na Recepção hoje:
                  </p>
                  {orderSuggestions.map(sug => (
                    <button
                      key={sug.id}
                      type="button"
                      onClick={() => selectSuggestedOrder(sug)}
                      className="w-full text-left p-1.5 hover:bg-white rounded-lg text-xs flex justify-between items-center transition-colors"
                    >
                      <span className="font-black text-gray-800">#{sug.orderNumber} - {sug.customerName}</span>
                      <span className="text-[9px] font-bold text-[#e67324] uppercase bg-white px-1.5 py-0.5 rounded border border-orange-100">
                        {sug.password}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* TIPO DE VEÍCULO */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5">
                Tipo de Veículo:
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-xl outline-none focus:border-[#e67324] font-bold text-xs text-gray-800 uppercase bg-gray-50 focus:bg-white transition-all cursor-pointer"
              >
                {VEHICLE_TYPES.map(vt => (
                  <option key={vt.label} value={vt.label}>
                    {vt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* MOTORISTA / TRANSPORTADORA (OPCIONAL) */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5">
                Motorista / Transportadora (Opcional):
              </label>
              <input
                type="text"
                placeholder="Nome do condutor..."
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#e67324] font-bold text-xs text-gray-800 uppercase bg-gray-50 focus:bg-white transition-all"
              />
            </div>

            {/* OBSERVAÇÃO INICIAL */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5">
                Observação de Entrada (Opcional):
              </label>
              <input
                type="text"
                placeholder="Ex: Carga frágil, box 02..."
                value={initialObservation}
                onChange={(e) => setInitialObservation(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:border-[#e67324] font-bold text-xs text-gray-800 uppercase bg-gray-50 focus:bg-white transition-all"
              />
            </div>

            {/* BOTÃO REGISTRAR ENTRADA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-[#1a1a1a] hover:bg-[#e67324] text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> REGISTRANDO...
                </>
              ) : (
                <>
                  <i className="fas fa-right-to-bracket text-[#e67324] group-hover:text-white"></i> REGISTRAR ENTRADA NO PORTÃO
                </>
              )}
            </button>
          </form>
        </div>

        {/* COLUNA DIREITA: VEÍCULOS NO PÁTIO AGORA COM CRONÔMETRO (8 colunas) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                  <i className="fas fa-truck-moving text-[#e67324]"></i> PÁTIO DO CD EM TEMPO REAL
                  <span className="bg-orange-100 text-[#e67324] text-[10px] font-black px-2 py-0.5 rounded-full">
                    {stats.activeInCdCount} no CD
                  </span>
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                  Monitoramento contínuo de permanência e conformidade de prazo
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Tempo real ativo
                </span>
              </div>
            </div>

            {/* GRID DE VEÍCULOS ATIVOS NO PÁTIO */}
            {stats.activeInCdCount > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entries.filter(e => e.status === 'IN_CD').map(entry => {
                  const elapsedMinutes = getElapsedMinutes(entry.entryTime);
                  const isBreached = elapsedMinutes > entry.targetMinutes;
                  const isWarning = !isBreached && elapsedMinutes >= (entry.targetMinutes * 0.75);

                  return (
                    <div 
                      key={entry.id} 
                      className={`p-5 rounded-2xl border-2 transition-all flex flex-col justify-between relative overflow-hidden shadow-sm ${
                        isBreached 
                          ? 'border-red-400 bg-red-50/40' 
                          : isWarning 
                          ? 'border-amber-400 bg-amber-50/30' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {/* Faixa lateral indicadora */}
                      <div className={`absolute top-0 left-0 bottom-0 w-2 ${
                        isBreached ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}></div>

                      <div className="pl-2">
                        {/* Linha superior: Placa e Tipo */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="bg-[#1a1a1a] text-white px-3 py-1 rounded-lg font-mono font-black text-sm tracking-wider shadow-sm border border-gray-700">
                            {entry.plate}
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                            entry.clientType === 'FRETE'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}>
                            {entry.clientType}
                          </span>
                        </div>

                        {/* Dados do Pedido */}
                        <div className="mb-4">
                          <p className="font-extrabold text-sm text-gray-900 leading-tight">
                            Pedido #{entry.orderNumber}
                          </p>
                          {entry.driverName && (
                            <p className="text-[11px] text-gray-600 font-bold uppercase mt-0.5 truncate">
                              Condutor: {entry.driverName}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 flex items-center gap-1">
                            <i className="fas fa-truck text-xs"></i> {entry.vehicleType}
                          </p>
                          {entry.problemJustification && (
                            <p className="text-[10px] text-amber-700 font-bold bg-amber-100/60 p-1.5 rounded-lg mt-2">
                              <i className="fas fa-info-circle mr-1"></i> {entry.problemJustification}
                            </p>
                          )}
                        </div>

                        {/* Cronômetro e Meta */}
                        <div className="bg-white/80 p-3 rounded-xl border border-gray-100 mb-4 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-black uppercase text-gray-400 block">Tempo no Pátio</span>
                            <div className="flex items-center gap-1.5">
                              <i className={`fas fa-stopwatch ${isBreached ? 'text-red-500 animate-bounce' : isWarning ? 'text-amber-500' : 'text-emerald-500'}`}></i>
                              <span className={`text-base font-black tracking-tight ${isBreached ? 'text-red-600' : 'text-gray-900'}`}>
                                {elapsedMinutes} min
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-black uppercase text-gray-400 block">Meta SLA: {entry.targetMinutes}m</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              isBreached 
                                ? 'bg-red-100 text-red-700 font-black animate-pulse' 
                                : isWarning 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {isBreached ? `+${elapsedMinutes - entry.targetMinutes}m excedido` : `Restam ${entry.targetMinutes - elapsedMinutes}m`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botão de Finalizar Saída */}
                      <button
                        onClick={() => openExitModal(entry)}
                        className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow flex items-center justify-center gap-2 ${
                          isBreached 
                            ? 'bg-red-600 hover:bg-red-700 text-white' 
                            : 'bg-[#1a1a1a] hover:bg-[#e67324] text-white'
                        }`}
                      >
                        <i className="fas fa-right-from-bracket"></i> REGISTRAR SAÍDA (PORTÃO)
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto text-gray-300 text-2xl mb-3">
                  <i className="fas fa-warehouse"></i>
                </div>
                <h4 className="font-black text-sm uppercase text-gray-700">Pátio do CD Livre</h4>
                <p className="text-xs text-gray-400 font-bold uppercase mt-1">
                  Nenhum veículo aguardando no pátio no momento. Registre novas entradas pelo formulário ao lado.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO INFERIOR: HISTÓRICO CONSOLIDADO E AUDITORIA */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gray-50 p-5 border-b flex flex-wrap justify-between items-center gap-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2">
              <i className="fas fa-clock-rotate-left text-[#e67324]"></i> HISTÓRICO GERAL DE ENTRADAS & SAÍDAS (PORTARIA)
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
              Auditoria de tempos de permanência e justificativas de desvios
            </p>
          </div>

          {/* Abas e Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Campo de Busca */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar placa ou pedido..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="p-2 pl-7 border rounded-xl text-xs font-bold uppercase bg-white outline-none focus:ring-2 focus:ring-[#e67324] w-48"
              />
              <i className="fas fa-search text-gray-400 absolute left-2.5 top-3 text-[10px]"></i>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                  <i className="fas fa-times-circle text-xs"></i>
                </button>
              )}
            </div>

            {/* Abas de Status */}
            <div className="flex bg-gray-200/80 p-1 rounded-xl text-[10px] font-bold">
              <button
                onClick={() => setActiveTab('IN_CD')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'IN_CD' ? 'bg-white text-gray-900 shadow font-black' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                NO PÁTIO ({stats.activeInCdCount})
              </button>
              <button
                onClick={() => setActiveTab('COMPLETED')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'COMPLETED' ? 'bg-emerald-600 text-white shadow font-black' : 'text-gray-600 hover:text-emerald-700'
                }`}
              >
                SAÍDAS CONCLUÍDAS ({stats.completedCount})
              </button>
              <button
                onClick={() => setActiveTab('BREACHED')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'BREACHED' ? 'bg-red-600 text-white shadow font-black' : 'text-gray-600 hover:text-red-700'
                }`}
              >
                FORA DA META ({stats.breachedCount})
              </button>
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'ALL' ? 'bg-[#1a1a1a] text-white shadow font-black' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                TODOS ({entries.length})
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de registros */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b text-gray-400 font-black uppercase text-[10px]">
              <tr>
                <th className="px-6 py-4">Placa & Veículo</th>
                <th className="px-6 py-4">Pedido / Condutor</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Entrada</th>
                <th className="px-6 py-4">Saída</th>
                <th className="px-6 py-4">Tempo Total</th>
                <th className="px-6 py-4">Status & Meta</th>
                <th className="px-6 py-4">Justificativa / Problema</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEntries.length > 0 ? (
                filteredEntries.map(entry => {
                  const isCompleted = entry.status === 'COMPLETED';
                  const duration = isCompleted ? (entry.durationMinutes || 0) : getElapsedMinutes(entry.entryTime);
                  const isWithin = isCompleted ? entry.withinTarget : duration <= entry.targetMinutes;

                  return (
                    <tr key={entry.id} className={`hover:bg-gray-50/80 transition-colors ${!isWithin ? 'bg-red-50/20' : ''}`}>
                      {/* Placa & Veículo */}
                      <td className="px-6 py-4">
                        <span className="font-mono font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs border border-gray-200">
                          {entry.plate}
                        </span>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                          {entry.vehicleType}
                        </p>
                      </td>

                      {/* Pedido / Condutor */}
                      <td className="px-6 py-4">
                        <span className="font-black text-gray-900 uppercase">#{entry.orderNumber}</span>
                        {entry.driverName && (
                          <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                            {entry.driverName}
                          </p>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border inline-block ${
                          entry.clientType === 'FRETE'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {entry.clientType}
                        </span>
                      </td>

                      {/* Entrada */}
                      <td className="px-6 py-4 font-mono font-bold text-gray-700">
                        {new Date(entry.entryTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Saída */}
                      <td className="px-6 py-4 font-mono font-bold">
                        {entry.exitTime ? (
                          <span className="text-gray-900">
                            {new Date(entry.exitTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-black uppercase text-[10px] bg-amber-50 px-2 py-0.5 rounded">
                            No Pátio
                          </span>
                        )}
                      </td>

                      {/* Tempo Total */}
                      <td className="px-6 py-4">
                        <span className={`font-black text-sm ${isWithin ? 'text-gray-900' : 'text-red-600'}`}>
                          {duration} min
                        </span>
                        <span className="text-[9px] text-gray-400 font-bold block uppercase">
                          Meta: {entry.targetMinutes}m
                        </span>
                      </td>

                      {/* Status & Meta */}
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded inline-block ${
                          isCompleted
                            ? isWithin 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-red-100 text-red-800 border border-red-200'
                            : isWithin
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800 border border-red-200 animate-pulse'
                        }`}>
                          {isCompleted 
                            ? (isWithin ? 'Dentro da Meta' : 'Meta Excedida') 
                            : (isWithin ? 'Em Andamento' : 'Atrasado no CD')}
                        </span>
                      </td>

                      {/* Justificativa / Problema */}
                      <td className="px-6 py-4 max-w-xs">
                        {entry.problemJustification ? (
                          <div className="text-[11px] text-red-700 font-bold bg-red-50 p-2 rounded-lg border border-red-100 flex items-start gap-1.5">
                            <i className="fas fa-triangle-exclamation text-red-500 mt-0.5"></i>
                            <span>{entry.problemJustification}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[10px]">Sem ocorrências</span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="px-6 py-4 text-right">
                        {!isCompleted ? (
                          <button
                            onClick={() => openExitModal(entry)}
                            className="bg-[#1a1a1a] hover:bg-[#e67324] text-white px-3 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all shadow-sm"
                          >
                            Saída
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm("Remover este registro de permanência?")) {
                                DataService.deletePrismaEntry(entry.id);
                              }
                            }}
                            className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                            title="Excluir registro"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400 font-bold uppercase tracking-wider">
                    Nenhum registro encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REGISTRAR SAÍDA E JUSTIFICATIVA */}
      {completingEntry && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4 text-[#e67324]">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-lg font-black">
                <i className="fas fa-right-from-bracket"></i>
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-900">
                  Finalizar Saída pelo Portão
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase">
                  Módulo PRISMA • Controle de Permanência
                </p>
              </div>
            </div>

            {/* Resumo do Veículo */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100 space-y-2">
              <div className="flex justify-between items-center">
                <div className="bg-[#1a1a1a] text-white px-3 py-1 rounded-lg font-mono font-black text-sm">
                  {completingEntry.plate}
                </div>
                <span className="text-xs font-black uppercase text-[#e67324]">
                  Pedido #{completingEntry.orderNumber}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-600 pt-1">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">Tipo:</span>
                  <span className="uppercase">{completingEntry.clientType} • {completingEntry.vehicleType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase block">Entrada:</span>
                  <span>{new Date(completingEntry.entryTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Cálculo do tempo decorrido */}
              <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-gray-700">Tempo de Permanência:</span>
                <span className="text-base font-black text-[#e67324]">
                  {getElapsedMinutes(completingEntry.entryTime)} minutos
                </span>
              </div>

              {/* Status da Meta */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase">Meta de Tempo ({completingEntry.clientType}):</span>
                <span className={`font-black uppercase px-2 py-0.5 rounded ${
                  getElapsedMinutes(completingEntry.entryTime) <= completingEntry.targetMinutes
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {getElapsedMinutes(completingEntry.entryTime) <= completingEntry.targetMinutes
                    ? 'Dentro da Meta'
                    : `Excedeu em ${getElapsedMinutes(completingEntry.entryTime) - completingEntry.targetMinutes} min`}
                </span>
              </div>
            </div>

            {/* SEÇÃO DE JUSTIFICATIVA (SE HOUVE PROBLEMA OU ATRASO) */}
            <div className="space-y-3 mb-6">
              <label className="text-[11px] font-black uppercase text-gray-800 flex items-center justify-between">
                <span>Justificativa de Problemas / Desvios (Opcional):</span>
                {getElapsedMinutes(completingEntry.entryTime) > completingEntry.targetMinutes && (
                  <span className="text-red-600 text-[10px] font-black uppercase animate-pulse">
                    <i className="fas fa-triangle-exclamation"></i> Tempo Excedido
                  </span>
                )}
              </label>

              <div className="space-y-1.5">
                {PROBLEM_SUGGESTIONS.map(sug => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setExitJustification(sug)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      exitJustification === sug
                        ? 'border-[#e67324] bg-orange-50/60 text-gray-900 font-black'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <i className={`fas fa-check-circle mr-2 ${exitJustification === sug ? 'text-[#e67324]' : 'text-gray-300'}`}></i>
                    {sug}
                  </button>
                ))}
              </div>

              {/* Campo para detalhamento ou motivo customizado */}
              <textarea
                placeholder="Observações complementares da portaria..."
                value={customJustification}
                onChange={(e) => setCustomJustification(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-xl outline-none text-xs font-bold focus:border-[#e67324] uppercase mt-2 h-20 resize-none bg-gray-50 focus:bg-white"
              ></textarea>
            </div>

            {/* Ações */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCompletingEntry(null)}
                className="py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 hover:bg-gray-100 font-black uppercase text-xs transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmExit}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-check"></i> Confirmar Saída
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAÇÃO DE METAS DE PERMANÊNCIA (SLA) */}
      {isTargetModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 mb-4 text-[#e67324]">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-lg font-black">
                <i className="fas fa-gear text-[#e67324]"></i>
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-900">
                  Catraca de Configuração • Metas SLA
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase">
                  Parâmetros de Permanência na Portaria do CD
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {/* Meta Cliente */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <label className="text-[11px] font-black uppercase text-gray-800 block mb-1">
                  Meta de Tempo: Tipo CLIENTE (minutos)
                </label>
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">
                  Tempo padrão máximo de permanência para retirada por clientes
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={5}
                    max={360}
                    value={tempClientTarget}
                    onChange={(e) => setTempClientTarget(Number(e.target.value))}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl outline-none focus:border-[#e67324] font-black text-lg text-gray-900 bg-white"
                  />
                  <span className="font-black text-sm text-gray-500 uppercase">Min</span>
                </div>
              </div>

              {/* Meta Frete */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <label className="text-[11px] font-black uppercase text-gray-800 block mb-1">
                  Meta de Tempo: Tipo FRETE (minutos)
                </label>
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">
                  Tempo padrão máximo para carregamentos de fretes e carretas
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={tempFreightTarget}
                    onChange={(e) => setTempFreightTarget(Number(e.target.value))}
                    className="w-full p-3 border-2 border-gray-200 rounded-xl outline-none focus:border-[#e67324] font-black text-lg text-gray-900 bg-white"
                  />
                  <span className="font-black text-sm text-gray-500 uppercase">Min</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-[10px] text-amber-800 font-bold flex items-start gap-2">
              <i className="fas fa-info-circle text-amber-600 mt-0.5"></i>
              <span>Essas metas serão salvas no sistema e usadas para calcular o percentual de atendimento dentro do prazo na portaria.</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsTargetModalOpen(false)}
                className="py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 hover:bg-gray-100 font-black uppercase text-xs transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTargets}
                className="py-3 px-4 rounded-xl bg-[#e67324] hover:bg-orange-600 text-white font-black uppercase text-xs shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-save"></i> Salvar Metas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrismaModule;
