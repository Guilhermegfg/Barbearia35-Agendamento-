"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Service = { id: string; name: string; description: string; duration: number; priceCents: number; image: string };
type Availability = { busy: { time: string; duration: number }[]; blocks: { id: string; time: string }[] };
type Booking = {
  id: string;
  firstName: string;
  lastName: string;
  serviceName: string;
  date: string;
  time: string;
  totalCents: number;
  paymentAmountCents: number;
  paymentType: string;
  expiresAt: string | null;
};

const fallbackServices: Service[] = [
  { id: "corte-tradicional", name: "Corte Tradicional", description: "Tesoura e máquina com acabamento preciso.", duration: 45, priceCents: 4500, image: "/images/services/corte-tradicional.jpg" },
  { id: "degrade-fade", name: "Degradê / Fade", description: "Transição limpa e acabamento na navalha.", duration: 60, priceCents: 5500, image: "/images/services/degrade-fade.jpg" },
  { id: "barba-terapia", name: "Barba Terapia", description: "Modelagem, toalha quente e hidratação.", duration: 45, priceCents: 4000, image: "/images/services/barba-terapia.jpg" },
  { id: "combo", name: "Combo Cabelo + Barba", description: "Visual completo em uma única visita.", duration: 90, priceCents: 8000, image: "/images/services/combo-cabelo-barba.jpg" },
  { id: "platinado", name: "Platinado", description: "Descoloração e tonalização com avaliação prévia.", duration: 120, priceCents: 15000, image: "/images/services/platinado.jpg" },
];

const steps = ["Seus dados", "Serviço", "Data e hora", "Confirmação"];
const defaultHours: Record<string, [string, string] | null> = { "0": null, "1": ["09:00", "19:00"], "2": ["09:00", "19:00"], "3": ["09:00", "19:00"], "4": ["09:00", "19:00"], "5": ["09:00", "19:00"], "6": ["09:00", "18:00"] };

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const toMinutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
const fromMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const overlaps = (a: number, ad: number, b: number, bd: number) => a < b + bd && b < a + ad;
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatDate = (date: string, style: "long" | "short" = "long") => new Intl.DateTimeFormat("pt-BR", style === "long" ? { weekday: "long", day: "2-digit", month: "long" } : { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${date}T12:00:00`));

const pixField = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;
function pixCrc(payload: string) {
  let crc = 0xffff;
  for (const character of payload) {
    crc ^= character.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function pixPayload(key: string, amountCents: number) {
  const normalizedKey = key.trim();
  const merchantAccount = pixField("00", "BR.GOV.BCB.PIX") + pixField("01", normalizedKey);
  const additional = pixField("05", "***");
  const base = pixField("00", "01") + pixField("26", merchantAccount) + pixField("52", "0000") + pixField("53", "986") + pixField("54", (amountCents / 100).toFixed(2)) + pixField("58", "BR") + pixField("59", "BARBEARIA 35") + pixField("60", "GOIAS") + pixField("62", additional) + "6304";
  return base + pixCrc(base);
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function BookingPage() {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState(fallbackServices);
  const [settings, setSettings] = useState<Record<string, string>>({ depositPercent: "30", pixKey: "", whatsapp: "" });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [availability, setAvailability] = useState<Availability>({ busy: [], blocks: [] });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paymentType, setPaymentType] = useState<"deposit" | "full">("deposit");
  const [copied, setCopied] = useState(false);
  const [requestId, setRequestId] = useState("");

  const calendarDays = useMemo(() => Array.from({ length: 21 }, (_, index) => {
    const value = new Date();
    value.setHours(12, 0, 0, 0);
    value.setDate(value.getDate() + index);
    return value;
  }), []);

  const selectedService = services.find((service) => service.id === serviceId);
  const depositPercent = Math.min(100, Math.max(1, Number(settings.depositPercent) || 30));
  const chargeCents = selectedService ? (paymentType === "full" ? selectedService.priceCents : Math.round(selectedService.priceCents * depositPercent / 100)) : 0;
  const hours = useMemo(() => {
    try { return { ...defaultHours, ...JSON.parse(settings.businessHours || "{}") }; }
    catch { return defaultHours; }
  }, [settings.businessHours]);

  const slots = useMemo(() => {
    if (!date || !selectedService) return [];
    const day = new Date(`${date}T12:00:00`).getDay();
    const interval = hours[String(day)];
    if (!interval || availability.blocks.some((block) => !block.time)) return [];
    const output: { time: string; available: boolean }[] = [];
    const now = new Date();
    const today = isoDate(now);
    for (let minute = toMinutes(interval[0]); minute + selectedService.duration <= toMinutes(interval[1]); minute += 15) {
      const slot = fromMinutes(minute);
      const isPast = date === today && minute <= now.getHours() * 60 + now.getMinutes() + 30;
      const isBusy = availability.busy.some((item) => overlaps(minute, selectedService.duration, toMinutes(item.time), item.duration));
      const isBlocked = availability.blocks.some((item) => item.time && overlaps(minute, selectedService.duration, toMinutes(item.time), 30));
      output.push({ time: slot, available: !isPast && !isBusy && !isBlocked });
    }
    return output;
  }, [availability, date, hours, selectedService]);

  useEffect(() => {
    const saved = window.localStorage.getItem("barbearia35_booking_draft");
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setFirstName(draft.firstName || ""); setLastName(draft.lastName || ""); setPhone(draft.phone || "");
        setServiceId(draft.serviceId || ""); setDate(draft.date || ""); setTime(draft.time || "");
      } catch { /* rascunho inválido é ignorado */ }
    }
    setRequestId(crypto.randomUUID());
    fetch("/api/public/bootstrap", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (data.services?.length) setServices(data.services);
        if (data.settings) setSettings(data.settings);
        const preset = new URLSearchParams(window.location.search).get("servico");
        if (preset) setServiceId(preset);
      }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!requestId) return;
    window.localStorage.setItem("barbearia35_booking_draft", JSON.stringify({ firstName, lastName, phone, serviceId, date, time }));
  }, [date, firstName, lastName, phone, requestId, serviceId, time]);

  useEffect(() => {
    if (!date || !serviceId) return;
    setAvailabilityLoading(true); setTime("");
    fetch(`/api/public/availability?date=${date}&serviceId=${encodeURIComponent(serviceId)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(new Error(body.error))))
      .then((data) => setAvailability({ busy: data.busy || [], blocks: data.blocks || [] }))
      .catch((reason) => setError(reason.message || "Não foi possível consultar os horários."))
      .finally(() => setAvailabilityLoading(false));
  }, [date, serviceId]);

  function validateCurrentStep() {
    setError("");
    if (step === 1 && (firstName.trim().length < 2 || lastName.trim().length < 2 || phone.replace(/\D/g, "").length < 10)) {
      setError("Informe nome, sobrenome e um WhatsApp válido."); return false;
    }
    if (step === 2 && !selectedService) { setError("Escolha um serviço para continuar."); return false; }
    if (step === 3 && (!date || !time)) { setError("Escolha uma data e um horário disponível."); return false; }
    return true;
  }

  function next() {
    if (validateCurrentStep()) { setStep((value) => Math.min(4, value + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!selectedService) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/public/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, firstName, lastName, whatsapp: phone, serviceId, date, time, paymentType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível confirmar.");
      setBooking(data.booking); window.localStorage.removeItem("barbearia35_booking_draft"); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível confirmar o agendamento."); }
    finally { setSubmitting(false); }
  }

  const pixCode = booking && settings.pixKey ? pixPayload(settings.pixKey, booking.paymentAmountCents) : "";
  const proofUrl = booking && settings.whatsapp ? `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`Olá! Fiz a reserva #${booking.id.slice(0, 8).toUpperCase()} para ${formatDate(booking.date, "short")} às ${booking.time}. Vou enviar o comprovante do PIX de ${money(booking.paymentAmountCents)} para confirmar o horário.`)}` : "#";
  const holdDeadline = booking?.expiresAt
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(`${booking.expiresAt.replace(" ", "T")}Z`))
    : "15 minutos";

  if (booking) {
    return (
      <main className="booking-page success-page">
        <div className="success-card">
          <div className="success-mark pending" aria-hidden="true">◷</div>
          <p className="eyebrow"><span /> Aguardando pagamento</p>
          <h1>Seu horário está reservado<br /><em>por 15 minutos.</em></h1>
          <p><strong>{booking.firstName}</strong>, pague o PIX e envie o comprovante pelo WhatsApp. A reserva só entra na agenda após a confirmação da barbearia.</p>
          <div className="hold-alert"><span>◷</span><div><b>Reserva provisória até {holdDeadline}</b><p>Sem o envio do comprovante dentro do prazo, o horário será liberado automaticamente.</p></div></div>
          <div className="success-summary"><div><small>Código da reserva</small><b>#{booking.id.slice(0, 8).toUpperCase()}</b></div><div><small>Valor do PIX</small><b>{money(booking.paymentAmountCents)}</b></div></div>
          <div className="pix-box"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(pixCode)}`} alt="QR Code PIX da reserva" width="220" height="220" /><div><h2>Pague pelo PIX</h2><p>Escaneie o QR Code ou use o PIX Copia e Cola.</p><small>Chave PIX: {settings.pixKey}</small><code>{pixCode}</code><button className="button button-ghost" type="button" onClick={() => { navigator.clipboard.writeText(pixCode); setCopied(true); }}>{copied ? "Código copiado!" : "Copiar código PIX"}</button></div></div>
          <p className="proof-warning"><strong>Última etapa:</strong> depois de pagar, toque no botão abaixo e envie a imagem do comprovante. O barbeiro fará a confirmação.</p>
          <div className="success-actions"><a className="button button-gold button-large" href={proofUrl} target="_blank" rel="noreferrer">Enviar comprovante no WhatsApp</a><a className="button button-ghost button-large" href="/">Voltar ao início</a></div>
        </div>
      </main>
    );
  }

  return (
    <main className="booking-page">
      <header className="booking-header">
        <a href="/" className="booking-back">← <span>Voltar ao site</span></a>
        <a href="/" className="brand" aria-label="Barbearia 35 — início"><Image src="/images/logo-barbearia-35.png" alt="" width={54} height={40} priority /><span><b>BARBEARIA</b><strong>35</strong></span></a>
        <a className="booking-help" href={settings.whatsapp ? `https://wa.me/${settings.whatsapp}` : "#"} target="_blank" rel="noreferrer">Precisa de ajuda?</a>
      </header>

      <div className="booking-layout">
        <aside className="booking-aside">
          <p className="eyebrow"><span /> Agendamento online</p>
          <h1>Seu horário em<br /><em>menos de 2 minutos.</em></h1>
          <p>Escolha o serviço, encontre o melhor horário e garanta sua reserva.</p>
          <ol className="stepper">
            {steps.map((label, index) => <li className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} key={label}><button type="button" disabled={index + 1 > step} onClick={() => index + 1 < step && setStep(index + 1)}><span>{step > index + 1 ? "✓" : index + 1}</span><div><small>Etapa {index + 1}</small><b>{label}</b></div></button></li>)}
          </ol>
          <div className="booking-trust"><span>🔒</span><p><b>Seus dados estão seguros.</b><br />Usamos apenas para confirmar seu horário.</p></div>
        </aside>

        <section className="booking-content">
          <div className="mobile-progress"><span>Etapa {step} de 4 • {steps[step - 1]}</span><i><b style={{ width: `${step * 25}%` }} /></i></div>
          <form onSubmit={confirm}>
            {error && <div className="form-alert" role="alert">! <span>{error}</span></div>}
            {step === 1 && (
              <div className="form-step">
                <p className="step-kicker">01 — Seus dados</p><h2>Como podemos<br /><em>chamar você?</em></h2><p className="step-intro">Precisamos só do essencial para reservar seu horário.</p>
                <div className="field-grid"><label><span>Primeiro nome</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" placeholder="Ex.: Guilherme" maxLength={40} /></label><label><span>Sobrenome</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" placeholder="Ex.: Silva" maxLength={60} /></label></div>
                <label><span>WhatsApp</span><input value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} inputMode="tel" autoComplete="tel" placeholder="(62) 99999-9999" /><small>Usaremos este número apenas para confirmar seu horário.</small></label>
              </div>
            )}
            {step === 2 && (
              <div className="form-step">
                <p className="step-kicker">02 — Serviço</p><h2>Qual cuidado você<br /><em>quer reservar?</em></h2><p className="step-intro">Selecione uma opção. Você poderá revisar tudo antes de confirmar.</p>
                <div className="booking-services">{services.map((service, index) => <button type="button" className={serviceId === service.id ? "booking-service selected" : "booking-service"} key={service.id} onClick={() => setServiceId(service.id)} aria-pressed={serviceId === service.id}><span className="booking-service-image">{service.image ? <img src={service.image} alt="" /> : <b>{String(index + 1).padStart(2, "0")}</b>}</span><div><h3>{service.name}</h3><p>{service.description}</p><small>◷ {service.duration} min</small></div><strong>{money(service.priceCents)}</strong><i aria-hidden="true">✓</i></button>)}</div>
              </div>
            )}
            {step === 3 && (
              <div className="form-step">
                <p className="step-kicker">03 — Data e hora</p><h2>Quando fica melhor<br /><em>para você?</em></h2><p className="step-intro">Os horários são atualizados em tempo real.</p>
                <h3 className="field-title">Escolha o dia</h3>
                <div className="date-strip">{calendarDays.map((item) => { const value = isoDate(item); const closed = !hours[String(item.getDay())]; return <button type="button" key={value} disabled={closed} className={date === value ? "selected" : ""} onClick={() => setDate(value)}><small>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(item).replace(".", "")}</small><strong>{item.getDate()}</strong><span>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(item).replace(".", "")}</span>{closed && <i>Fechado</i>}</button>; })}</div>
                <h3 className="field-title">Horários disponíveis {date && <small>• {formatDate(date)}</small>}</h3>
                {availabilityLoading ? <div className="slots-loading">Consultando a agenda…</div> : slots.length ? <div className="time-grid">{slots.map((slot) => <button type="button" key={slot.time} disabled={!slot.available} className={time === slot.time ? "selected" : ""} onClick={() => setTime(slot.time)} aria-label={`${slot.time} — ${slot.available ? "disponível" : "indisponível"}`}>{slot.time}<small>{slot.available ? "Disponível" : "Indisponível"}</small></button>)}</div> : <div className="empty-slots"><span>◷</span><p>{date ? "Este dia não tem horários disponíveis. Escolha outra data." : "Escolha um dia para ver os horários."}</p></div>}
              </div>
            )}
            {step === 4 && selectedService && (
              <div className="form-step payment-step">
                <p className="step-kicker">04 — Pagamento</p><h2>Revise antes<br /><em>de reservar.</em></h2><p className="step-intro">Ao continuar, o horário ficará reservado por 15 minutos enquanto aguardamos o PIX.</p>
                <div className="booking-summary"><div><small>Cliente</small><b>{firstName} {lastName}</b><span>{phone}</span></div><div><small>Serviço</small><b>{selectedService.name}</b><span>{selectedService.duration} minutos</span></div><div><small>Data e horário</small><b>{formatDate(date)}</b><span>às {time}</span></div><div className="summary-total"><small>Valor total</small><b>{money(selectedService.priceCents)}</b></div></div>
                <h3 className="field-title">Quanto pagar agora?</h3>
                <div className="payment-options"><button type="button" className={paymentType === "deposit" ? "selected" : ""} onClick={() => setPaymentType("deposit")}><i aria-hidden="true" /><div><b>Pagar sinal de {depositPercent}%</b><span>{money(Math.round(selectedService.priceCents * depositPercent / 100))} agora. O restante fica para o atendimento.</span></div><strong>{money(Math.round(selectedService.priceCents * depositPercent / 100))}</strong></button><button type="button" className={paymentType === "full" ? "selected" : ""} onClick={() => setPaymentType("full")}><i aria-hidden="true" /><div><b>Pagar valor integral</b><span>Deixe tudo resolvido antes de chegar.</span></div><strong>{money(selectedService.priceCents)}</strong></button></div>
                <div className="method-panel"><span className="method-icon">◇</span><div><b>Pagamento por PIX</b><p>O QR Code e o código Copia e Cola aparecerão na próxima tela.</p></div></div>
                <div className="payment-hold-notice"><span>◷</span><p><b>Atenção:</b> após reservar, você terá 15 minutos para pagar e enviar o comprovante no WhatsApp. A confirmação será feita pela barbearia.</p></div>
                <div className="charge-line"><span>Você paga agora</span><strong>{money(chargeCents)}</strong></div>
              </div>
            )}

            <div className="form-actions">{step > 1 ? <button className="button button-ghost" type="button" onClick={() => { setError(""); setStep((value) => value - 1); }}>← Voltar</button> : <span />}{step < 4 ? <button className="button button-gold" type="button" onClick={next}>Continuar <span aria-hidden="true">→</span></button> : <button className="button button-gold" type="submit" disabled={submitting}>{submitting ? "Reservando…" : "Reservar por 15 minutos →"}</button>}</div>
          </form>
        </section>
      </div>
    </main>
  );
}
