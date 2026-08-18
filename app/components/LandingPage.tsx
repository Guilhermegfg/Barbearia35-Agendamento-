"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  priceCents: number;
  image: string;
};

const fallbackServices: Service[] = [
  { id: "corte-tradicional", name: "Corte Tradicional", description: "Tesoura e máquina com acabamento preciso.", duration: 45, priceCents: 4500, image: "/images/services/corte-tradicional.jpg" },
  { id: "degrade-fade", name: "Degradê / Fade", description: "Transição limpa e acabamento na navalha.", duration: 60, priceCents: 5500, image: "/images/services/degrade-fade.jpg" },
  { id: "barba-terapia", name: "Barba Terapia", description: "Modelagem, toalha quente e hidratação.", duration: 45, priceCents: 4000, image: "/images/services/barba-terapia.jpg" },
  { id: "combo", name: "Combo Cabelo + Barba", description: "Visual completo em uma única visita.", duration: 90, priceCents: 8000, image: "/images/services/combo-cabelo-barba.jpg" },
  { id: "platinado", name: "Platinado", description: "Descoloração e tonalização com avaliação prévia.", duration: 120, priceCents: 15000, image: "/images/services/platinado.jpg" },
];

const differentials = [
  ["✦", "Acabamento preciso", "Cada detalhe recebe atenção, da linha à finalização."],
  ["♨", "Toalha quente", "Conforto e preparo de pele para uma barba impecável."],
  ["❄", "Ambiente climatizado", "Conforto do primeiro minuto ao acabamento."],
  ["✚", "Higiene e cuidado", "Ferramentas e espaços preparados para cada atendimento."],
  ["◷", "Pontualidade", "Seu horário é reservado e o seu tempo é respeitado."],
];

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export function LandingPage() {
  const [services, setServices] = useState(fallbackServices);
  const [settings, setSettings] = useState<Record<string, string>>({ whatsapp: "", address: "Endereço da Barbearia 35 • Goiás — GO" });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/public/bootstrap", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (data.services?.length) setServices(data.services);
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const whatsapp = settings.whatsapp || "";
  const whatsappUrl = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá! Vim pelo site da Barbearia 35 e quero tirar uma dúvida.")}`;

  return (
    <div className="site-shell">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <header className="main-header">
        <div className="container header-inner">
          <a href="/" className="brand" aria-label="Barbearia 35 — início">
            <Image src="/images/logo-barbearia-35.png" alt="" width={56} height={42} priority />
            <span><b>BARBEARIA</b><strong>35</strong></span>
          </a>
          <button className="menu-button" type="button" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen((value) => !value)}>
            <span className="sr-only">Abrir menu</span><i /><i /><i />
          </button>
          <nav id="main-nav" className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Navegação principal">
            <a href="#sobre" onClick={() => setMenuOpen(false)}>Sobre</a>
            <a href="#servicos" onClick={() => setMenuOpen(false)}>Cortes & preços</a>
            <a href="#diferenciais" onClick={() => setMenuOpen(false)}>Diferenciais</a>
            <a href="#localizacao" onClick={() => setMenuOpen(false)}>Localização</a>
            <a href="#contato" onClick={() => setMenuOpen(false)}>Contato</a>
          </nav>
          <a className="button button-gold header-cta" href="/agendar">Agendar horário</a>
        </div>
      </header>

      <main id="conteudo">
        <section className="hero">
          <div className="hero-media" aria-hidden="true" />
          <div className="container hero-content">
            <p className="eyebrow"><span /> Barbearia 35 • atendimento com hora marcada</p>
            <h1>Tradição no corte.<br /><em>Respeito pelo seu tempo.</em></h1>
            <p className="hero-copy">Cabelo, barba e acabamento impecável, em um ambiente feito para você desacelerar.</p>
            <div className="hero-actions">
              <a className="button button-gold button-large" href="/agendar">Agendar meu horário <span aria-hidden="true">→</span></a>
              <a className="button button-ghost button-large" href={whatsappUrl} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
            </div>
            <div className="trust-line" aria-label="Benefícios"><span>✓ Horário marcado</span><span>✓ Ambiente climatizado</span><span>✓ Atendimento sem fila</span></div>
          </div>
          <a href="#sobre" className="scroll-cue" aria-label="Conhecer a Barbearia 35"><span>Conheça a 35</span><i /></a>
        </section>

        <section id="sobre" className="section about-section">
          <div className="container about-grid">
            <div className="about-visual reveal-frame">
              <Image src="/images/fachada-dia.png" alt="Fachada da Barbearia 35 durante o dia" fill sizes="(max-width: 800px) 100vw, 48vw" />
              <div className="about-badge"><strong>35</strong><span>Seu estilo<br />começa aqui</span></div>
            </div>
            <div className="about-copy">
              <p className="eyebrow"><span /> A experiência 35</p>
              <h2>Mais que um corte,<br /><em>seu momento da semana.</em></h2>
              <p>Na Barbearia 35, técnica, conversa boa e pontualidade caminham juntas. Do clássico ao fade, cada serviço recebe atenção aos detalhes.</p>
              <p>Aqui você chega, relaxa e sai pronto — com atendimento marcado, sem fila e sem pressa.</p>
              <div className="metrics"><div><strong>5</strong><span>serviços<br />especializados</span></div><div><strong>100%</strong><span>com hora<br />marcada</span></div><div><strong>35</strong><span>é mais que<br />um número</span></div></div>
            </div>
          </div>
        </section>

        <section id="servicos" className="section services-section">
          <div className="container">
            <div className="section-heading split-heading">
              <div><p className="eyebrow"><span /> Cortes & preços</p><h2>Escolha seu <em>próximo visual.</em></h2></div>
              <p>Preços transparentes, tempo reservado e atenção completa aos detalhes.</p>
            </div>
            <div className="services-grid">
              {services.map((service, index) => (
                <article className="service-card" key={service.id}>
                  <div className={`service-art service-art-${(index % 5) + 1}`} aria-hidden="true">{service.image && <img src={service.image} alt="" />}<span>{String(index + 1).padStart(2, "0")}</span><b>{service.name.split(" ")[0]}</b></div>
                  <div className="service-content">
                    <div className="service-top"><h3>{service.name}</h3><strong>{money(service.priceCents)}</strong></div>
                    <p>{service.description}</p>
                    <div className="service-meta"><span>◷ {service.duration} min</span><span>Acabamento incluso</span></div>
                    <a className="text-link" href={`/agendar?servico=${encodeURIComponent(service.id)}`}>Agendar este serviço <span aria-hidden="true">→</span></a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="diferenciais" className="section differences-section">
          <div className="container">
            <div className="section-heading centered"><p className="eyebrow"><span /> Feito para você</p><h2>Os detalhes fazem <em>a diferença.</em></h2><p>Do momento em que você chega até o último fio no lugar.</p></div>
            <div className="differences-grid">
              {differentials.map(([icon, title, copy]) => <article className="difference-card" key={title}><div className="difference-icon" aria-hidden="true">{icon}</div><h3>{title}</h3><p>{copy}</p></article>)}
            </div>
          </div>
        </section>

        <section id="localizacao" className="section location-section">
          <div className="container location-grid">
            <div className="location-copy">
              <p className="eyebrow"><span /> Onde estamos</p>
              <h2>Seu próximo corte<br /><em>é aqui.</em></h2>
              <div className="contact-row"><span className="contact-icon">⌖</span><div><small>Endereço</small><strong>{settings.address || "Endereço da Barbearia 35 • Goiás — GO"}</strong><p>Confirme a rota pelo WhatsApp antes de sair.</p></div></div>
              <div className="contact-row"><span className="contact-icon">◷</span><div><small>Horários</small><strong>Segunda a sexta • 09h às 19h</strong><p>Sábado • 09h às 18h<br />Domingo • Fechado</p></div></div>
              <div className="location-actions"><a className="button button-gold" href={whatsappUrl} target="_blank" rel="noreferrer">Chamar no WhatsApp</a><a className="button button-ghost" href="https://www.google.com/maps/search/?api=1&query=Barbearia+35+Goi%C3%A1s" target="_blank" rel="noreferrer">Abrir no mapa</a></div>
            </div>
            <div className="map-card">
              <iframe title="Mapa da Barbearia 35" src="https://www.google.com/maps?q=Barbearia%2035%20Goi%C3%A1s&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <div className="map-label"><Image src="/images/logo-barbearia-35.png" alt="" width={54} height={42} /><span><b>BARBEARIA 35</b><small>Toque no mapa para explorar</small></span></div>
            </div>
          </div>
        </section>

        <section className="closing-cta">
          <div className="container closing-content"><Image src="/images/logo-barbearia-35.png" alt="" width={112} height={84} /><p className="eyebrow">Seu horário. Seu estilo.</p><h2>Pronto para ficar<br /><em>na régua?</em></h2><p>Reserve em menos de 2 minutos e chegue sem esperar.</p><a className="button button-gold button-large" href="/agendar">Agendar meu horário <span aria-hidden="true">→</span></a></div>
        </section>
      </main>

      <footer id="contato" className="site-footer">
        <div className="container footer-grid">
          <div><a href="/" className="brand footer-brand"><Image src="/images/logo-barbearia-35.png" alt="" width={68} height={52} /><span><b>BARBEARIA</b><strong>35</strong></span></a><p>Tradição no corte.<br />Respeito pelo seu tempo.</p></div>
          <div><h3>Navegue</h3><a href="#sobre">Sobre</a><a href="#servicos">Cortes & preços</a><a href="#diferenciais">Diferenciais</a><a href="#localizacao">Localização</a></div>
          <div><h3>Atendimento</h3><a href={whatsappUrl} target="_blank" rel="noreferrer">(62) 99801-0121</a><span>Seg–Sex • 09h–19h</span><span>Sáb • 09h–18h</span></div>
          <div><h3>Área da equipe</h3><a href="/admin">Acessar painel administrativo</a><span>Gestão de agenda, serviços e pagamentos.</span></div>
        </div>
        <div className="container footer-bottom"><span>© {new Date().getFullYear()} Barbearia 35. Todos os direitos reservados.</span><span>Feito com cuidado, como cada corte.</span></div>
      </footer>
    </div>
  );
}
