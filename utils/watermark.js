const Jimp = require('jimp');
const crypto = require('crypto-js');
const fs = require('fs-extra');
const blockchainManager = require('./blockchain');

class FixedDCTWatermark {
  constructor(blockchainManager) {
    this.alpha = 0.5;
    this.blockSize = 8;
    this.embeddingPositions = [
      [3, 3], [3, 4], [4, 3], [4, 4]
    ];
    this.blockchain = blockchainManager;
  }

  // 修复DCT实现 
  dct1D(signal) {
    const N = signal.length;
    const result = new Array(N);
    const factor = Math.PI / N;

    for (let k = 0; k < N; k++) {
      let sum = 0;
      for (let n = 0; n < N; n++) {
        // 确保数值稳定性
        const cosValue = Math.cos(factor * (n + 0.5) * k);
        sum += signal[n] * cosValue;
      }
      const scale = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
      result[k] = parseFloat(sum * scale).toFixed(6); // 固定精度
    }
    return result.map(Number);
  }

  idct1D(coefficients) {
    const N = coefficients.length;
    const result = new Array(N);
    const factor = Math.PI / N;

    for (let n = 0; n < N; n++) {
      let sum = coefficients[0] * Math.sqrt(1 / N);
      for (let k = 1; k < N; k++) {
        const cosValue = Math.cos(factor * (n + 0.5) * k);
        sum += coefficients[k] * Math.sqrt(2 / N) * cosValue;
      }
      result[n] = parseFloat(sum).toFixed(6); // 固定精度
    }
    return result.map(Number);
  }

  dct2D(block) {
    const N = this.blockSize;
    const temp = new Array(N);
    
    // 对每一行进行DCT
    for (let i = 0; i < N; i++) {
      const row = block.slice(i * N, (i + 1) * N);
      temp[i] = this.dct1D(row);
    }
    
    // 对每一列进行DCT
    const result = new Array(N);
    for (let i = 0; i < N; i++) {
      result[i] = new Array(N);
    }
    
    for (let j = 0; j < N; j++) {
      const col = [];
      for (let i = 0; i < N; i++) {
        col.push(temp[i][j]);
      }
      const dctCol = this.dct1D(col);
      for (let i = 0; i < N; i++) {
        result[i][j] = dctCol[i];
      }
    }
    
    return result;
  }

  idct2D(coefficients) {
    const N = this.blockSize;
    const temp = new Array(N);
    
    // 对每一列进行IDCT
    for (let j = 0; j < N; j++) {
      const col = [];
      for (let i = 0; i < N; i++) {
        col.push(coefficients[i][j]);
      }
      temp[j] = this.idct1D(col);
    }
    
    // 对每一行进行IDCT
    const result = new Array(N * N);
    for (let i = 0; i < N; i++) {
      const row = [];
      for (let j = 0; j < N; j++) {
        row.push(temp[j][i]);
      }
      const idctRow = this.idct1D(row);
      for (let j = 0; j < N; j++) {
        result[i * N + j] = Math.round(idctRow[j]); // 四舍五入到整数
      }
    }
    
    return result;
  }

  // 改进水印信息生成 - 使用更简单的数据结构
  // 修改水印信息生成，确保 blockchainData 总是存在
  generateWatermarkInfo(ownerAddress, imageHash, blockchainData = null) {
      const timestamp = Math.floor(Date.now() / 1000);
        
      // 确保 blockchainData 有默认值
      const safeBlockchainData = blockchainData || {
          registered: false,
          dataId: '',
          txHash: '',
          dataHash: '0x0'
      };

      const watermarkData = {
          o: ownerAddress.substring(2, 10),
          t: timestamp,
          h: imageHash.substring(0, 8),
          v: '2',
          bc: {
              registered: safeBlockchainData.registered || false,
              dataId: safeBlockchainData.dataId || '',
              txHash: safeBlockchainData.txHash || '',
              dataHash: safeBlockchainData.dataHash || '0x0'
          }
      };

      const encodedString = JSON.stringify(watermarkData);
        
      return {
          rawData: watermarkData,
          encodedString: encodedString,
          hash: crypto.SHA256(encodedString).toString(),
          blockchainData: safeBlockchainData  // 确保总是返回安全的 blockchainData
      };
  }

  // 改进比特编码 - 添加校验和
  encodeWatermarkBits(watermarkInfo) {
    const jsonString = watermarkInfo.encodedString;
    const bits = [];
    
    // 同步序列 (16位) - 更独特的模式
    const preamble = '1100110000110011';
    for (let i = 0; i < preamble.length; i++) {
      bits.push(parseInt(preamble[i]));
    }
    
    // 数据长度 (16位)
    const lengthBits = jsonString.length.toString(2).padStart(16, '0');
    for (let i = 0; i < lengthBits.length; i++) {
      bits.push(parseInt(lengthBits[i]));
    }
    
    // 数据内容
    for (let i = 0; i < jsonString.length; i++) {
      const charCode = jsonString.charCodeAt(i);
      for (let j = 7; j >= 0; j--) {
        bits.push((charCode >> j) & 1);
      }
    }
    
    // 添加校验和 (8位)
    let checksum = 0;
    for (let i = 16; i < bits.length; i++) { // 跳过同步序列和长度
      checksum ^= bits[i];
    }
    for (let j = 7; j >= 0; j--) {
      bits.push((checksum >> j) & 1);
    }
    
    return bits;
  }

  // 主要嵌入方法 - 改进错误处理
  async embedWatermark(imagePath, ownerAddress, outputPath, skipBlockchainRegistration = false) {
      console.log('=== 开始嵌入水印 ===');
      
      try {
          const image = await Jimp.read(imagePath);
          const width = image.bitmap.width;
          const height = image.bitmap.height;

          // 生成图像哈希 - 使用文件内容
          const imageData = await fs.readFile(imagePath);
          const imageHash = crypto.SHA256(imageData).toString();
          
          // 生成数据哈希用于区块链
          let dataHash;
          if (this.blockchain && this.blockchain.generateDataHash) {
              dataHash = this.blockchain.generateDataHash(imageData);
          } else {
              // 后备方案
              dataHash = '0x' + crypto.SHA256(imageData + Date.now()).toString();
          }
          
          console.log(`图像哈希: ${imageHash.substring(0, 16)}...`);
          console.log(`数据哈希: ${dataHash}`);
          console.log(`所有者地址: ${ownerAddress}`);

          let blockchainData = {
              registered: false,
              dataId: '',
              txHash: '',
              dataHash: dataHash,
              owner: ownerAddress
          };

          // 区块链注册 - 修复逻辑，传递所有者地址
          if (this.blockchain && this.blockchain.initialized && !skipBlockchainRegistration) {
              try {
                  console.log('检查数据是否已在区块链注册...');
                  const registrationCheck = await this.blockchain.verifyBlockchainRegistration(dataHash, ownerAddress);
                  
                  if (registrationCheck.registered && registrationCheck.ownershipVerified) {
                      console.log('数据已在区块链注册，且所有者匹配');
                      blockchainData = {
                          registered: true,
                          dataId: registrationCheck.dataId,
                          txHash: 'already_registered',
                          dataHash: dataHash,
                          owner: ownerAddress
                      };
                  } else {
                      console.log('尝试注册数据到区块链...');
                      const registration = await this.blockchain.registerDataResource(
                          dataHash,
                          JSON.stringify({
                              path: imagePath,
                              size: `${width}x${height}`,
                              format: 'jpg',
                              timestamp: Date.now(),
                              owner: ownerAddress, // 明确记录所有者
                              imageHash: imageHash.substring(0, 16)
                          }),
                          JSON.stringify({
                              algorithm: 'DCT',
                              blockSize: this.blockSize,
                              alpha: this.alpha
                          }),
                          ownerAddress // 关键修复：传递所有者地址
                      );

                      if (registration.success) {
                          blockchainData = {
                              registered: true,
                              dataId: registration.dataId,
                              txHash: registration.transactionHash,
                              dataHash: dataHash,
                              owner: ownerAddress
                          };
                          console.log('区块链注册成功');
                      } else {
                          console.warn('区块链注册失败，继续使用纯水印模式:', registration.error);
                      }
                  }
              } catch (blockchainError) {
                  console.warn('区块链注册异常，继续使用纯水印模式:', blockchainError.message);
              }
          } else {
              console.log('跳过区块链注册:', 
                  !this.blockchain ? '区块链管理器未初始化' : 
                  !this.blockchain.initialized ? '区块链未初始化' : 
                  '显式跳过注册');
          }

          // 生成水印信息
          const watermarkInfo = this.generateWatermarkInfo(ownerAddress, imageHash, blockchainData);
          const watermarkBits = this.encodeWatermarkBits(watermarkInfo);
          
          // 嵌入水印
          const embeddedResult = await this.embedInRGB(image, watermarkBits);
          await embeddedResult.writeAsync(outputPath);
          
          console.log(`水印嵌入完成，保存到: ${outputPath}`);
          
          // 验证嵌入
          let verification = { success: false };
          try {
              verification = await this.verifyEmbedding(outputPath, watermarkInfo);
          } catch (verifyError) {
              console.warn('水印验证失败:', verifyError.message);
          }
          
          return {
              success: true,
              watermarkedImage: embeddedResult,
              watermarkInfo: watermarkInfo,
              outputPath: outputPath,
              embeddedBits: watermarkBits.length,
              verification: verification,
              blockchainRegistration: {
                  success: blockchainData.registered,
                  dataId: blockchainData.dataId,
                  transactionHash: blockchainData.txHash,
                  dataHash: blockchainData.dataHash,
                  owner: blockchainData.owner
              }
          };
          
      } catch (error) {
          console.error('水印嵌入失败:', error);
          throw error;
      }
  }
  // 改进RGB嵌入 - 添加边界检查
  async embedInRGB(originalImage, watermarkBits) {
    const image = originalImage.clone();
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    const blocksWide = Math.floor(width / this.blockSize);
    const totalBits = watermarkBits.length;

    //console.log(`开始嵌入 ${totalBits} 比特到绿色通道`);

    let bitIndex = 0;
    let embeddedCount = 0;
    let errorCount = 0;

    // 在绿色通道(G)中嵌入水印
    for (let blockY = 0; blockY < Math.floor(height / this.blockSize); blockY++) {
      for (let blockX = 0; blockX < blocksWide; blockX++) {
        if (bitIndex >= totalBits) break;

        const startX = blockX * this.blockSize;
        const startY = blockY * this.blockSize;
        
        try {
          // 提取绿色通道的块
          const greenBlock = [];
          for (let y = 0; y < this.blockSize; y++) {
            for (let x = 0; x < this.blockSize; x++) {
              const pixelX = startX + x;
              const pixelY = startY + y;
              if (pixelX < width && pixelY < height) {
                const idx = (pixelY * width + pixelX) * 4;
                greenBlock.push(image.bitmap.data[idx + 1]); // 绿色通道
              } else {
                greenBlock.push(128); // 边界填充
              }
            }
          }

          // 应用DCT
          const dctCoeffs = this.dct2D(greenBlock);
          
          // 嵌入比特
          this.embedBitInDCTCoeffs(dctCoeffs, watermarkBits[bitIndex]);
          
          // 应用逆DCT
          const idctBlock = this.idct2D(dctCoeffs);
          
          // 写回绿色通道
          for (let y = 0; y < this.blockSize; y++) {
            for (let x = 0; x < this.blockSize; x++) {
              const pixelX = startX + x;
              const pixelY = startY + y;
              if (pixelX < width && pixelY < height) {
                const idx = (pixelY * width + pixelX) * 4;
                const newValue = Math.max(0, Math.min(255, Math.round(idctBlock[y * this.blockSize + x])));
                image.bitmap.data[idx + 1] = newValue;
              }
            }
          }

          embeddedCount++;
        } catch (error) {
          console.error(`块 (${blockX}, ${blockY}) 嵌入失败:`, error);
          errorCount++;
        }
        
        bitIndex++;
      }
    }

    console.log(`嵌入完成: ${embeddedCount} 比特成功, ${errorCount} 错误`);
    return image;
  }

  // 改进比特嵌入 - 使用更鲁棒的方法
  embedBitInDCTCoeffs(dctCoeffs, bit) {
    // 在多个位置嵌入同一比特
    for (const [i, j] of this.embeddingPositions) {
      const coeff = dctCoeffs[i][j];
      const magnitude = Math.abs(coeff);
      
      if (bit === 1) {
        dctCoeffs[i][j] = magnitude + this.alpha * 100;
      } else {
        dctCoeffs[i][j] = -magnitude - this.alpha * 100;
      }
    }
  }

  // 生成图像哈希
  async generateImageHash(imagePath) {
    const image = await Jimp.read(imagePath);
    const stats = {
      width: image.bitmap.width,
      height: image.bitmap.height,
      fileSize: (await fs.stat(imagePath)).size,
      timestamp: Date.now()
    };
    return crypto.SHA256(JSON.stringify(stats)).toString();
  }

  // 改进验证方法
  async verifyEmbedding(watermarkedImagePath, expectedWatermarkInfo) {
    console.log('=== 验证水印嵌入 ===');
    
    try {
      const extracted = await this.extractWatermark(watermarkedImagePath);
      
      if (!extracted.success) {
        return {
          success: false,
          error: `提取失败: ${extracted.error}`,
          details: extracted
        };
      }
      
      // 比较提取的水印信息
      const isMatch = this.compareWatermarkInfo(extracted.data, expectedWatermarkInfo.rawData);
      const similarity = this.calculateSimilarity(extracted.data, expectedWatermarkInfo.rawData);
      
      console.log(`水印验证结果: ${isMatch ? '成功' : '失败'}`);
      console.log(`相似度: ${similarity.toFixed(4)}`);
      //console.log(`预期: ${JSON.stringify(expectedWatermarkInfo.rawData)}`);
      //console.log(`实际: ${JSON.stringify(extracted.data)}`);
      
      return {
        success: isMatch,
        confidence: similarity,
        similarity: similarity,
        extractedData: extracted.data,
        expectedData: expectedWatermarkInfo.rawData
      };
      
    } catch (error) {
      return {
        success: false,
        error: `验证过程错误: ${error.message}`
      };
    }
  }

  // 改进相似度计算
  calculateSimilarity(extracted, expected) {
    if (!extracted || !expected) return 0;
    
    let matchCount = 0;
    let totalFields = 0;
    
    for (const key in expected) {
      if (expected.hasOwnProperty(key)) {
        totalFields++;
        if (extracted[key] === expected[key]) {
          matchCount++;
        }
      }
    }
    
    return totalFields > 0 ? matchCount / totalFields : 0;
  }

  // 比较水印信息
  compareWatermarkInfo(extracted, expected) {
    if (!extracted || !expected) return false;
    
    return extracted.o === expected.o && 
           extracted.h === expected.h &&
           extracted.v === expected.v;
  }

  // 改进水印提取
  async extractWatermark(imagePath) {
    console.log('=== 开始提取水印 ===');
    
    try {
      const image = await Jimp.read(imagePath);
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      
      //console.log(`提取图像尺寸: ${width}x${height}`);

      // 从绿色通道提取比特
      const extractedBits = this.extractFromGreenChannel(image, width, height);
      
      //console.log(`提取到 ${extractedBits.length} 比特`);
      
      if (extractedBits.length === 0) {
        return {
          success: false,
          error: '未提取到任何比特'
        };
      }
      
      // 解码水印
      const watermarkInfo = this.decodeWatermarkBits(extractedBits);
      
      return watermarkInfo;
      
    } catch (error) {
      console.error(`提取过程错误: ${error.message}`);
      return {
        success: false,
        error: `提取失败: ${error.message}`
      };
    }
  }

  // 改进绿色通道提取
  extractFromGreenChannel(image, width, height) {
    const extractedBits = [];
    const blocksWide = Math.floor(width / this.blockSize);
    let extractedCount = 0;

    for (let blockY = 0; blockY < Math.floor(height / this.blockSize); blockY++) {
      for (let blockX = 0; blockX < blocksWide; blockX++) {
        const startX = blockX * this.blockSize;
        const startY = blockY * this.blockSize;
        
        try {
          // 提取绿色通道块
          const greenBlock = [];
          for (let y = 0; y < this.blockSize; y++) {
            for (let x = 0; x < this.blockSize; x++) {
              const pixelX = startX + x;
              const pixelY = startY + y;
              if (pixelX < width && pixelY < height) {
                const idx = (pixelY * width + pixelX) * 4;
                greenBlock.push(image.bitmap.data[idx + 1]);
              } else {
                greenBlock.push(128);
              }
            }
          }

          // 应用DCT
          const dctCoeffs = this.dct2D(greenBlock);
          
          // 提取比特（多数表决）
          const bits = [];
          for (const [i, j] of this.embeddingPositions) {
            const coeff = dctCoeffs[i][j];
            bits.push(coeff >= 0 ? 1 : 0);
          }
          
          // 多数表决
          const ones = bits.filter(bit => bit === 1).length;
          const finalBit = ones >= 2 ? 1 : 0;
          
          extractedBits.push(finalBit);
          extractedCount++;
          
        } catch (error) {
          console.error(`块 (${blockX}, ${blockY}) 提取失败:`, error);
          extractedBits.push(0); // 错误时填充0
        }
      }
    }

    console.log(`实际提取比特数: ${extractedBits.length}`);
    return extractedBits;
  }

  // 改进比特提取
  extractBitFromDCTCoeffs(dctCoeffs) {
    let ones = 0;
    let zeros = 0;
    
    for (const [i, j] of this.embeddingPositions) {
      const coeff = dctCoeffs[i][j];
      if (coeff >= 0) {
        ones++;
      } else {
        zeros++;
      }
    }
    
    return ones >= zeros ? 1 : 0;
  }

  // 改进解码逻辑
  decodeWatermarkBits(bits) {
    //console.log(`开始解码 ${bits.length} 比特`);
    
    if (bits.length < 40) { // 最小长度检查
      return {
        success: false,
        error: `比特数不足: ${bits.length} < 40`
      };
    }

    // 查找同步序列
    const preamble = '1100110000110011';
    let bestMatchIndex = -1;
    let bestMatchScore = 0;

    // 滑动窗口查找最佳同步位置
    for (let start = 0; start <= bits.length - preamble.length; start++) {
      let matchScore = 0;
      for (let i = 0; i < preamble.length; i++) {
        if (bits[start + i] === parseInt(preamble[i])) {
          matchScore++;
        }
      }
      
      if (matchScore > bestMatchScore) {
        bestMatchScore = matchScore;
        bestMatchIndex = start;
      }
    }

    if (bestMatchIndex === -1 || bestMatchScore < preamble.length * 0.8) {
      return {
        success: false,
        error: `同步序列不匹配 (最佳匹配: ${bestMatchScore}/${preamble.length})`
      };
    }

    console.log(`找到同步序列 at index ${bestMatchIndex}, 匹配度: ${bestMatchScore}/${preamble.length}`);

    const dataStart = bestMatchIndex + preamble.length;
    
    // 提取数据长度
    if (dataStart + 16 > bits.length) {
      return {
        success: false,
        error: '比特流不足以提取长度信息'
      };
    }

    const lengthBits = bits.slice(dataStart, dataStart + 16);
    const dataLength = parseInt(lengthBits.join(''), 2);
    
    //console.log(`数据长度: ${dataLength} 字符`);

    // 提取数据内容
    const dataStartPos = dataStart + 16;
    const dataEndPos = dataStartPos + dataLength * 8;
    const checksumPos = dataEndPos;
    
    if (checksumPos + 8 > bits.length) {
      return {
        success: false,
        error: '比特流不足以提取完整数据和校验和'
      };
    }

    const dataBits = bits.slice(dataStartPos, dataEndPos);
    const checksumBits = bits.slice(checksumPos, checksumPos + 8);
    
    // 验证校验和
    let calculatedChecksum = 0;
    for (let i = 0; i < dataBits.length; i++) {
      calculatedChecksum ^= dataBits[i];
    }
    
    const extractedChecksum = parseInt(checksumBits.join(''), 2);
    
    if (calculatedChecksum !== extractedChecksum) {
      console.warn(`校验和不匹配: 计算=${calculatedChecksum}, 提取=${extractedChecksum}`);
    }

    // 解码数据
    const dataBytes = [];
    for (let i = 0; i < dataBits.length; i += 8) {
      if (i + 8 > dataBits.length) break;
      
      let charCode = 0;
      for (let j = 0; j < 8; j++) {
        charCode = (charCode << 1) | dataBits[i + j];
      }
      dataBytes.push(charCode);
    }
    
    const jsonString = String.fromCharCode(...dataBytes);
    //console.log(`提取的原始字符串: ${jsonString}`);

    try {
      // 清理JSON字符串
      const cleanJsonString = jsonString.replace(/[^\x20-\x7E]/g, '').trim();
      const watermarkData = JSON.parse(cleanJsonString);
      
      //console.log('成功解析水印数据:', watermarkData);
      
      return {
        success: true,
        data: watermarkData,
        rawString: jsonString,
        confidence: bestMatchScore / preamble.length,
        checksumValid: calculatedChecksum === extractedChecksum,
        bitsExtracted: bits.length
      };
      
    } catch (error) {
      //console.error('JSON解析失败:', error.message);
      
      // 尝试手动解析
      const manualData = this.parseWatermarkManually(jsonString);
      if (manualData) {
        return {
          success: true,
          data: manualData,
          rawString: jsonString,
          confidence: 0.5,
          warning: '手动解析数据',
          checksumValid: calculatedChecksum === extractedChecksum
        };
      }
      
      return {
        success: false,
        error: `JSON解析失败: ${error.message}`,
        rawString: jsonString
      };
    }
  }

  // 改进手动解析
  parseWatermarkManually(jsonString) {
    try {
      // 使用正则表达式提取关键字段
      const ownerMatch = jsonString.match(/"o"\s*:\s*"([^"]*)"/);
      const hashMatch = jsonString.match(/"h"\s*:\s*"([^"]*)"/);
      const timeMatch = jsonString.match(/"t"\s*:\s*(\d+)/);
      const versionMatch = jsonString.match(/"v"\s*:\s*"([^"]*)"/);
      
      if (ownerMatch && hashMatch) {
        return {
          o: ownerMatch[1],
          h: hashMatch[1],
          t: timeMatch ? parseInt(timeMatch[1]) : Date.now(),
          v: versionMatch ? versionMatch[1] : '1'
        };
      }
    } catch (e) {
      console.error('手动解析失败:', e.message);
    }
    
    return null;
  }

  // 验证权属
// watermark.js - 修改 verifyOwnership 方法
  async verifyOwnership(imagePath, expectedOwner) {
      console.log(`=== 验证图像权属 ===`);
      console.log(`期望的所有者: ${expectedOwner}`);
      
      try {
          // 1. 提取水印
          const extracted = await this.extractWatermark(imagePath);
          
          if (!extracted.success) {
              console.log(`水印提取失败: ${extracted.error}`);
              return {
                  verified: false,
                  confidence: 0,
                  reason: `水印提取失败: ${extracted.error}`,
                  details: extracted
              };
          }
          
          const extractedOwner = extracted.data.o;
          const expectedShort = expectedOwner.substring(2, 10);
          const watermarkMatch = extractedOwner === expectedShort;
          
          console.log(`水印匹配结果: 提取 '${extractedOwner}' vs 期望 '${expectedShort}' -> ${watermarkMatch}`);
          
          // 2. 区块链验证
          let blockchainVerified = false;
          let blockchainDetails = null;
          
          const blockchainAvailable = this.blockchain && 
                                    this.blockchain.initialized && 
                                    this.blockchain.contracts && 
                                    this.blockchain.contracts.ownership;
                                
          if (blockchainAvailable && extracted.data.bc) {
              try {
                  const dataHash = extracted.data.bc.dataHash;
                  console.log(`使用水印中的dataHash进行区块链验证: ${dataHash}`);
                  
                  if (dataHash && dataHash !== '0x0' && dataHash.length === 66) {
                      // 首先检查注册状态和所有者匹配
                      const registrationCheck = await this.blockchain.verifyBlockchainRegistration(dataHash, expectedOwner);
                      
                      if (registrationCheck.registered && registrationCheck.ownershipVerified) {
                          console.log('区块链注册验证成功，所有者匹配');
                          blockchainVerified = true;
                          blockchainDetails = registrationCheck;
                      } else {
                          // 如果注册检查失败，尝试直接验证所有权
                          console.log('注册检查不匹配，尝试直接验证所有权...');
                          const blockchainVerification = await this.blockchain.verifyOwnership(dataHash, expectedOwner);
                          blockchainVerified = blockchainVerification.success && blockchainVerification.verified;
                          blockchainDetails = blockchainVerification;
                      }
                      
                      console.log(`区块链验证结果: ${blockchainVerified}`);
                      
                      if (!blockchainVerified) {
                          console.log('区块链验证失败详情:', blockchainDetails);
                      }
                  } else {
                      console.warn(`无效的dataHash，跳过区块链验证: ${dataHash}`);
                  }
              } catch (blockchainError) {
                  console.warn('区块链验证失败:', blockchainError.message);
                  blockchainVerified = false;
              }
          } else {
              if (!blockchainAvailable) {
                  console.log('跳过区块链验证（区块链不可用）');
              } else if (!extracted.data.bc) {
                  console.log('跳过区块链验证（水印中无区块链数据）');
              }
          }
          
          // 3. 综合验证结果
          // 如果区块链不可用，只依赖水印验证
          const finalVerified = blockchainAvailable ? 
              (watermarkMatch && blockchainVerified) : watermarkMatch;
          
          // 计算置信度
          let confidence = extracted.confidence || 0.5;
          if (watermarkMatch) confidence *= 1.2;
          if (blockchainVerified) confidence *= 1.3;
          if (extracted.checksumValid) confidence *= 1.1;
          confidence = Math.min(1.0, confidence);
          
          console.log(`权属验证最终结果: ${finalVerified ? '成功' : '失败'}`);
          console.log(`置信度: ${confidence}`);
          
          return {
              verified: finalVerified,
              confidence: confidence,
              watermarkMatch: watermarkMatch,
              blockchainVerified: blockchainVerified,
              extractedOwner: extractedOwner,
              expectedOwner: expectedShort,
              blockchainDetails: blockchainDetails,
              details: extracted
          };
          
      } catch (error) {
          console.error('权属验证失败:', error);
          return {
              verified: false,
              confidence: 0,
              error: error.message
          };
      }
  }

  // 测试功能
    async testBasicFunctionality(imagePath, ownerAddress) {
        console.log('=== 测试水印基本功能 ===');
        
        try {
            const outputPath = imagePath.replace('.jpg', '_watermarked.jpg');
            
            // 嵌入水印
            const embedResult = await this.embedWatermark(imagePath, ownerAddress, outputPath);
            
            // 即使初始验证失败也继续测试
            if (!embedResult.verification.success) {
                console.warn(`初始验证警告: ${embedResult.verification.error}`);
            }
            
            // 验证权属
            const verifyResult = await this.verifyOwnership(outputPath, ownerAddress);
            
            console.log('=== 测试结果 ===');
            console.log(`嵌入成功: ${true}`); // 只要没有抛出异常就认为成功
            console.log(`权属验证: ${verifyResult.verified}`);
            console.log(`置信度: ${verifyResult.confidence}`);
            console.log(`区块链注册: ${embedResult.blockchainRegistration.success}`);
            
            return {
                embedSuccess: true,
                verifySuccess: verifyResult.verified,
                confidence: verifyResult.confidence,
                blockchainRegistered: embedResult.blockchainRegistration.success,
                details: {
                    embed: embedResult,
                    verify: verifyResult
                }
            };
            
        } catch (error) {
            console.error('基本功能测试失败:', error);
            return {
                embedSuccess: false,
                verifySuccess: false,
                error: error.message
            };
        }
    }
}

module.exports = FixedDCTWatermark; 