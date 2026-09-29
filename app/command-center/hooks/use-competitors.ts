'use client';

import { normalizeCompetitorBrand, normalizeCompetitorCreative, normalizeCompetitorJob } from '../helpers/competitors';
import type { CompetitorBrand, CompetitorCreative, CompetitorForm, CompetitorJob } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import { useLiveQuery, type RefreshOptions } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';

const emptyCompetitorForm: CompetitorForm = {
  name: '',
  category: 'direct',
  metaPageId: '',
  homepageUrl: '',
  notes: '',
};

export function useCompetitors({ supabase, activeProductId, userId }: { supabase: SupabaseClient; activeProductId: string; userId: string }) {
  const [brands, setBrands] = useReconciledState<CompetitorBrand[]>([]);
  const [jobs, setJobs] = useReconciledState<CompetitorJob[]>([]);
  const [creatives, setCreatives] = useReconciledState<CompetitorCreative[]>([]);
  const [view, setView] = useState<'approved' | 'all' | 'pending'>('approved');
  const [form, setForm] = useState<CompetitorForm>(emptyCompetitorForm);
  const [showForm, setShowForm] = useState(false);
  const [loadedAt, setLoadedAt] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const { refresh, busy, error: syncError, mutate } = useLiveQuery({
    supabase,
    productId: activeProductId,
    tables: ['competitor_brands', 'competitor_research_queue', 'competitor_creatives'],
    enabled: Boolean(activeProductId),
    load,
    onMutationError: setError,
    onMutationEnd: () => setBusyAction(''),
  });

  async function reload(options: { notice?: string } = {}) {
    setError('');
    if (options.notice) setNotice(options.notice);
    await refresh();
  }

  async function load(signal: AbortSignal, options: RefreshOptions) {
    const [brandsResult, jobsResult, creativesResult] = await Promise.all([
      supabase.from('competitor_brands').select('*').abortSignal(signal).eq('product_id', activeProductId).order('approved', { ascending: false }).order('name', { ascending: true }),
      supabase.from('competitor_research_queue').select('*').abortSignal(signal).eq('product_id', activeProductId).order('created_at', { ascending: false }).limit(200),
      supabase.from('competitor_creatives').select('*').abortSignal(signal).eq('product_id', activeProductId).order('rank_in_brand', { ascending: true }).limit(1000),
    ]);
    if (brandsResult.error || jobsResult.error || creativesResult.error) throw new Error('Some Competitors data could not be loaded. The QA database may still need the competitor tables/migrations.');
    return () => {
      setBrands(Array.isArray(brandsResult.data) ? brandsResult.data.map(normalizeCompetitorBrand) : []);
      setJobs(Array.isArray(jobsResult.data) ? jobsResult.data.map(normalizeCompetitorJob) : []);
      setCreatives(Array.isArray(creativesResult.data) ? creativesResult.data.map(normalizeCompetitorCreative) : []);
      if (!options.background) setLoadedAt(new Date().toISOString());
    };
  }

  async function saveBrand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('Brand name required.');
      return;
    }
    setBusyAction('save-brand');
    const metaAdLibraryUrl = form.metaPageId.trim()
      ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(form.metaPageId.trim())}`
      : null;
    const result = await supabase.from('competitor_brands').insert({
      id: `cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      product_id: activeProductId,
      name,
      category: form.category,
      meta_page_id: form.metaPageId.trim() || null,
      meta_ad_library_url: metaAdLibraryUrl,
      homepage_url: form.homepageUrl.trim() || null,
      notes: form.notes.trim() || null,
      approved: false,
    });
    setBusyAction('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setForm(emptyCompetitorForm);
    setShowForm(false);
    await reload({ notice: `Added ${name}.` });
  }

  async function toggleApproved(brand: CompetitorBrand) {
    const approved = !brand.approved;
    setBusyAction(`approve:${brand.id}`);
    const result = await supabase.from('competitor_brands').update({
      approved,
      approved_at: approved ? new Date().toISOString() : null,
      approved_by: approved ? userId : null,
    }).eq('id', brand.id).eq('product_id', activeProductId);
    setBusyAction('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await reload({ notice: `${brand.name} ${approved ? 'approved' : 'unapproved'}.` });
  }

  async function deleteBrand(brand: CompetitorBrand) {
    if (!window.confirm(`Delete "${brand.name}" from the competitor list? Existing researched creatives are not removed.`)) return;
    setBusyAction(`delete:${brand.id}`);
    const result = await supabase.from('competitor_brands').delete().eq('id', brand.id).eq('product_id', activeProductId);
    setBusyAction('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await reload({ notice: `${brand.name} deleted.` });
  }

  async function enqueue(jobType: string, brand?: CompetitorBrand) {
    if (brand && !brand.approved) {
      setError('Approve the brand before running creative research.');
      return;
    }
    const label = jobType === 'discover_brands'
      ? 'brand discovery'
      : jobType === 'generate_recommendations'
        ? 'strategist recommendations'
        : `creative research for ${brand?.name || 'brand'}`;
    if (!window.confirm(`Queue ${label}? A worker must be running to process this.`)) return;
    setBusyAction(`queue:${jobType}:${brand?.id || 'product'}`);
    const result = await supabase.from('competitor_research_queue').insert({
      product_id: activeProductId,
      brand_id: brand?.id || null,
      job_type: jobType,
      status: 'pending',
    });
    setBusyAction('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await reload({ notice: `${label} queued.` });
  }

  const approvedCount = brands.filter((brand) => brand.approved).length;
  const pendingCount = brands.length - approvedCount;
  const directCount = brands.filter((brand) => brand.category === 'direct').length;
  const indirectCount = brands.filter((brand) => brand.category === 'indirect').length;
  const similarCount = brands.filter((brand) => brand.category === 'similar_niche').length;
  const activeJobs = jobs.filter((job) => ['pending', 'claimed', 'running'].includes(job.status));
  const filteredBrands = brands.filter((brand) => {
    if (view === 'approved') return brand.approved;
    if (view === 'pending') return !brand.approved;
    return true;
  });
  const buckets = [
    { id: 'direct', title: 'Direct', subtitle: 'Same offer, same audience', rows: filteredBrands.filter((brand) => brand.category === 'direct') },
    { id: 'indirect', title: 'Indirect', subtitle: 'Different offer, same audience', rows: filteredBrands.filter((brand) => brand.category === 'indirect') },
    { id: 'similar_niche', title: 'Similar niche', subtitle: 'Adjacent mechanics to borrow', rows: filteredBrands.filter((brand) => brand.category === 'similar_niche') },
  ];

  return {
    brands,
    approvedCount,
    activeJobs,
    busyAction: busyAction || (busy ? 'reload' : ''),
    reload,
    setShowForm,
    showForm,
    enqueue: mutate(enqueue),
    notice,
    error: error || syncError,
    directCount,
    indirectCount,
    similarCount,
    pendingCount,
    loadedAt,
    view,
    setView,
    saveBrand: mutate(saveBrand),
    form,
    setForm,
    buckets,
    creatives,
    jobs,
    toggleApproved: mutate(toggleApproved),
    deleteBrand: mutate(deleteBrand),
  };
}
