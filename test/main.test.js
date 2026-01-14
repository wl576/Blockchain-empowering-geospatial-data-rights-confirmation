const mocha = require('mocha');
const fs = require('fs-extra');
const path = require('path');
const AdvancedImageProcessor = require('./utils/imageProcessor');

async function runRobustnessTests() {
  console.log(' 开始鲁棒水印测试...\n');
  
  const startTime = Date.now();
  const imageProcessor = new AdvancedImageProcessor();
  const testResults = {
    accuracy: { passes: 0, failures: 0, details: [] },
    performance: { passes: 0, failures: 0, details: [] },
    robustness: { passes: 0, failures: 0, details: [] }
  };

  try {
    // 检查测试图像
    const testImages = [
      './tif/test_image1.tif',
      './tif/test_image2.tif',
      './tif/test_image3.tif'
    ].filter(fs.pathExistsSync);

    console.log(`找到 ${testImages.length} 张测试图像`);

    // 运行准确性测试
    console.log('\n 运行权属判定准确率测试...');
    try {
      const Mocha = require('mocha');
      const mocha = new Mocha();
      mocha.addFile(path.join(__dirname, 'accuracy.test.js'));
      
      const runner = mocha.run();
      runner.on('end', () => {
        testResults.accuracy.passes = runner.stats.passes;
        testResults.accuracy.failures = runner.stats.failures;
      });
    } catch (error) {
      console.error('准确性测试失败:', error);
    }

    // 执行批量鲁棒性测试
    console.log('\n 执行批量鲁棒性测试...');
    const testAccounts = ['0xUser1', '0xUser2', '0xUser3', '0xUser4', '0xUser5'];
    const batchResults = await imageProcessor.batchRobustnessTest(testImages, testAccounts);
    
    testResults.robustness.passes = batchResults.passedImages;
    testResults.robustness.failures = batchResults.totalImages - batchResults.passedImages;
    testResults.robustness.details = batchResults.detailedResults;

    // 生成最终报告
    const testDuration = Date.now() - startTime;
    const finalReport = imageProcessor.generateTestReport(batchResults, testDuration);
    
    // 保存详细报告
    const reportPath = path.join(__dirname, '../watermark-robustness-report.json');
    await fs.writeJson(reportPath, finalReport, { spaces: 2 });
    
    console.log('\n 测试完成!');
    console.log('=' .repeat(50));
    console.log(`总测试时间: ${(testDuration / 1000).toFixed(2)} 秒`);
    console.log(`测试图像: ${batchResults.totalImages} 张`);
    console.log(`通过图像: ${batchResults.passedImages} 张`);
    console.log(`通过率: ${(batchResults.passRate * 100).toFixed(1)}%`);
    console.log(`平均鲁棒性: ${batchResults.averageRobustness.toFixed(4)}`);
    console.log(`详细报告: ${reportPath}`);
    console.log('=' .repeat(50));
    
    // 输出改进建议
    if (finalReport.recommendations.length > 0) {
      console.log('\n 改进建议:');
      finalReport.recommendations.forEach(rec => console.log(`- ${rec}`));
    }

    return finalReport;

  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runRobustnessTests().catch(console.error);
}

module.exports = runRobustnessTests;