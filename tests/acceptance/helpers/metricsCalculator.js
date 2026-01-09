/**
 * Metrics Calculator
 * Reusable metrics calculation utilities
 * Single responsibility: metrics calculations only
 */

class MetricsCalculator {
  /**
   * Calculate percentile from array of values
   */
  percentile(values, p) {
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate p95 latency
   */
  p95Latency(latencies) {
    return this.percentile(latencies, 95);
  }

  /**
   * Calculate p50 latency (median)
   */
  p50Latency(latencies) {
    return this.percentile(latencies, 50);
  }

  /**
   * Calculate p99 latency
   */
  p99Latency(latencies) {
    return this.percentile(latencies, 99);
  }

  /**
   * Calculate average
   */
  average(values) {
    if (!values || values.length === 0) {
      return null;
    }
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate min
   */
  min(values) {
    if (!values || values.length === 0) {
      return null;
    }
    return Math.min(...values);
  }

  /**
   * Calculate max
   */
  max(values) {
    if (!values || values.length === 0) {
      return null;
    }
    return Math.max(...values);
  }

  /**
   * Calculate standard deviation
   */
  standardDeviation(values) {
    if (!values || values.length === 0) {
      return null;
    }

    const avg = this.average(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.average(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Calculate statistics for latency array
   */
  latencyStats(latencies) {
    return {
      count: latencies.length,
      min: this.min(latencies),
      max: this.max(latencies),
      average: this.average(latencies),
      p50: this.p50Latency(latencies),
      p95: this.p95Latency(latencies),
      p99: this.p99Latency(latencies),
      stdDev: this.standardDeviation(latencies)
    };
  }
}

export const metricsCalculator = new MetricsCalculator();
export default metricsCalculator;

