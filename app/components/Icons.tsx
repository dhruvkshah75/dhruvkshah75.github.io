export function Arrow({ diagonal = false, className = "" }: { diagonal?: boolean; className?: string }) {
  return <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg>;
}

export function Cross({ className = "" }: { className?: string }) {
  return <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M5 15 15 5" stroke="currentColor" strokeWidth="1.5" /></svg>;
}
