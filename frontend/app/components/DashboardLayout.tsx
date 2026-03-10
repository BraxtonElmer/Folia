'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  BrainCircuit,
  DollarSign,
  AlertTriangle,
  Utensils,
  Building2,
  Vote,
  FileText,
  Leaf,
  Settings,
  Flame,
  Upload,
} from 'lucide-react';

const navItems = [
  { label: 'Overview', href: '/', icon: LayoutDashboard, section: 'Dashboard' },
  { label: 'Log Waste', href: '/log', icon: ClipboardList, section: 'Dashboard' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, section: 'Intelligence' },
  { label: 'Forecast', href: '/forecast', icon: BrainCircuit, section: 'Intelligence' },
  { label: 'ROI Impact', href: '/roi', icon: DollarSign, section: 'Intelligence' },
  { label: 'Expiry Alerts', href: '/expiry', icon: AlertTriangle, section: 'Operations' },
  { label: 'Menu Optimizer', href: '/menu', icon: Utensils, section: 'Operations' },
  { label: 'Benchmarking', href: '/benchmark', icon: Building2, section: 'Operations' },
  { label: 'Biogas Calc', href: '/biogas', icon: Flame, section: 'Operations' },
  { label: 'Student Votes', href: '/vote', icon: Vote, section: 'Engagement' },
  { label: 'Weekly Report', href: '/report', icon: FileText, section: 'Reports' },
  { label: 'Import CSV', href: '/import', icon: Upload, section: 'Admin' },
  { label: 'Settings', href: '/settings', icon: Settings, section: 'Admin' },
];

function Sidebar() {
  const pathname = usePathname();
  let currentSection = '';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Leaf size={20} color="var(--accent)" />
        <h1>Folia</h1>
        <span>beta</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const showSection = item.section !== currentSection;
          if (showSection) currentSection = item.section;

          return (
            <div key={item.href}>
              {showSection && (
                <div className="sidebar-section-label">{item.section}</div>
              )}
              <Link href={item.href} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                <Icon size={18} />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
