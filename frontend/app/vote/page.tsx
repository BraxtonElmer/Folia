'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, Leaf, MapPin } from 'lucide-react';
import { fetchCanteens, fetchItems, fetchVotes, castVoteAPI } from '../lib/api';

export default function VotePage() {
  const [mounted, setMounted] = useState(false);
  const [canteens, setCanteens] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [selectedCanteen, setSelectedCanteen] = useState('');
  const [votes, setVotes] = useState<any[]>([]);
  const [votedItems, setVotedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    Promise.all([fetchCanteens(), fetchItems()])
      .then(([c, i]) => {
        setCanteens(c);
        setItems(i);
        if (c.length > 0) setSelectedCanteen(c[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedCanteen) return;
    setLoading(true);
    fetchVotes()
      .then(v => { setVotes(v); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedCanteen]);

  if (!mounted) return <div style={{ padding: 40 }}>Loading...</div>;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayName = tomorrow.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });

  const canteenItems = items.filter(f => f.canteen_id === selectedCanteen);
  const totalVotes = votes.filter(v => v.canteen_id === selectedCanteen).reduce((s: number, v: any) => s + v.count, 0);

  const handleVote = async (itemId: string) => {
    if (votedItems.has(itemId)) return;
    await castVoteAPI(selectedCanteen, itemId);
    setVotedItems(new Set([...votedItems, itemId]));
    // Refresh votes
    const updated = await fetchVotes();
    setVotes(updated);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', padding: 'var(--space-4) var(--space-8)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-3">
            <Leaf size={20} color="var(--accent)" />
            <span className="font-semibold">ZeroWaste</span>
            <span className="badge badge-success">Student Portal</span>
          </div>
          <span className="text-xs text-muted">Your vote helps reduce food waste</span>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-8)' }}>
        <div className="animate-in">
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-tight)' }}>
            What are you eating tomorrow?
          </h2>
          <p className="text-secondary" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
            {dayName} — Vote for the items you plan to eat. This helps our canteens prepare the right amount and reduce waste.
          </p>
        </div>

        <div className="flex items-center gap-3 mt-6 mb-6">
          <MapPin size={16} className="text-muted" />
          <span className="text-sm text-muted">I&apos;ll eat at:</span>
          <div className="tag-list">
            {canteens.map(c => (
              <button key={c.id} className={`tag ${selectedCanteen === c.id ? 'selected' : ''}`} onClick={() => setSelectedCanteen(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="card card-sm mb-4 animate-in" style={{ background: 'var(--accent-light)', border: '1px solid rgba(91,140,90,0.15)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--accent-dark)' }}>{totalVotes} students have voted so far</span>
            <span className="text-xs text-muted">{votedItems.size} of your votes cast</span>
          </div>
        </div>

        {loading ? (
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><span className="text-muted">Loading...</span></div>
        ) : (
          <div className="flex flex-col gap-3">
            {canteenItems.map(item => {
              const vote = votes.find((v: any) => v.item_id === item.id);
              const count = vote?.count ?? 0;
              const hasVoted = votedItems.has(item.id);

              return (
                <div key={item.id} className="vote-card animate-in">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted mt-1">{item.category} · ₹{item.cost_per_portion}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="vote-count">{count}</div>
                    <button className={`btn ${hasVoted ? 'btn-secondary' : 'btn-primary'} btn-sm`} onClick={() => handleVote(item.id)} disabled={hasVoted} style={hasVoted ? { opacity: 0.5 } : {}}>
                      <ThumbsUp size={14} />{hasVoted ? 'Voted' : 'Vote'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-muted">
          <p>Your votes are anonymous and help canteen staff prepare the right amount of food.</p>
          <p className="mt-1">Every vote helps reduce food waste and saves resources. 🌍</p>
        </div>
      </div>
    </div>
  );
}
