"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Appointment = {
  id: string; firstName: string; lastName: string; whatsapp: string; serviceName: string; serviceDuration: number;
  date: string; time: string; totalCents: number; paymentAmountCents: number; paymentType: string;
  paymentStatus: string; status: string; expiresAt: string | null; createdAt: string;
};
type Service = { id: string; name: string; description: string; duration: number; priceCents: number; image: string; active: boolean; sortOrder: number };
type Block = { id: string; date: string; time: string; reason: string };
type Dashboard = { appointments: Appointment[]; services: Service[]; blocks: Block[]; settings: Record<string, string> };

const emptyDashboard: Dashboard = { appointments: [], services: [], blocks: [], settings: {} };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const longDate = (date: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
const phoneLabel = (value: string) => { const digits = value.replace(/\D/g, "").slice(-11); return digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : value; };
const statusLabel: Record<string, string> = { aguardando_pagamento: "Aguardando PIX", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado", pendente: "Pendente", sinal_pago: "Sinal pago", pago: "Pago", dispensado: "Sem cobrança" };
const timeOptions = Array.from({ length: 40 }, (_, index) => { const minute = 9 * 60 + index * 15; return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`; });

function resizeServiceImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return Promise.reject(new Error("Escolha uma foto JPG, PNG ou WebP."));
  if (file.size > 8 * 1024 * 1024) return Promise.reject(new Error("A foto deve ter no máximo 8 MB."));
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler esta foto."));
    reader.onload = () => {
      const photo = new window.Image();
      photo.onerror = () => reject(new Error("Não foi possível abrir esta foto."));
      photo.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 900; canvas.height = 600;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Não foi possível preparar esta foto."));
        const scale = Math.max(canvas.width / photo.width, canvas.height / photo.height);
        const width = photo.width * scale; const height = photo.height * scale;
        context.drawImage(photo, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        const result = canvas.toDataURL("image/jpeg", 0.76);
        if (result.length > 550_000) return reject(new Error("A foto ficou muito grande. Escolha outra imagem."));
        resolve(result);
      };
      photo.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [data, setData] = useState<Dashboard>(emptyDashboard);
  const [tab, setTab] = useState<"agenda" | "services" | "availability" | "payment">("agenda");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [agendaDate, setAgendaDate] = useState(() => isoDate(new Date()));
  const [serviceForm, setServiceForm] = useState({ id: "", name: "", description: "", duration: "45", price: "45,00", image: "" });
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [agendaAction, setAgendaAction] = useState<"appointment" | "block" | null>(null);
  const [manualForm, setManualForm] = useState({ firstName: "", lastName: "", whatsapp: "", serviceId: "", time: "09:00" });
  const [quickBlockForm, setQuickBlockForm] = useState({ time: "09:00", reason: "" });
  const [blockForm, setBlockForm] = useState({ date: isoDate(new Date()), time: "09:00", reason: "" });
  const [paymentForm, setPaymentForm] = useState({ depositPercent: "30", pixKey: "" });

  const loadDashboard = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (response.status === 401) { setAuthenticated(false); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar o painel.");
      setData(body); setPaymentForm({ depositPercent: body.settings.depositPercent || "30", pixKey: body.settings.pixKey || "" });
      setManualForm((current) => ({ ...current, serviceId: current.serviceId || body.services.find((service: Service) => service.active)?.id || "" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar o painel."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" }).then((response) => response.json()).then((body) => {
      setAuthenticated(Boolean(body.authenticated));
      if (body.authenticated) loadDashboard();
    }).catch(() => setAuthenticated(false));
  }, [loadDashboard]);

  const agenda = useMemo(() => data.appointments.filter((item) => item.date === agendaDate).sort((a, b) => a.time.localeCompare(b.time)), [agendaDate, data.appointments]);
  const activeAgenda = agenda.filter((item) => ["confirmado", "concluido"].includes(item.status));
  const pendingAgenda = agenda.filter((item) => item.status === "aguardando_pagamento");
  const dayBlocks = data.blocks.filter((item) => item.date === agendaDate).sort((a, b) => a.time.localeCompare(b.time));
  const today = isoDate(new Date());
  const todayAppointments = data.appointments.filter((item) => item.date === today && ["confirmado", "concluido"].includes(item.status));
  const pendingPayments = data.appointments.filter((item) => item.status === "aguardando_pagamento").length;
  const todayRevenue = todayAppointments.reduce((sum, item) => {
    if (item.status === "concluido") return sum + item.totalCents;
    if (!["pendente", "dispensado"].includes(item.paymentStatus)) return sum + item.paymentAmountCents;
    return sum;
  }, 0);

  async function login(event: FormEvent) {
    event.preventDefault(); setLoggingIn(true); setLoginError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível entrar.");
      setAuthenticated(true); setPassword(""); await loadDashboard();
    } catch (reason) { setLoginError(reason instanceof Error ? reason.message : "Não foi possível entrar."); }
    finally { setLoggingIn(false); }
  }

  async function action(payload: Record<string, unknown>, success: string) {
    setError(""); setMessage("");
    const response = await fetch("/api/admin/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (response.status === 401) { setAuthenticated(false); return false; }
    if (!response.ok) { setError(body.error || "Não foi possível salvar."); return false; }
    setMessage(success); await loadDashboard(); return true;
  }

  async function saveService(event: FormEvent) {
    event.preventDefault();
    const priceCents = Math.round(Number(serviceForm.price.replace(".", "").replace(",", ".")) * 100);
    const ok = await action({ action: serviceForm.id ? "updateService" : "createService", id: serviceForm.id, name: serviceForm.name, description: serviceForm.description, duration: Number(serviceForm.duration), priceCents, image: serviceForm.image }, serviceForm.id ? "Serviço atualizado." : "Serviço adicionado.");
    if (ok) { setShowServiceForm(false); setServiceForm({ id: "", name: "", description: "", duration: "45", price: "45,00", image: "" }); }
  }

  async function handleServiceImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessingImage(true); setError("");
    try {
      const image = await resizeServiceImage(file);
      setServiceForm((current) => ({ ...current, image }));
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível preparar a foto."); }
    finally { setProcessingImage(false); event.target.value = ""; }
  }

  async function createManualAppointment(event: FormEvent) {
    event.preventDefault();
    const ok = await action({ action: "createAppointment", date: agendaDate, ...manualForm }, "Agendamento adicionado à agenda.");
    if (ok) {
      setAgendaAction(null);
      setManualForm((current) => ({ firstName: "", lastName: "", whatsapp: "", serviceId: current.serviceId, time: "09:00" }));
    }
  }

  async function blockAgendaTime(event: FormEvent) {
    event.preventDefault();
    const ok = await action({ action: "blockSlot", date: agendaDate, ...quickBlockForm }, "Horário bloqueado na agenda.");
    if (ok) { setAgendaAction(null); setQuickBlockForm({ time: "09:00", reason: "" }); }
  }

  function editService(service: Service) {
    setServiceForm({ id: service.id, name: service.name, description: service.description, duration: String(service.duration), price: (service.priceCents / 100).toFixed(2).replace(".", ","), image: service.image || "" });
    setShowServiceForm(true); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" }); setAuthenticated(false); setData(emptyDashboard);
  }

  function shiftDay(amount: number) {
    const value = new Date(`${agendaDate}T12:00:00`); value.setDate(value.getDate() + amount); setAgendaDate(isoDate(value));
  }

  if (authenticated === null) return <main className="admin-loading"><div className="admin-spinner" /><p>Preparando o painel…</p></main>;

  if (!authenticated) {
    return (
      <main className="admin-login-page">
        <div className="admin-login-image"><div><p className="eyebrow"><span /> Barbearia 35</p><h1>Organização que<br /><em>respeita o seu tempo.</em></h1><p>Agenda, serviços e pagamentos em um só lugar.</p></div></div>
        <section className="admin-login-card">
          <a href="/" className="brand"><Image src="/images/logo-barbearia-35.png" alt="" width={62} height={46} priority /><span><b>BARBEARIA</b><strong>35</strong></span></a>
          <div><p className="step-kicker">Área da equipe</p><h2>Bem-vindo<br /><em>de volta.</em></h2><p>Digite a senha administrativa para continuar.</p></div>
          <form onSubmit={login}><label><span>Senha de acesso</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="••••••••" autoFocus /></label>{loginError && <div className="form-alert" role="alert">! <span>{loginError}</span></div>}<button className="button button-gold button-large" disabled={loggingIn}>{loggingIn ? "Entrando…" : "Entrar no painel →"}</button></form>
          <a className="booking-back" href="/">← Voltar ao site</a>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <a href="/" className="brand admin-brand"><Image src="/images/logo-barbearia-35.png" alt="" width={58} height={44} /><span><b>BARBEARIA</b><strong>35</strong></span></a>
        <nav aria-label="Painel administrativo">
          <button className={tab === "agenda" ? "active" : ""} onClick={() => setTab("agenda")}><span>▦</span> Agenda</button>
          <button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}><span>✂</span> Serviços & preços</button>
          <button className={tab === "availability" ? "active" : ""} onClick={() => setTab("availability")}><span>◷</span> Disponibilidade</button>
          <button className={tab === "payment" ? "active" : ""} onClick={() => setTab("payment")}><span>◇</span> Pagamentos</button>
        </nav>
        <div className="sidebar-foot"><div><span>35</span><p><b>Equipe Barbearia 35</b><small>Administrador</small></p></div><button onClick={logout} title="Sair">↗</button></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div><p>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())}</p><h1>{tab === "agenda" ? "Agenda" : tab === "services" ? "Serviços & preços" : tab === "availability" ? "Disponibilidade" : "Configuração de pagamento"}</h1></div>
          <div className="admin-top-actions"><button className="icon-button" onClick={loadDashboard} title="Atualizar" aria-label="Atualizar painel">↻</button><a className="button button-ghost" href="/" target="_blank" rel="noreferrer">Ver site ↗</a></div>
        </header>
        <nav className="admin-mobile-tabs" aria-label="Seções do painel"><button className={tab === "agenda" ? "active" : ""} onClick={() => setTab("agenda")}>Agenda</button><button className={tab === "services" ? "active" : ""} onClick={() => setTab("services")}>Serviços</button><button className={tab === "availability" ? "active" : ""} onClick={() => setTab("availability")}>Horários</button><button className={tab === "payment" ? "active" : ""} onClick={() => setTab("payment")}>Pagamento</button></nav>
        {message && <div className="admin-message" role="status">✓ {message}</div>}{error && <div className="form-alert" role="alert">! <span>{error}</span></div>}

        {tab === "agenda" && (
          <div className="admin-section">
            <div className="stat-grid"><article><span>▦</span><div><small>Atendimentos hoje</small><strong>{todayAppointments.length}</strong></div><em>{todayAppointments.length ? `${todayAppointments.filter((item) => item.status === "concluido").length} concluído(s)` : "Agenda livre"}</em></article><article><span>◇</span><div><small>Recebido hoje</small><strong>{money(todayRevenue)}</strong></div><em>{pendingPayments} pendente(s)</em></article><article><span>◷</span><div><small>Próximo horário</small><strong>{todayAppointments.filter((item) => item.time >= new Date().toTimeString().slice(0, 5)).sort((a, b) => a.time.localeCompare(b.time))[0]?.time || "—"}</strong></div><em>{todayAppointments.find((item) => item.time >= new Date().toTimeString().slice(0, 5))?.firstName || "Sem cliente"}</em></article></div>
            <div className="agenda-action-bar">
              <button className="button button-gold" onClick={() => setAgendaAction(agendaAction === "appointment" ? null : "appointment")}>+ Agendar corte</button>
              <button className="button button-ghost" onClick={() => setAgendaAction(agendaAction === "block" ? null : "block")}>◷ Bloquear horário</button>
            </div>
            <div className="admin-panel">
              <div className="panel-head"><div><h2>Agenda do dia</h2><p>{longDate(agendaDate)}</p></div><div className="date-controls"><button onClick={() => shiftDay(-1)} aria-label="Dia anterior">←</button><input type="date" value={agendaDate} onChange={(event) => setAgendaDate(event.target.value)} /><button onClick={() => shiftDay(1)} aria-label="Próximo dia">→</button></div></div>
              {agendaAction === "appointment" && <form className="agenda-quick-form" onSubmit={createManualAppointment}><div className="agenda-form-title"><div><span>+</span><div><h3>Novo agendamento</h3><p>Adicione um cliente diretamente em {longDate(agendaDate)}.</p></div></div><button type="button" className="icon-button" onClick={() => setAgendaAction(null)}>×</button></div><div className="field-grid"><label><span>Primeiro nome</span><input required value={manualForm.firstName} onChange={(event) => setManualForm({ ...manualForm, firstName: event.target.value })} placeholder="Ex.: João" /></label><label><span>Sobrenome</span><input required value={manualForm.lastName} onChange={(event) => setManualForm({ ...manualForm, lastName: event.target.value })} placeholder="Ex.: Silva" /></label></div><label><span>WhatsApp</span><input required inputMode="tel" value={manualForm.whatsapp} onChange={(event) => setManualForm({ ...manualForm, whatsapp: event.target.value })} placeholder="(62) 99999-9999" /></label><div className="field-grid"><label><span>Serviço</span><select required value={manualForm.serviceId} onChange={(event) => setManualForm({ ...manualForm, serviceId: event.target.value })}>{data.services.filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name} • {service.duration} min</option>)}</select></label><label><span>Horário</span><select value={manualForm.time} onChange={(event) => setManualForm({ ...manualForm, time: event.target.value })}>{timeOptions.map((time) => <option key={time}>{time}</option>)}</select></label></div><div className="agenda-form-actions"><button type="button" className="button button-ghost" onClick={() => setAgendaAction(null)}>Cancelar</button><button className="button button-gold">Adicionar à agenda</button></div></form>}
              {agendaAction === "block" && <form className="agenda-quick-form" onSubmit={blockAgendaTime}><div className="agenda-form-title"><div><span>◷</span><div><h3>Bloquear horário</h3><p>Impeça novos agendamentos em {longDate(agendaDate)}.</p></div></div><button type="button" className="icon-button" onClick={() => setAgendaAction(null)}>×</button></div><div className="field-grid"><label><span>Horário</span><select value={quickBlockForm.time} onChange={(event) => setQuickBlockForm({ ...quickBlockForm, time: event.target.value })}>{timeOptions.map((time) => <option key={time}>{time}</option>)}</select></label><label><span>Motivo (opcional)</span><input value={quickBlockForm.reason} onChange={(event) => setQuickBlockForm({ ...quickBlockForm, reason: event.target.value })} placeholder="Ex.: Almoço" /></label></div><div className="agenda-form-actions"><button type="button" className="button button-ghost" onClick={() => setAgendaAction(null)}>Cancelar</button><button className="button button-gold">Bloquear na agenda</button></div></form>}
              {pendingAgenda.length > 0 && <div className="pending-reservations"><div className="pending-reservations-head"><div><span>◷</span><div><h3>PIX aguardando confirmação</h3><p>O horário está bloqueado provisoriamente por 15 minutos.</p></div></div><b>{pendingAgenda.length}</b></div>{pendingAgenda.map((item) => <article key={item.id}><time>{item.time}<small>{item.serviceDuration} min</small></time><div><b>{item.firstName} {item.lastName}</b><a href={`https://wa.me/55${item.whatsapp}`} target="_blank" rel="noreferrer">{phoneLabel(item.whatsapp)}</a><span>{item.serviceName}</span></div><div><small>PIX esperado</small><strong>{money(item.paymentAmountCents)}</strong><span>até {item.expiresAt ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(`${item.expiresAt.replace(" ", "T")}Z`)) : "—"}</span></div><div className="pending-actions"><button className="confirm-payment" onClick={() => action({ action: "confirmPayment", id: item.id }, "PIX confirmado. Horário adicionado à agenda.")}>Confirmar PIX</button><button className="reject-payment" onClick={() => window.confirm(`Cancelar a reserva de ${item.firstName} e liberar ${item.time}?`) && action({ action: "appointmentStatus", id: item.id, status: "cancelado" }, "Reserva cancelada e horário liberado.")}>Não pago</button></div></article>)}</div>}
              {loading ? <div className="admin-empty">Atualizando agenda…</div> : activeAgenda.length === 0 ? <div className="admin-empty"><span>◷</span><h3>Nenhum cliente agendado</h3><p>Use “Agendar corte” para adicionar um atendimento.</p></div> : (
                <div className="appointment-list">{activeAgenda.map((item) => <article className={`appointment-row status-${item.status}`} key={item.id}><time>{item.time}<small>{item.serviceDuration} min</small></time><div className="client-cell"><span>{item.firstName.charAt(0)}{item.lastName.charAt(0)}</span><div><b>{item.firstName} {item.lastName}</b><a href={`https://wa.me/55${item.whatsapp}`} target="_blank" rel="noreferrer">{phoneLabel(item.whatsapp)}</a></div></div><div><small>Serviço</small><b>{item.serviceName}</b><span>{money(item.totalCents)}</span></div><div><small>Pagamento</small><select value={item.paymentStatus} onChange={(event) => action({ action: "paymentStatus", id: item.id, paymentStatus: event.target.value }, "Pagamento atualizado.")}><option value="dispensado">Sem cobrança</option><option value="pendente">Pendente</option><option value="sinal_pago">Sinal pago</option><option value="pago">Pago</option></select></div><span className={`status-pill ${item.status}`}>{statusLabel[item.status]}</span><div className="row-actions">{item.status !== "concluido" && <button onClick={() => action({ action: "appointmentStatus", id: item.id, status: "concluido" }, "Atendimento marcado como concluído.")} title="Marcar como concluído">✓</button>}<button className="danger" onClick={() => window.confirm(`Cancelar o horário de ${item.firstName} ${item.lastName} às ${item.time}?`) && action({ action: "appointmentStatus", id: item.id, status: "cancelado" }, "Horário cancelado e liberado.")} title="Cancelar horário">×</button></div></article>)}</div>
              )}
              {dayBlocks.length > 0 && <div className="agenda-blocks"><h3>Bloqueios do dia</h3>{dayBlocks.map((block) => <article key={block.id}><div><time>{block.time || "Dia inteiro"}</time><span>{block.reason}</span></div><button onClick={() => action({ action: "unblock", id: block.id }, "Horário liberado.")}>Liberar</button></article>)}</div>}
              {agenda.filter((item) => item.status === "cancelado").length > 0 && <details className="cancelled-list"><summary>Ver {agenda.filter((item) => item.status === "cancelado").length} cancelado(s)</summary>{agenda.filter((item) => item.status === "cancelado").map((item) => <p key={item.id}>{item.time} • {item.firstName} {item.lastName} • {item.serviceName}</p>)}</details>}
            </div>
          </div>
        )}

        {tab === "services" && (
          <div className="admin-section">
            <div className="section-action-head"><div><h2>Catálogo de serviços</h2><p>As alterações aparecem automaticamente no site e no agendamento.</p></div><button className="button button-gold" onClick={() => { setServiceForm({ id: "", name: "", description: "", duration: "45", price: "45,00", image: "" }); setShowServiceForm(true); }}>+ Adicionar serviço</button></div>
            {showServiceForm && <form className="admin-panel service-form" onSubmit={saveService}><div className="panel-head"><div><h2>{serviceForm.id ? "Editar serviço" : "Novo serviço"}</h2><p>Preencha os dados exibidos ao cliente.</p></div><button type="button" className="icon-button" onClick={() => setShowServiceForm(false)}>×</button></div><div className="field-grid"><label><span>Nome do serviço</span><input value={serviceForm.name} onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} placeholder="Ex.: Corte executivo" /></label><label><span>Duração em minutos</span><input type="number" min="15" max="240" step="15" value={serviceForm.duration} onChange={(event) => setServiceForm({ ...serviceForm, duration: event.target.value })} /></label></div><label><span>Descrição</span><textarea value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} placeholder="Descreva rapidamente o que está incluído." /></label><label><span>Preço em R$</span><input inputMode="decimal" value={serviceForm.price} onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })} placeholder="45,00" /></label><div className="service-image-field"><div className="service-image-preview">{serviceForm.image ? <img src={serviceForm.image} alt="Prévia da foto do serviço" /> : <span>Sem foto</span>}</div><div><b>Foto de fundo do serviço</b><p>Use uma imagem horizontal em JPG, PNG ou WebP. Ela será ajustada automaticamente.</p><label className="button button-ghost"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleServiceImage} disabled={processingImage} />{processingImage ? "Preparando foto…" : serviceForm.image ? "Trocar foto" : "Escolher foto"}</label>{serviceForm.image && <button type="button" className="remove-image" onClick={() => setServiceForm({ ...serviceForm, image: "" })}>Remover foto</button>}</div></div><div className="form-actions"><button type="button" className="button button-ghost" onClick={() => setShowServiceForm(false)}>Cancelar</button><button className="button button-gold" disabled={processingImage}>Salvar serviço</button></div></form>}
            <div className="service-admin-grid">{data.services.map((service, index) => <article className={!service.active ? "archived" : ""} key={service.id}><div className="service-admin-icon">{service.image ? <img src={service.image} alt="" /> : String(index + 1).padStart(2, "0")}</div><div><small>{service.active ? "Ativo no site" : "Arquivado"}</small><h3>{service.name}</h3><p>{service.description}</p><span>◷ {service.duration} min</span></div><strong>{money(service.priceCents)}</strong><div><button onClick={() => editService(service)}>Editar</button>{service.active && <button className="danger-text" onClick={() => window.confirm(`Remover ${service.name} do catálogo?`) && action({ action: "archiveService", id: service.id }, "Serviço removido do catálogo.")}>Remover</button>}</div></article>)}</div>
          </div>
        )}

        {tab === "availability" && (
          <div className="admin-section availability-grid">
            <form className="admin-panel" onSubmit={async (event) => { event.preventDefault(); await action({ action: "blockSlot", ...blockForm }, "Horário bloqueado."); }}><div className="panel-head"><div><h2>Bloquear horário</h2><p>Impeça novas reservas em um período específico.</p></div><span className="panel-icon">◷</span></div><label><span>Data</span><input type="date" value={blockForm.date} onChange={(event) => setBlockForm({ ...blockForm, date: event.target.value })} /></label><label><span>Horário</span><select value={blockForm.time} onChange={(event) => setBlockForm({ ...blockForm, time: event.target.value })}>{timeOptions.map((time) => <option key={time}>{time}</option>)}</select></label><label><span>Motivo (opcional)</span><input value={blockForm.reason} onChange={(event) => setBlockForm({ ...blockForm, reason: event.target.value })} placeholder="Ex.: Almoço, manutenção…" /></label><button className="button button-gold">Bloquear horário</button><button type="button" className="button button-ghost" onClick={() => window.confirm(`Bloquear o dia inteiro em ${longDate(blockForm.date)}?`) && action({ action: "blockDay", date: blockForm.date, reason: blockForm.reason }, "Dia inteiro bloqueado.")}>Bloquear o dia inteiro</button></form>
            <div className="admin-panel"><div className="panel-head"><div><h2>Bloqueios ativos</h2><p>Libere quando o período voltar a ficar disponível.</p></div><span className="panel-count">{data.blocks.length}</span></div>{data.blocks.length === 0 ? <div className="admin-empty"><span>✓</span><h3>Nenhum bloqueio ativo</h3><p>Todos os horários seguem disponíveis.</p></div> : <div className="block-list">{data.blocks.map((block) => <article key={block.id}><div><strong>{longDate(block.date)}</strong><span>{block.time || "Dia inteiro"} • {block.reason}</span></div><button onClick={() => action({ action: "unblock", id: block.id }, "Horário liberado.")}>Liberar</button></article>)}</div>}</div>
          </div>
        )}

        {tab === "payment" && (
          <div className="admin-section payment-admin-grid">
            <form className="admin-panel" onSubmit={async (event) => { event.preventDefault(); await action({ action: "updatePayment", depositPercent: Number(paymentForm.depositPercent), pixKey: paymentForm.pixKey }, "Configuração de pagamento atualizada."); }}><div className="panel-head"><div><h2>Pagamento e sinal</h2><p>Defina quanto o cliente paga para garantir o horário.</p></div><span className="panel-icon">◇</span></div><label><span>Percentual do sinal</span><div className="percent-input"><input type="number" min="1" max="100" value={paymentForm.depositPercent} onChange={(event) => setPaymentForm({ ...paymentForm, depositPercent: event.target.value })} /><b>%</b></div><small>Para um serviço de R$ 80,00, o sinal será {money(8000 * Number(paymentForm.depositPercent || 0) / 100)}.</small></label><label><span>Chave PIX da barbearia</span><input value={paymentForm.pixKey} onChange={(event) => setPaymentForm({ ...paymentForm, pixKey: event.target.value })} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" /></label><button className="button button-gold">Salvar configurações</button></form>
            <div className="admin-panel payment-preview"><p className="step-kicker">Prévia do cliente</p><h2>Resumo da reserva</h2><div><span>Serviço exemplo</span><b>R$ 80,00</b></div><div><span>Sinal de {paymentForm.depositPercent || 0}%</span><strong>{money(8000 * Number(paymentForm.depositPercent || 0) / 100)}</strong></div><p>O restante será informado ao cliente no resumo do agendamento.</p><div className="demo-note">O cliente recebe o PIX com esta chave e deve enviar o comprovante pelo WhatsApp em até 15 minutos.</div></div>
          </div>
        )}
      </section>
    </main>
  );
}
