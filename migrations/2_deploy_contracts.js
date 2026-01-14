const OwnershipRegistrationContract = artifacts.require("OwnershipRegistrationContract");
const ProcessingRightGrantingContract = artifacts.require("ProcessingRightGrantingContract");
const ProductTradingContract = artifacts.require("ProductTradingContract");

module.exports = async function(deployer) {
  // 先部署所有权注册合约
  await deployer.deploy(OwnershipRegistrationContract);
  const ownershipInstance = await OwnershipRegistrationContract.deployed();

  // 部署授权合约，传入所有权合约地址
  await deployer.deploy(ProcessingRightGrantingContract, ownershipInstance.address);
  const authInstance = await ProcessingRightGrantingContract.deployed();

  // 部署交易合约，传入两个依赖合约地址
  await deployer.deploy(
    ProductTradingContract, 
    ownershipInstance.address, 
    authInstance.address
  );
};