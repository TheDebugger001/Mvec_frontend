import { reportsApi } from '../API';

const PERIOD_TO_RANGE = {
  Today: '24h',
  'Today': '24h',
  '7 Days': '7d',
  '30 Days': '30d',
  '3 Months': '90d',
  '6 Months': '90d',
  '1 Year': '1y',
};

export function normalizePeriod(period = '30 Days') {
  return PERIOD_TO_RANGE[period] ? period : '30 Days';
}

export function periodRange(period = '30 Days') {
  return PERIOD_TO_RANGE[normalizePeriod(period)] || '30d';
}

export async function getReportSummary(period = '30 Days') {
  const range = periodRange(period);
  const res = await reportsApi.getSummary({ range }).catch((e) => null);
  return {
    range,
    period: normalizePeriod(period),
    metrics: (res && res.metrics) || {},
  };
}

export async function getRevenueSeries(period = '30 Days') {
  const range = periodRange(period);
  const res = await reportsApi.getRevenueSeries({ range }).catch((e) => null);
  return {
    range,
    labels: (res && res.labels) || [],
    series: (res && res.series) || [],
  };
}

export async function getPeriodMetrics(period = '30 Days') {
  const { metrics } = await getReportSummary(period);
  const sales = Number(metrics.grossSales || 0);
  const orderCount = Number(metrics.orders || 0);
  return {
    sales,
    orders: orderCount,
    avgOrder: orderCount > 0 ? Math.round(sales / orderCount) : 0,
    customers: Number(metrics.customers || 0),
    activeVendors: Number(metrics.activeVendors || 0),
    lowStockProducts: Number(metrics.lowStockProducts || 0),
    paymentVolume: Number(metrics.paymentVolume || 0),
  };
}

export async function getPeriodChart(period = '30 Days') {
  const { series } = await getRevenueSeries(period);
  return series;
}

export async function getPeriodLabels(period = '30 Days') {
  const { labels } = await getRevenueSeries(period);
  return labels;
}

export function trendFromSeries(series = []) {
  if (!series || series.length < 2) return 0;
  const first = Number(series[0]) || 0;
  const last = Number(series[series.length - 1]) || 0;
  if (first <= 0) return last > 0 ? 100 : 0;
  return Math.round(((last - first) / first) * 100);
}