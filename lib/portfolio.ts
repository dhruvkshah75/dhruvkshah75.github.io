export type StopId = "about" | "projects" | "journey" | "contact";

export const profile = {
  name: "Dhruv Shah",
  title: "Software developer",
  university: "BITS Pilani, Goa",
  location: "Mumbai, India",
  github: "https://github.com/dhruvkshah75",
  linkedin: "https://www.linkedin.com/in/dhruv-shah-31a136207/",
  email: "dhruvkshah75@gmail.com",
  intro: "I build backend systems, developer tools, and things I’m curious about. Currently studying at BITS Pilani, Goa, with a focus on distributed systems and backend architecture.",
  more: "I enjoy understanding how things work, then building and improving them one step at a time. My projects take those ideas into background task processing, developer tools, and multiplayer networking.",
  languages: ["C++", "Go", "Python", "Rust", "C", "TypeScript"],
  tools: ["PostgreSQL", "Redis", "Docker", "Bash"],
  databases: ["PostgreSQL", "Redis", "MySQL"],
  infrastructure: ["Docker", "Kubernetes"],
  frameworks: ["FastAPI", "Django"],
};

export const stops: { id: StopId; name: string; z: number; side: number; progress: number }[] = [
  { id: "about", name: "About Me", z: -9, side: -1, progress: 0.11 },
  { id: "projects", name: "Projects", z: -39, side: 1, progress: 0.34 },
  { id: "journey", name: "Experience", z: -72, side: -1, progress: 0.60 },
  { id: "contact", name: "Contact Me", z: -105, side: 1, progress: 0.86 },
];

export type Project = {
  name: string;
  description: string;
  language: string;
  stack: string[];
  category: "Systems" | "AI" | "Games" | "Tools";
  url: string;
  demo?: string;
  pinned: boolean;
  status?: string;
};

// Public GitHub pins verified on 6 November 2026. Run npm run sync:github to refresh.
export const projects: Project[] = [
  {
    "name": "TaskFlow",
    "description": "Distributed background task processing. Built for scalable, asynchronous workloads.",
    "language": "Python",
    "stack": ["Python", "Docker", "Kubernetes", "FastAPI"],
    "category": "Systems",
    "url": "https://github.com/dhruvkshah75/TaskFlow",
    "demo": "https://taskflow-io.vercel.app",
    "pinned": true
  },
  {
    "name": "oxidrop",
    "description": "Fast wireless file sync between Linux and mobile devices.",
    "language": "Rust",
    "stack": ["Rust", "WebDAV server"],
    "category": "Tools",
    "url": "https://github.com/dhruvkshah75/oxidrop",
    "pinned": true
  },
  {
    "name": "gamesync",
    "description": "A real-time multiplayer game server in Go for state synchronisation and concurrent player communication",
    "language": "Go",
    "stack": ["Go", "Sockets"],
    "category": "Games",
    "url": "https://github.com/dhruvkshah75/gamesync",
    "pinned": true,
    "status": "In progress"
  },
  {
    "name": "groundtruth",
    "description": "An AI agent that checks beliefs against reality, detects conflicts, and reasons across perspectives.",
    "language": "Python",
    "stack": ["Python", "SQLite", "NetworkX"],
    "category": "AI",
    "url": "https://github.com/dhruvkshah75/groundtruth",
    "pinned": true
  },
  {
    "name": "cfast",
    "description": "Import Codeforces samples, compile C++ solutions, and check outputs, time, and memory.",
    "language": "Python",
    "stack": ["Python", "CLI"],
    "category": "Tools",
    "url": "https://github.com/dhruvkshah75/cfast",
    "demo": "https://cfast.vercel.app",
    "pinned": true
  },
  {
    "name": "OShell",
    "description": "A Unix style shell written from scratch in C.",
    "language": "C",
    "stack": ["C"],
    "category": "Systems",
    "url": "https://github.com/dhruvkshah75/OShell",
    "pinned": false
  },
  {
    "name": "docstream",
    "description": "Turn static PDF archives into an interactive, searchable AI knowledge base.",
    "language": "Python",
    "stack": ["Python"],
    "category": "AI",
    "url": "https://github.com/dhruvkshah75/docstream",
    "pinned": false
  }
];

export const experience: { company: string; role: string; dates?: string; description: string }[] = [
  {
    company: "GenQuery Technologies Pvt. Ltd.",
    role: "Undergraduate Research Intern",
    description: "Working on a parameterized Text-to-SQL benchmark aimed at systematically evaluating the capabilities of language models in translating natural-language questions into SQL queries across varying levels of complexity.",
  },
];
