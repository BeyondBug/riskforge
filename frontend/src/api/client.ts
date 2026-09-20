/**
 * API client. Every figure rendered in the UI comes from these responses;
 * the frontend performs no risk arithmetic of its own.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export const DISCLAIMER =
  'Modeled estimates based on supplied inputs. Not a guarantee of actual losses.'

export interface LikelihoodBreakdown {
  norm_cvss: number
  exploitability: number
  patch_age_score: number
  exposure_score: number
  control_gap: number
  threat_intel_score: number
  weighted_terms: Record<string, number>
  likelihood: number
}

export interface LossBreakdown {
  downtime_inr: number
  incident_response_inr: number
  recovery_inr: number
  data_breach_inr: number
  regulatory_inr: number
  reputation_inr: number
  loss_magnitude_inr: number
  formulas: Record<string, string>
}

export interface RiskResult {
  finding_id: string
  asset_id: string
  asset_name: string
  title: string
  cve_id: string | null
  severity_score: number
  likelihood: LikelihoodBreakdown
  loss: LossBreakdown
  eal_inr: number
}

export interface Assessment {
  assessment_id: string
  created_at: string
  dataset_label: string
  model_version: string
  results: RiskResult[]
  total_eal_inr: number
  assets_at_risk: number
  findings_count: number
  eal_by_asset_inr: Record<string, number>
  disclaimer: string
}

export interface FindingRow {
  finding_id: string
  asset_id: string
  asset_name: string
  title: string
  cve_id: string | null
  severity_score: number
  score_source: string
  exposure: string | null
  days_open: number | null
  status: string | null
  likelihood: number
  loss_magnitude_inr: number
  eal_inr: number
}

export interface SelectedControl {
  control_id: string
  name: string
  asset_id: string
  finding_id: string
  cost_inr: number
  eal_reduction_inr: number
  eal_reduction_pct: number
  roi: number
}

export interface OptimizationResult {
  assessment_id: string
  budget_inr: number
  solver: string
  selected: SelectedControl[]
  rejected: SelectedControl[]
  total_cost_inr: number
  budget_remaining_inr: number
  total_eal_reduction_inr: number
  eal_before_inr: number
  eal_after_inr: number
  reduction_pct_of_portfolio: number
  disclaimer: string
}

export interface AdvisorResponse {
  question: string
  answer: string
  mode: string
  /** Coarse, non-leaking explanation of why the model path was unavailable. */
  reason: string | null
  context_used: Record<string, unknown>
  notice: string
  disclaimer: string
}

export interface ReportReference {
  storage: string
  key: string
  download_url: string
  expires_in_seconds: number | null
  assessment_id: string
  size_bytes: number
  generated_at: string
  includes_optimization: boolean
}

export interface DependencyStatus {
  status: string
  version: string
  region: string
  environment: string
  dynamodb: { mode: string }
  s3: { mode: string }
  bedrock: { mode: string; last_invocation: string | null }
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20_000)
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
      signal: init?.signal ?? controller.signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new ApiError('The request timed out. Please try again.', 408)
    }
    throw new ApiError('The API could not be reached. Please try again.', 0)
  } finally {
    window.clearTimeout(timeout)
  }
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`
    try {
      const body = await response.json()
      detail = body.detail ?? body.error ?? detail
    } catch {
      /* response had no JSON body; keep the status message */
    }
    throw new ApiError(typeof detail === 'string' ? detail : JSON.stringify(detail), response.status)
  }
  return (await response.json()) as T
}

export const api = {
  health: () => request<{ status: string }>('/api/health'),
  deps: () => request<DependencyStatus>('/api/health/deps'),
  assessment: () => request<Assessment>('/api/assessments/current'),
  recompute: () => request<Assessment>('/api/assessments', { method: 'POST' }),
  findings: () =>
    request<{ count: number; findings: FindingRow[]; disclaimer: string }>(
      '/api/findings',
    ),
  optimize: (budget_inr: number, assessment_id?: string) =>
    request<OptimizationResult>('/api/optimize', {
      method: 'POST',
      body: JSON.stringify({ budget_inr, assessment_id }),
    }),
  currentOptimization: () => request<OptimizationResult>('/api/optimizations/current'),
  ask: (question: string) =>
    request<AdvisorResponse>('/api/advisor', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  generateReport: () =>
    request<ReportReference>('/api/reports/generate', { method: 'POST' }),
}

/** Indian digit grouping, no decimals. */
export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

/** Compact form for headline figures: crore above 1e7, lakh above 1e5. */
export function formatINRShort(amount: number): string {
  if (Math.abs(amount) >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`
  if (Math.abs(amount) >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`
  return formatINR(amount)
}
