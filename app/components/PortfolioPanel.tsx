"use client";

import { type ReactNode, type PointerEvent } from "react";
import { experience, profile, projects, type Project, type StopId } from "@/lib/portfolio";
import { Arrow } from "./Icons";

function DetailPage({ number, title, className = "", children }: { number: string; title: string; className?: string; children: ReactNode }) {
  return <section className={`detail-page ${className}`}>
    <div className="detail-heading"><span className="page-number">{number}</span><h2>{title}<span>.</span></h2></div>
    <div className="detail-body">{children}</div>
  </section>;
}

function ContactLinks() {
  return <div className="contact-links" aria-label="Contact and profiles">{[
    { label: "Email", detail: "Send a message", href: `mailto:${profile.email}` },
    { label: "GitHub", detail: "View my work", href: profile.github },
    { label: "LinkedIn", detail: "Let’s connect", href: profile.linkedin },
  ].map(link => <a key={link.label} href={link.href} {...(link.href.startsWith("https:") ? { target: "_blank", rel: "noopener noreferrer" } : {})}><span className="contact-link-title">{link.label}<Arrow diagonal /></span><span className="contact-link-detail">{link.detail}</span></a>)}</div>;
}

function About() {
  return <DetailPage number="01" title="About Me" className="about-page">
    <p className="detail-lead">{profile.intro}</p>
    <p className="about-more">{profile.more}</p>
    <div className="skills-grid">{[
      { label: "Languages", items: profile.languages },
      { label: "Databases", items: profile.databases },
      { label: "Infrastructure", items: profile.infrastructure },
      { label: "Frameworks", items: profile.frameworks },
    ].map(({ label, items }) => <div className="skill-group" key={label}><h3>{label}</h3><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></div>)}</div>
  </DetailPage>;
}

function ProjectGlyph({ project }: { project: Project }) {
  return <svg className="project-glyph" width="48" height="40" viewBox="0 0 48 40" fill="none" aria-hidden="true">
    {project.category === "Systems" ? <><path className="glyph-track" d="M9 20h13M22 20V8h16M22 20v12h16" /><rect className="glyph-node" x="3" y="15" width="10" height="10" /><rect className="glyph-node glyph-node-2" x="34" y="4" width="8" height="8" /><rect className="glyph-node glyph-node-3" x="34" y="28" width="8" height="8" /></> :
      project.category === "AI" ? <><path className="glyph-track" d="m24 20-15-12m15 12L9 32m15-12L39 8m-15 12 15 12" /><rect className="glyph-node" x="19" y="15" width="10" height="10" /><rect className="glyph-node glyph-node-2" x="5" y="4" width="8" height="8" /><rect className="glyph-node glyph-node-3" x="35" y="4" width="8" height="8" /><rect className="glyph-node glyph-node-2" x="5" y="28" width="8" height="8" /><rect className="glyph-node glyph-node-3" x="35" y="28" width="8" height="8" /></> :
      project.category === "Games" ? <><path className="glyph-track" d="M10 10h28v4h4v18H30l-4-4h-4l-4 4H6V14h4V10Z" /><path className="glyph-node" d="M12 20h12m-6-6v12" /><rect className="glyph-node glyph-node-2" x="31" y="16" width="3" height="3" /><rect className="glyph-node glyph-node-3" x="35" y="22" width="3" height="3" /></> :
      project.name === "cfast" ? <><path className="glyph-track" d="M4 7h40v27H4V7Zm0 7h40" /><path className="glyph-node" d="m11 20 5 4-5 4m10 0h10" /><path className="glyph-node glyph-node-2" d="M9 11h2m3 0h2" /></> : <><path className="glyph-track" d="M4 5h12l7 7v18H4V5Zm12 0v8h7m9-3h12v25H25v-6" /><path className="glyph-node" d="M14 21h22m-6-5 6 5-6 5" /></>}
  </svg>;
}

function ProjectCard({ project: p, index }: { project: Project; index: number }) {
  function illuminate(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  }
  return <article className="project" onPointerMove={illuminate}>
    <div className="project-topline"><span className="project-number">{String(index + 1).padStart(2, "0")}</span><span className="project-category">{p.category}</span>{p.status && <span className="project-status"><span />{p.status}</span>}</div>
    <div className="project-identity"><ProjectGlyph project={p} /><span className="project-source-hint">View source <Arrow diagonal /></span></div>
    <h3><a href={p.url} target="_blank" rel="noopener noreferrer">{p.name}<Arrow diagonal /></a></h3>
    <p>{p.description}</p>
    <div className="project-bottom"><ul className="project-stack" aria-label={`${p.name} technologies`}>{p.stack.map(tech => <li key={tech}>{tech}</li>)}</ul>{p.demo && <a className="demo-link" href={p.demo} target="_blank" rel="noopener noreferrer">Visit project <Arrow diagonal /></a>}</div>
    <span className="project-edge" aria-hidden="true" />
  </article>;
}

function Projects() {
  const visible = projects.filter(p => p.pinned);
  return <DetailPage number="02" title="Projects" className="projects-page">
    <div className="projects-intro"><p className="detail-lead">A selection of systems, tools,<br className="desktop-break" /> and experiments from my GitHub.</p></div>
    <div className="project-list">{visible.map((p, i) => <ProjectCard key={p.name} project={p} index={i} />)}</div>
  </DetailPage>;
}

function Experience() {
  return <DetailPage number="03" title="Experience" className="experience-page">
    <p className="detail-lead">Learning by building, one problem at a time.</p>
    <div className="timeline">
      {experience.map(e => <article key={`${e.company}-${e.role}`}><span className="timeline-dot" /><span className="section-label">{e.dates ?? "Research experience"}</span><h3>{e.role}</h3><h4>{e.company}</h4><p>{e.description}</p></article>)}
      <article><span className="timeline-dot" /><span className="section-label">Education</span><h3>{profile.university}</h3><p>Operating Systems, Data Structures and Algorithms, Computer Programming, Database Systems, Distributed Systems, and Backend Architecture.</p></article>
    </div>
    <a className="text-link" href={profile.linkedin} target="_blank" rel="noopener noreferrer">Connect on LinkedIn <Arrow diagonal /></a>
  </DetailPage>;
}

function Contact() {
  return <DetailPage number="04" title="Contact Me" className="contact-page">
    <p className="detail-lead">An idea, an interesting problem, or a simple hello. I’d love to hear from you.</p>
    <ContactLinks />
  </DetailPage>;
}

export default function PortfolioPanel({ page }: { page: StopId }) {
  return page === "about" ? <About /> : page === "projects" ? <Projects /> : page === "journey" ? <Experience /> : <Contact />;
}
