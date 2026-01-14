class MetricsCalculator {
  constructor() {
    this.results = {
      ownershipAccuracy: 0,
      allocationTime: 0,
      changeTrackingCompleteness: 0,
      violationDetectionRate: 0
    };
  }

  // 计算权属判定准确率
  calculateOwnershipAccuracy(truePositives, falsePositives, falseNegatives) {
    const precision = truePositives / (truePositives + falsePositives);
    const recall = truePositives / (truePositives + falseNegatives);
    const f1Score = 2 * (precision * recall) / (precision + recall);
    
    this.results.ownershipAccuracy = f1Score;
    return f1Score;
  }

  // 计算利益分配时间
  calculateAllocationTime(startTime, endTime, transactionCount) {
    const totalTime = endTime - startTime;
    const avgTimePerTransaction = totalTime / transactionCount;
    
    this.results.allocationTime = avgTimePerTransaction;
    return avgTimePerTransaction;
  }

  // 计算权属变更追踪完整率
  calculateChangeTrackingCompleteness(recordedChanges, actualChanges) {
    const completeness = recordedChanges / actualChanges;
    
    this.results.changeTrackingCompleteness = completeness;
    return completeness;
  }

  // 计算违规识别率
  calculateViolationDetectionRate(detectedViolations, totalViolations) {
    const detectionRate = detectedViolations / totalViolations;
    
    this.results.violationDetectionRate = detectionRate;
    return detectionRate;
  }

  // 生成性能报告
  generatePerformanceReport() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.results,
      summary: {
        overallScore: Object.values(this.results).reduce((a, b) => a + b, 0) / Object.keys(this.results).length,
        status: this.results.ownershipAccuracy > 0.9 ? 'EXCELLENT' : 
                this.results.ownershipAccuracy > 0.7 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      }
    };
  }
}

module.exports = MetricsCalculator;