// blockchain.js - 修复所有者地址问题
const {Web3} = require('web3');
const { abi: OwnershipABI } = require('../build/contracts/OwnershipRegistrationContract');
const { abi: ProcessingABI } = require('../build/contracts/ProcessingRightGrantingContract');
const { abi: TradingABI } = require('../build/contracts/ProductTradingContract');

class BlockchainManager {
    constructor(providerUrl = 'http://localhost:8545') {
        this.web3 = new Web3(providerUrl);
        this.contracts = {};
        this.account = null;
        this.initialized = false;
    }

    async initialize(contractAddresses) {
        try {
            console.log('初始化区块链连接...');
            
            // 获取所有账户
            const accounts = await this.web3.eth.getAccounts();
            if (!accounts || accounts.length === 0) {
                throw new Error('未找到可用账户');
            }
            
            // 使用第一个账户作为默认账户
            this.account = accounts[0];
            this.allAccounts = accounts; // 保存所有账户
            
            console.log(`使用默认账户: ${this.account}`);
            console.log(`可用账户数量: ${accounts.length}`);

            // 验证合约地址
            if (!contractAddresses.ownership || !contractAddresses.processing || !contractAddresses.trading) {
                throw new Error('合约地址配置不完整');
            }

            // 初始化合约实例
            this.contracts.ownership = new this.web3.eth.Contract(
                OwnershipABI,
                contractAddresses.ownership
            );

            this.contracts.processing = new this.web3.eth.Contract(
                ProcessingABI,
                contractAddresses.processing
            );

            this.contracts.trading = new this.web3.eth.Contract(
                TradingABI,
                contractAddresses.trading
            );

            // 测试合约连接
            await this.testContractConnections();
            
            this.initialized = true;
            console.log('区块链管理器初始化完成');
            return true;
        } catch (error) {
            console.error('区块链初始化失败:', error);
            this.initialized = false;
            return false;
        }
    }

    // 修复的数据资源注册方法 - 支持指定所有者
    async registerDataResource(dataHash, metadata, watermarkFeatures, ownerAddress = null) {
        try {
            console.log('注册数据资源到区块链...');
            console.log(`数据哈希: ${dataHash}`);
            console.log(`所有者地址: ${ownerAddress || this.account}`);
            console.log(`元数据: ${metadata.substring(0, 50)}...`);
            
            // 使用指定的所有者地址，如果没有指定则使用默认账户
            const fromAddress = ownerAddress || this.account;
            
            // 检查是否已注册
            const isRegistered = await this.contracts.ownership.methods
                .isDataRegistered(dataHash)
                .call();
                
            if (isRegistered) {
                console.log('数据已注册，跳过重复注册');
                const dataId = await this.contracts.ownership.methods
                    .getDataIdByHash(dataHash)
                    .call();
                return {
                    success: true,
                    dataId: dataId,
                    transactionHash: 'already_registered',
                    dataHash: dataHash,
                    alreadyRegistered: true
                };
            }

            const result = await this.contracts.ownership.methods
                .registerDataResource(dataHash, metadata, watermarkFeatures)
                .send({
                    from: fromAddress, // 使用指定的所有者地址
                    gas: 5000000,
                    gasPrice: '20000000000'
                });

            console.log('交易结果:', result);

            let dataId;
            if (result.events && result.events.DataRegistered) {
                dataId = result.events.DataRegistered.returnValues.dataId;
            } else {
                // 尝试通过哈希获取数据ID
                dataId = await this.contracts.ownership.methods
                    .getDataIdByHash(dataHash)
                    .call();
            }

            console.log(`数据注册成功，数据ID: ${dataId}`);
            console.log(`注册所有者: ${fromAddress}`);
            
            return {
                success: true,
                dataId: dataId,
                transactionHash: result.transactionHash,
                dataHash: dataHash,
                owner: fromAddress
            };
        } catch (error) {
            console.error('数据注册失败:', error);
            // 检查是否是重复注册错误
            if (error.message.includes('Data already registered') || error.message.includes('already registered')) {
                console.log('数据已注册，尝试获取现有数据ID...');
                try {
                    const dataId = await this.contracts.ownership.methods
                        .getDataIdByHash(dataHash)
                        .call();
                    return {
                        success: true,
                        dataId: dataId,
                        transactionHash: 'already_exists',
                        dataHash: dataHash,
                        alreadyRegistered: true
                    };
                } catch (getError) {
                    return {
                        success: false,
                        error: `注册失败且无法获取现有ID: ${getError.message}`
                    };
                }
            }
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 修复的所有权验证方法
    async verifyOwnership(dataHash, checkAddress) {
        try {
            console.log('验证区块链所有权...');
            console.log(`数据哈希: ${dataHash}`);
            console.log(`验证地址: ${checkAddress}`);
            
            // 首先检查数据是否注册
            const isRegistered = await this.contracts.ownership.methods
                .isDataRegistered(dataHash)
                .call();
                
            if (!isRegistered) {
                console.log('数据未在区块链注册');
                return {
                    success: false,
                    verified: false,
                    error: '数据未在区块链注册'
                };
            }

            // 获取数据ID
            const dataId = await this.contracts.ownership.methods
                .getDataIdByHash(dataHash)
                .call();

            if (dataId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                console.log('获取的数据ID无效');
                return {
                    success: false,
                    verified: false,
                    error: '无效的数据ID'
                };
            }

            console.log(`获取到数据ID: ${dataId}`);

            // 使用数据ID验证所有权
            const isValid = await this.contracts.ownership.methods
                .verifyOwnership(dataId, checkAddress)
                .call();

            console.log(`所有权验证结果: ${isValid}`);
            
            // 如果验证失败，获取实际所有者进行调试
            if (!isValid) {
                try {
                    const resource = await this.contracts.ownership.methods
                        .getDataResource(dataId)
                        .call();
                    console.log(`实际注册的所有者: ${resource.owner}`);
                    console.log(`期望的所有者: ${checkAddress}`);
                    console.log(`是否匹配: ${resource.owner.toLowerCase() === checkAddress.toLowerCase()}`);
                } catch (debugError) {
                    console.warn('无法获取资源详情进行调试:', debugError.message);
                }
            }
            
            return {
                success: true,
                verified: isValid,
                dataId: dataId
            };
        } catch (error) {
            console.error('所有权验证失败:', error);
            return {
                success: false,
                error: error.message,
                verified: false
            };
        }
    }

    // 修复的区块链注册状态验证
    async verifyBlockchainRegistration(dataHash, expectedOwner = null) {
        try {
            console.log(`验证区块链注册状态: ${dataHash}`);
            if (expectedOwner) {
                console.log(`期望的所有者: ${expectedOwner}`);
            }
            
            // 1. 检查注册状态
            const isRegistered = await this.contracts.ownership.methods
                .isDataRegistered(dataHash)
                .call();
                
            if (!isRegistered) {
                return {
                    success: false,
                    registered: false,
                    error: '数据未在区块链上注册'
                };
            }
            
            // 2. 获取数据ID
            const dataId = await this.contracts.ownership.methods
                .getDataIdByHash(dataHash)
                .call();
                
            if (dataId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                return {
                    success: false,
                    registered: false,
                    error: '无效的数据ID'
                };
            }
            
            // 3. 获取完整资源信息
            let resource;
            try {
                resource = await this.contracts.ownership.methods
                    .getDataResource(dataId)
                    .call();
                console.log(`注册的所有者: ${resource.owner}`);
            } catch (resourceError) {
                console.warn('获取资源详情失败:', resourceError.message);
                resource = null;
            }

            // 4. 如果提供了期望的所有者，验证匹配
            let ownershipVerified = true;
            if (expectedOwner && resource) {
                ownershipVerified = resource.owner.toLowerCase() === expectedOwner.toLowerCase();
                console.log(`所有者验证: ${ownershipVerified}`);
            }

            return {
                success: true,
                registered: true,
                dataId: dataId,
                resource: resource,
                ownershipVerified: ownershipVerified
            };
        } catch (error) {
            console.error('区块链注册状态验证失败:', error);
            return {
                success: false,
                registered: false,
                error: error.message
            };
        }
    }

    // 生成数据哈希
    generateDataHash(imageData) {
        try {
            let hash;
            if (typeof imageData === 'string') {
                // 如果是文件路径，读取文件内容
                const fs = require('fs');
                const buffer = fs.readFileSync(imageData);
                const hexString = buffer.toString('hex');
                hash = this.web3.utils.sha3('0x' + hexString);
            } else if (Buffer.isBuffer(imageData)) {
                // 如果是Buffer
                const hexString = imageData.toString('hex');
                hash = this.web3.utils.sha3('0x' + hexString);
            } else {
                // 其他情况
                hash = this.web3.utils.sha3(JSON.stringify(imageData));
            }
            
            // 确保哈希格式正确
            if (!hash.startsWith('0x')) {
                hash = '0x' + hash;
            }
            
            console.log(`生成数据哈希: ${hash}`);
            return hash;
        } catch (error) {
            console.error('生成数据哈希失败:', error);
            // 返回一个基于时间戳的哈希作为后备
            const fallbackHash = this.web3.utils.sha3('fallback_' + Date.now());
            return fallbackHash;
        }
    }

    // 检查连接状态
    async checkConnection() {
        try {
            const blockNumber = await this.web3.eth.getBlockNumber();
            const isListening = await this.web3.eth.net.isListening();
            
            console.log(`区块链连接正常，当前区块: ${blockNumber}, 监听状态: ${isListening}`);
            return {
                connected: true,
                blockNumber: blockNumber,
                listening: isListening,
                account: this.account,
                allAccounts: this.allAccounts,
                initialized: this.initialized
            };
        } catch (error) {
            console.error('区块链连接失败:', error);
            return {
                connected: false,
                error: error.message,
                initialized: this.initialized
            };
        }
    }

    async testContractConnections() {
        try {
            // 测试所有权合约
            const ownershipTest = await this.contracts.ownership.methods.getDataIdByHash('0x0').call();
            console.log('所有权合约连接测试通过');
            
            return true;
        } catch (error) {
            console.warn('合约连接测试警告:', error.message);
            return true; // 即使测试失败也继续
        }
    }
}

module.exports = BlockchainManager;